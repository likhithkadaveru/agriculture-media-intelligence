/**
 * Ontology-driven collection-query generation with priority tiers.
 *
 * Tier A — every cycle: core Telangana agriculture terms (en + te).
 * Tier B — rotated: major crops/issues × Telangana.
 * Tier C — long-tail: issue × district combinations, slow rotation.
 *
 * Combinatorial explosion is controlled: Tier C pairs only the highest-value
 * issue topics with districts, and the scheduler rotates by next_run_at
 * rather than executing everything each cycle.
 */
import { DISTRICTS } from "./districts";

export interface GeneratedQuery {
  query: string;
  language: "te" | "en";
  tier: "a" | "b" | "c";
  priority: number;
  frequencyHours: number;
  expectedNoise: "low" | "medium" | "high";
}

const TIER_A: Array<[string, "te" | "en"]> = [
  ["Telangana agriculture", "en"],
  ["తెలంగాణ వ్యవసాయం", "te"],
  ["Telangana farmers", "en"],
  ["తెలంగాణ రైతులు", "te"],
  ["Rythu Bharosa", "en"],
  ["రైతు భరోసా", "te"],
  ["DAP Telangana", "en"],
  ["డీఏపీ తెలంగాణ", "te"],
  ["urea Telangana", "en"],
  ["యూరియా తెలంగాణ", "te"],
];

const TIER_B: Array<[string, "te" | "en"]> = [
  ["paddy Telangana farmers", "en"],
  ["వరి రైతులు తెలంగాణ", "te"],
  ["cotton Telangana farmers", "en"],
  ["పత్తి రైతులు తెలంగాణ", "te"],
  ["maize Telangana", "en"],
  ["fertilizer shortage Telangana", "en"],
  ["ఎరువుల కొరత తెలంగాణ", "te"],
  ["paddy procurement Telangana", "en"],
  ["ధాన్యం కొనుగోలు తెలంగాణ", "te"],
  ["rainfall Telangana farmers", "en"],
  ["వర్షాలు తెలంగాణ రైతులు", "te"],
  ["crop damage Telangana", "en"],
  ["పంట నష్టం తెలంగాణ", "te"],
  ["agricultural electricity Telangana", "en"],
  ["వ్యవసాయ కరెంటు తెలంగాణ", "te"],
  ["రుణమాఫీ తెలంగాణ రైతులు", "te"],
  ["మిర్చి ధర తెలంగాణ", "te"],
];

/** Highest-value issues for district-level long-tail queries. */
const TIER_C_ISSUES: Array<{ en: string; te: string }> = [
  { en: "fertilizer", te: "ఎరువులు" },
  { en: "paddy procurement", te: "ధాన్యం కొనుగోలు" },
  { en: "crop damage", te: "పంట నష్టం" },
  { en: "rain farmers", te: "వర్షం రైతులు" },
];

export function generateCollectionQueries(): GeneratedQuery[] {
  const queries: GeneratedQuery[] = [];

  for (const [query, language] of TIER_A) {
    queries.push({
      query,
      language,
      tier: "a",
      priority: 100,
      frequencyHours: 6,
      expectedNoise: "medium",
    });
  }

  for (const [query, language] of TIER_B) {
    queries.push({
      query,
      language,
      tier: "b",
      priority: 60,
      frequencyHours: 24,
      expectedNoise: "medium",
    });
  }

  for (const issue of TIER_C_ISSUES) {
    for (const district of DISTRICTS) {
      queries.push({
        query: `${issue.en} ${district.en}`,
        language: "en",
        tier: "c",
        priority: 20,
        frequencyHours: 24 * 7,
        expectedNoise: "high",
      });
      if (district.te) {
        queries.push({
          query: `${issue.te} ${district.te}`,
          language: "te",
          tier: "c",
          priority: 20,
          frequencyHours: 24 * 7,
          expectedNoise: "high",
        });
      }
    }
  }

  return queries;
}
