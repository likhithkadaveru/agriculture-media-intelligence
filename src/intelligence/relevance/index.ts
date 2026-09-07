/**
 * Deterministic relevance gate — runs BEFORE any expensive enrichment.
 *
 * Design (revised against live data): the gate is AGRICULTURE-FIRST.
 *
 * The first live run showed the original ordering was inverted. Telangana
 * political content (official channels, CM coverage) is saturated with state
 * markers and mentions "farmers" once in passing, so it sailed through and
 * consumed LLM budget; meanwhile genuine Telugu farming content was rejected
 * for free because it discusses paddy and fertilizer without ever naming the
 * state. The system was paying to reject noise and discarding signal.
 *
 * So:
 *  1. Agriculture evidence is scored with TITLE WEIGHTING — a real
 *     agriculture story says so in its title; a passing mention in a press
 *     release body does not. Content with no agriculture signal is rejected
 *     deterministically and never reaches the model.
 *  2. Telangana evidence accepts a weaker regional prior for
 *     agriculture-dedicated sources, letting genuinely agricultural content
 *     reach the model, which then judges state relevance from context (see
 *     the model-confirmation step in intelligence/enrichment/stage.ts).
 *
 * This is a recall gate, not the final decision. Precision comes from model
 * confirmation downstream.
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

/**
 * Andhra Pradesh markers, kept separate from the general out-of-state list
 * because AP is the one state this system will reliably confuse itself with.
 * It shares the language, the outlets and, until 2014, the state — so a
 * Telugu agriculture channel covering a Guntur farmer looks, to every other
 * signal here, exactly like one covering a Khammam farmer.
 *
 * DELIBERATELY ABSENT: "krishna" and bare "godavari". Both are AP districts
 * and both are rivers running through Telangana, and Krishna/Godavari water
 * management is core Telangana coverage — listing them would reject the very
 * stories this system exists to catch. The two-word Godavari districts are
 * safe and are listed; the bare river names are not.
 */
const ANDHRA_PRADESH_MARKERS = [
  "andhra pradesh",
  "andhra",
  "ఆంధ్రప్రదేశ్",
  "ఆంధ్ర",
  // NOT "ఏపీ": it is a substring of "డీఏపీ" (DAP fertiliser), which appears
  // in a large share of genuine Telangana items. The abbreviation is not
  // worth breaking the most common term in the corpus to catch.
  "rayalaseema",
  "రాయలసీమ",
  "amaravati",
  "అమరావతి",
  // Districts and principal cities.
  "east godavari",
  "west godavari",
  "తూర్పు గోదావరి",
  "పశ్చిమ గోదావరి",
  "guntur",
  "గుంటూరు",
  "vijayawada",
  "విజయవాడ",
  "visakhapatnam",
  "vizag",
  "విశాఖపట్నం",
  "vizianagaram",
  "srikakulam",
  "శ్రీకాకుళం",
  "nellore",
  "నెల్లూరు",
  "kurnool",
  "కర్నూలు",
  "anantapur",
  "అనంతపురం",
  "kadapa",
  "కడప",
  "chittoor",
  "చిత్తూరు",
  "tirupati",
  "తిరుపతి",
  "prakasam",
  "ongole",
  "ఒంగోలు",
  "kakinada",
  "కాకినాడ",
  "konaseema",
  "eluru",
  "ఏలూరు",
  "nandyal",
  "నంద్యాల",
  "bapatla",
  "palnadu",
  "machilipatnam",
  "rajahmundry",
  "రాజమండ్రి",
];

/** Non-Telangana Indian states/regions that flag likely out-of-state stories. */
const OUT_OF_STATE_MARKERS = [
  ...ANDHRA_PRADESH_MARKERS,
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
  /** Title, scored separately: agriculture in the title is a strong signal. */
  title?: string | null;
  /**
   * Source kind from the channel registry (agriculture_programme, creator,
   * media_organisation, government). Agriculture-dedicated sources get a
   * regional prior so their content reaches model adjudication.
   */
  sourceKind?: string | null;
}

const AGRICULTURE_FAMILIES = [
  { id: "agriculture-markers", terms: [AGRICULTURE_MARKERS] },
  { id: "topics", terms: TOPICS },
  { id: "crops", terms: CROPS },
  { id: "inputs", terms: INPUTS },
  { id: "schemes", terms: SCHEMES },
  // Only agriculture-specific offices count. The CMO, a district collector or
  // Civil Supplies appearing in a text says nothing about agriculture — live
  // data showed "Chief Minister" alone scoring political items as agricultural.
  {
    id: "agriculture-entities",
    terms: GOVERNMENT_ENTITIES.filter((e) => e.agricultureSpecific),
  },
];

export function assessRelevance(
  text: string,
  context?: RelevanceContext,
): RelevanceVerdict {
  const authorContext = context?.authorContext ?? "";
  const sourceKind = context?.sourceKind ?? "";
  /*
   * Title weighting needs a headline to weigh. Short-form content (X-style
   * posts, brief statements) has no separate title — there the whole text is
   * the headline, so it is scored as such rather than penalised for lacking
   * a field the platform never provides.
   */
  const SHORT_FORM_CHARS = 500;
  const title = context?.title ?? (text.length <= SHORT_FORM_CHARS ? text : "");

  /* ---------- agriculture evidence (title-weighted) ---------- */

  const bodyFamilies = AGRICULTURE_FAMILIES.filter((family) =>
    family.terms.some((term) => termMatches(text, term)),
  ).map((f) => f.id);
  const titleFamilies = title
    ? AGRICULTURE_FAMILIES.filter((family) =>
        family.terms.some((term) => termMatches(title, term)),
      ).map((f) => f.id)
    : [];

  let agricultureRelevance = 0;
  if (titleFamilies.length > 0) agricultureRelevance += 0.6;
  if (titleFamilies.length > 1) agricultureRelevance += 0.2;
  agricultureRelevance += Math.min(0.3, 0.15 * bodyFamilies.length);
  // An agriculture-dedicated source is itself weak topical evidence.
  if (sourceKind === "agriculture_programme") agricultureRelevance += 0.15;
  agricultureRelevance = Math.min(1, agricultureRelevance);

  /* ---------- Telangana evidence ---------- */

  const matchedDistricts = matchTerms(text, DISTRICTS).map((d) => d.id);
  const hasTelanganaMarker = termMatches(text, TELANGANA_MARKERS);
  const lower = text.toLowerCase();
  const outOfState = OUT_OF_STATE_MARKERS.filter((s) => lower.includes(s));
  const authorAnchored =
    authorContext.length > 0 &&
    (termMatches(authorContext, TELANGANA_MARKERS) ||
      matchTerms(authorContext, DISTRICTS).length > 0);
  // Telugu agriculture sources cover Telangana and Andhra Pradesh; treat them
  // as a weak regional prior and let the model decide which state applies.
  const regionalPrior =
    sourceKind === "agriculture_programme" || sourceKind === "creator";

  let telanganaRelevance = 0;
  if (hasTelanganaMarker) telanganaRelevance += 0.6;
  if (matchedDistricts.length > 0) telanganaRelevance += 0.5;
  if (authorAnchored) telanganaRelevance += 0.4;
  if (regionalPrior) telanganaRelevance += 0.4;
  if (outOfState.length > 0 && !hasTelanganaMarker && matchedDistricts.length === 0) {
    // Another state named and nothing anchoring this to Telangana: the
    // regional prior alone must not carry it over the bar.
    telanganaRelevance = Math.max(0, telanganaRelevance - 0.4);
  } else if (outOfState.length > 0) {
    /*
     * Named alongside explicit Telangana evidence, another state is weak
     * counter-evidence rather than a veto — inter-state comparison is the
     * normal register here. Krishna and Godavari water-sharing coverage
     * always names Andhra Pradesh and is exactly the reporting this system
     * exists to catch, so this penalty deliberately cannot push an item
     * that has a state marker or a district below the acceptance bar.
     */
    telanganaRelevance = Math.max(0, telanganaRelevance - 0.15);
  }
  telanganaRelevance = Math.min(1, telanganaRelevance);

  /* ---------- decision ---------- */

  const accepted = agricultureRelevance >= 0.5 && telanganaRelevance >= 0.4;

  const reasonParts: string[] = [];
  reasonParts.push(
    agricultureRelevance >= 0.5
      ? `Agriculture evidence: ${
          titleFamilies.length > 0 ? `in title [${titleFamilies.join(", ")}]` : "body only"
        }${bodyFamilies.length > 0 ? `, body [${bodyFamilies.join(", ")}]` : ""}${
          sourceKind === "agriculture_programme" ? ", agriculture-dedicated source" : ""
        }`
      : `Insufficient agriculture evidence (${
          bodyFamilies.length > 0
            ? `body-only mention of [${bodyFamilies.join(", ")}]`
            : "no agriculture terms"
        })`,
  );
  reasonParts.push(
    hasTelanganaMarker || matchedDistricts.length > 0 || authorAnchored || regionalPrior
      ? `Telangana evidence: ${[
          hasTelanganaMarker ? "state marker" : null,
          matchedDistricts.length > 0 ? `districts [${matchedDistricts.join(", ")}]` : null,
          authorAnchored ? "author anchored to Telangana" : null,
          regionalPrior && !hasTelanganaMarker && matchedDistricts.length === 0
            ? "Telugu-region agriculture source (regional prior — model confirms)"
            : null,
        ]
          .filter(Boolean)
          .join(", ")}`
      : "No Telangana marker, district or anchored source",
  );
  if (outOfState.length > 0) {
    reasonParts.push(`out-of-state markers [${outOfState.join(", ")}]`);
  }

  return {
    accepted,
    telanganaRelevance,
    agricultureRelevance,
    reason: reasonParts.join("; "),
    matchedDistricts,
  };
}
