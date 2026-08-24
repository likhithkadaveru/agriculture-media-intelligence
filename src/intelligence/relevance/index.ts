/**
 * Deterministic relevance gate — runs BEFORE any expensive enrichment.
 *
 * A mention passes only if it is both Telangana-relevant and
 * agriculture-relevant according to the ontology. This is intentionally
 * conservative and fully explainable: the reason records which term families
 * matched or failed.
 *
 * Known limitation (documented): pure ontology matching cannot catch every
 * out-of-state false positive (e.g. a Telangana-named entity elsewhere).
 * The LLM enrichment stage re-scores relevance for accepted items; items the
 * gate rejects never reach paid stages.
 */
import {
  AGRICULTURE_MARKERS,
  CROPS,
  DISTRICTS,
  GOVERNMENT_ENTITIES,
  INPUTS,
  SCHEMES,
  TELANGANA_MARKERS,
  TOPICS,
  matchTerms,
  termMatches,
} from "@/ontology";

/** Non-Telangana Indian states/regions that flag likely out-of-state stories. */
const OUT_OF_STATE_MARKERS = [
  "punjab",
  "haryana",
  "karnataka",
  "maharashtra",
  "tamil nadu",
  "kerala",
  "uttar pradesh",
  "madhya pradesh",
  "gujarat",
  "rajasthan",
  "bihar",
  "odisha",
  "west bengal",
  "andhra pradesh",
];

export interface RelevanceVerdict {
  accepted: boolean;
  telanganaRelevance: number;
  agricultureRelevance: number;
  reason: string;
  matchedDistricts: string[];
}

export interface RelevanceContext {
  /**
   * Author/organisation identity (name + bio). Contributes ONLY to Telangana
   * anchoring — official Telangana statements often say "across the state"
   * without naming it. It never contributes agriculture relevance, so a
   * Telangana-anchored account posting off-topic content is still rejected.
   */
  authorContext?: string | null;
}

export function assessRelevance(text: string, context?: RelevanceContext): RelevanceVerdict {
  const matchedDistricts = matchTerms(text, DISTRICTS).map((d) => d.id);
  const hasTelanganaMarker = termMatches(text, TELANGANA_MARKERS);
  const lower = text.toLowerCase();
  const outOfState = OUT_OF_STATE_MARKERS.filter((s) => lower.includes(s));

  const agricultureHits = [
    termMatches(text, AGRICULTURE_MARKERS) ? "agriculture-markers" : null,
    matchTerms(text, TOPICS).length > 0 ? "topics" : null,
    matchTerms(text, CROPS).length > 0 ? "crops" : null,
    matchTerms(text, INPUTS).length > 0 ? "inputs" : null,
    matchTerms(text, SCHEMES).length > 0 ? "schemes" : null,
    matchTerms(text, GOVERNMENT_ENTITIES).length > 0 ? "government-entities" : null,
  ].filter((x): x is string => x !== null);

  // Author-level Telangana anchoring (e.g. "Government of Telangana" in the
  // organisation name) — weaker than in-content evidence.
  const authorContext = context?.authorContext ?? "";
  const authorAnchored =
    authorContext.length > 0 &&
    (termMatches(authorContext, TELANGANA_MARKERS) ||
      matchTerms(authorContext, DISTRICTS).length > 0);

  // Telangana relevance: explicit marker or district evidence, weakened when
  // the text is anchored to another state without any Telangana marker.
  let telanganaRelevance = 0;
  if (hasTelanganaMarker) telanganaRelevance += 0.6;
  if (matchedDistricts.length > 0) telanganaRelevance += 0.5;
  if (authorAnchored) telanganaRelevance += 0.4;
  if (outOfState.length > 0 && !hasTelanganaMarker && matchedDistricts.length === 0) {
    telanganaRelevance = 0;
  } else if (outOfState.length > 0) {
    telanganaRelevance = Math.max(0, telanganaRelevance - 0.3);
  }
  telanganaRelevance = Math.min(1, telanganaRelevance);

  const agricultureRelevance = Math.min(1, agricultureHits.length * 0.35);

  const accepted = telanganaRelevance >= 0.4 && agricultureRelevance >= 0.35;

  const reasonParts: string[] = [];
  reasonParts.push(
    hasTelanganaMarker || matchedDistricts.length > 0 || authorAnchored
      ? `Telangana evidence: ${[
          hasTelanganaMarker ? "state marker" : null,
          matchedDistricts.length > 0 ? `districts [${matchedDistricts.join(", ")}]` : null,
          authorAnchored ? "author/organisation anchored to Telangana" : null,
        ]
          .filter(Boolean)
          .join(", ")}`
      : "No Telangana marker or district found",
  );
  if (outOfState.length > 0) {
    reasonParts.push(`out-of-state markers [${outOfState.join(", ")}]`);
  }
  reasonParts.push(
    agricultureHits.length > 0
      ? `agriculture evidence: [${agricultureHits.join(", ")}]`
      : "no agriculture evidence",
  );

  return {
    accepted,
    telanganaRelevance,
    agricultureRelevance,
    reason: reasonParts.join("; "),
    matchedDistricts,
  };
}
