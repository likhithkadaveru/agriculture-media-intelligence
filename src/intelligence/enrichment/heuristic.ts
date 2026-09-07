/**
 * Heuristic enricher — deterministic, ontology-driven enrichment.
 *
 * This is the credential-free development and test enricher, and the
 * permanent cheap pre-classifier. It cannot translate or summarise free
 * text; for demo_seed data it uses translations authored with the corpus
 * (recorded as seed_authored provenance). Live data gets translation only
 * from the LLM enricher.
 */
import {
  CROPS,
  DISTRICTS,
  GOVERNMENT_ENTITIES,
  INPUTS,
  SCHEMES,
  TOPICS,
  matchTerms,
  teluguRatio,
} from "@/ontology";
import { assessRelevance } from "@/intelligence/relevance";
import {
  EnrichmentResultSchema,
  type Enricher,
  type EnrichmentInput,
  type EnrichmentResult,
} from "./schema";

const NEGATIVE_MARKERS = [
  "shortage",
  "not available",
  "unavailable",
  "delayed",
  "delay",
  "pending",
  "black market",
  "above mrp",
  "protest",
  "distress",
  "కొరత",
  "దొరకడం లేదు",
  "లేదని",
  "లేదు",
  "ఇబ్బంది",
  "ఆందోళన",
  "బ్లాక్",
  "పడలేదు",
  "రాలేదు",
  "ఎండిపోతుంది",
  "ఆలస్యం",
  "నష్టం",
];

const REASSURANCE_MARKERS = [
  "adequate",
  "sufficient",
  "no shortage",
  "not panic",
  "available at mrp",
  "సరిపడా",
  "ఆందోళన చెందవద్దు",
  "పర్యవేక్షిస్తున్నాం",
];

const GOVT_DEMAND_MARKERS = [
  "urge",
  "should pay attention",
  "పట్టించుకోవాలి",
  "requested the",
  "demand",
  "కలెక్టర్",
];

function detectLanguage(text: string): EnrichmentResult["language"] {
  const ratio = teluguRatio(text);
  if (ratio > 0.75) return "te";
  if (ratio > 0.15) return "mixed";
  if (/[a-zA-Z]/.test(text)) return "en";
  return "other";
}

function countMatches(text: string, markers: string[]): number {
  const lower = text.toLowerCase();
  return markers.filter((m) => lower.includes(m.toLowerCase())).length;
}

/**
 * Strip reassurance phrasing before counting negative markers, so that
 * "no shortage here" does not register as a shortage complaint.
 */
function stripReassurance(text: string): string {
  let out = text.toLowerCase();
  for (const marker of REASSURANCE_MARKERS) {
    out = out.split(marker.toLowerCase()).join(" ");
  }
  return out;
}

function classifyAuthor(input: EnrichmentInput): {
  authorType: EnrichmentResult["authorType"];
  confidence: number | null;
} {
  const haystack = [input.authorName ?? "", input.authorBio ?? ""].join(" ").toLowerCase();
  if (input.isOfficialAccount || /department|శాఖ|government|ప్రభుత్వ|university|విశ్వవిద్యాలయ/.test(haystack)) {
    return { authorType: "government", confidence: 0.9 };
  }
  if (/producer company|fpo/.test(haystack)) {
    return { authorType: "fpo", confidence: 0.85 };
  }
  if (/sangham|సంఘం|farmer organisation|union/.test(haystack)) {
    return { authorType: "farmer_organisation", confidence: 0.85 };
  }
  if (/news|tv|chronicle|express|times|desk|媒体|పత్రిక|ఛానల్|channel.*news/.test(haystack)) {
    return { authorType: "media_organisation", confidence: 0.85 };
  }
  if (/dealer|traders|agro (traders|centre)|డీలర్/.test(haystack)) {
    return { authorType: "dealer", confidence: 0.8 };
  }
  if (/creator|vlogs|guide|education channel|content/.test(haystack)) {
    return { authorType: "creator", confidence: 0.7 };
  }
  if (/రైతు|farmer|farming|వ్యవసాయం మా జీవితం|సాగు/.test(haystack)) {
    return { authorType: "farmer", confidence: 0.75 };
  }
  if (/journalist|reporter/.test(haystack)) {
    return { authorType: "journalist", confidence: 0.75 };
  }
  if (haystack.trim().length > 0) {
    return { authorType: "citizen", confidence: 0.4 };
  }
  return { authorType: "unknown", confidence: null };
}

export class HeuristicEnricher implements Enricher {
  provider = "heuristic";
  model = "ontology-rules";
  promptVersion = "h1";

  async enrich(input: EnrichmentInput): Promise<EnrichmentResult> {
    const text = [input.title, input.originalText].filter(Boolean).join("\n");
    const relevance = assessRelevance(text, {
      title: input.title,
      authorContext: [input.authorName, input.authorBio].filter(Boolean).join(" "),
      sourceKind: input.authorBio?.startsWith("channel-kind:")
        ? input.authorBio.slice("channel-kind:".length)
        : null,
    });

    const topics = matchTerms(text, TOPICS);
    const subtopics = topics.flatMap((t) => matchTerms(text, t.subtopics ?? []));
    const schemes = matchTerms(text, SCHEMES);
    const crops = matchTerms(text, CROPS);
    const entities = matchTerms(text, GOVERNMENT_ENTITIES);
    const inputsMatched = matchTerms(text, INPUTS);

    // District: only when the text itself names it. Multiple districts named
    // → keep the first as primary but lower confidence (statewide stories).
    const matchedDistricts = matchTerms(text, DISTRICTS);
    const district = matchedDistricts[0] ?? null;
    let mandal: string | null = null;
    let locationConfidence: number | null = null;
    if (district) {
      const mandals = matchTerms(text, district.mandals ?? []);
      mandal = mandals[0]?.en ?? null;
      locationConfidence = matchedDistricts.length === 1 ? (mandal ? 0.92 : 0.85) : 0.6;
    }

    const reassurance = countMatches(text, REASSURANCE_MARKERS);
    const negatives = countMatches(stripReassurance(text), NEGATIVE_MARKERS);
    const govtDemand = countMatches(text, GOVT_DEMAND_MARKERS);

    let sentiment: EnrichmentResult["sentiment"] = "neutral";
    if (negatives > 0 && reassurance > 0) sentiment = "mixed";
    else if (negatives > 0) sentiment = "negative";
    else if (reassurance > 0) sentiment = "positive";

    const { authorType, confidence: authorTypeConfidence } = classifyAuthor(input);

    // Stance toward government on the issue.
    let stance: EnrichmentResult["stance"] = "neutral";
    if (authorType === "government") {
      stance = reassurance > 0 ? "supportive" : "neutral";
    } else if (negatives > 0 || govtDemand > 0) {
      stance = "critical";
    } else if (reassurance > 0) {
      stance = "supportive";
    }
    if (sentiment === "mixed" && authorType === "media_organisation") stance = "mixed";

    // Conservative template claim for the strongest, most testable case.
    let claim: string | null = null;
    let claimConfidence: number | null = null;
    const mentionsDap = inputsMatched.some((i) => i.id === "dap");
    if (mentionsDap && negatives > 0 && authorType !== "government") {
      claim = district
        ? `DAP reported unavailable or above MRP in ${district.en}`
        : "DAP reported unavailable or above MRP (location unstated)";
      claimConfidence = district ? 0.75 : 0.55;
    } else if (authorType === "government" && mentionsDap && reassurance > 0) {
      claim = "Official position: fertilizer stocks adequate statewide";
      claimConfidence = 0.85;
    }

    // Translation: only seed-authored for demo data; never fabricated.
    const englishTranslation =
      input.dataOrigin === "demo_seed" && input.seedTranslation
        ? input.seedTranslation
        : null;

    const result: EnrichmentResult = {
      language: detectLanguage(input.originalText),
      telanganaRelevance: relevance.telanganaRelevance,
      agricultureRelevance: relevance.agricultureRelevance,
      topics: topics.map((t) => t.id),
      subtopics: subtopics.map((s) => s.id),
      schemes: schemes.map((s) => s.id),
      crops: crops.map((c) => c.id),
      governmentEntities: entities.map((e) => e.id),
      district: district?.id ?? null,
      mandal,
      locationConfidence,
      authorType,
      authorTypeConfidence,
      sentiment,
      stance,
      claim,
      claimConfidence,
      // The heuristic enricher classifies from keyword tables and has no way
      // to judge either of these. Null is the honest answer, and matches its
      // existing refusal to fabricate a summary.
      eventType: null,
      department: null,
      englishTranslation,
      summary: null, // heuristic does not fabricate summaries
      confidence: Math.min(
        0.85,
        0.4 +
          0.15 * Math.min(2, topics.length) +
          (district ? 0.1 : 0) +
          (authorTypeConfidence ?? 0) * 0.1,
      ),
    };

    return EnrichmentResultSchema.parse(result);
  }
}
