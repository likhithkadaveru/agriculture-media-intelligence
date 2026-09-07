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

/**
 * How often a feed-based query becomes due again, in minutes.
 *
 * RSS and the Apify actors are polled on this: they are either free or billed
 * per run rather than against a shared allowance, so 30 minutes costs only
 * what the operator has already accepted.
 */
export const SCAN_MINUTES = 30;

/*
 * YouTube Data API cadences — set by arithmetic, not preference.
 *
 * The free allowance is 10,000 units/day and search.list costs 100, so the
 * whole day is 100 searches. Everything below has to fit in that or
 * collection simply stops partway through each day:
 *
 *   youtube-live   1 search/cycle x 48 cycles       = 48/day   4,800 units
 *   tier A         10 queries every 12h             = 20/day   2,000 units
 *   tier B         17 queries every 48h             = ~9/day     900 units
 *   tier C        264 queries every 14d             = ~19/day  1,900 units
 *                                                     ~96/day  ~9,600 units
 *
 * videos.list is 1 unit per call and rounds to nothing against that.
 *
 * Live watching is deliberately given half the budget: a stream is only
 * newsworthy while it is running, so a stale live check is worthless, whereas
 * a district query answered twelve hours late still gives the same answer.
 * Raising any of these needs a quota increase from Google first.
 */
const TIER_A_MINUTES = 12 * 60;
const TIER_B_MINUTES = 48 * 60;
const TIER_C_MINUTES = 14 * 24 * 60;

export interface GeneratedQuery {
  query: string;
  language: "te" | "en";
  tier: "a" | "b" | "c";
  priority: number;
  frequencyMinutes: number;
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
      frequencyMinutes: TIER_A_MINUTES,
      expectedNoise: "medium",
    });
  }

  for (const [query, language] of TIER_B) {
    queries.push({
      query,
      language,
      tier: "b",
      priority: 60,
      frequencyMinutes: TIER_B_MINUTES,
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
        frequencyMinutes: TIER_C_MINUTES,
        expectedNoise: "high",
      });
      if (district.te) {
        queries.push({
          query: `${issue.te} ${district.te}`,
          language: "te",
          tier: "c",
          priority: 20,
          frequencyMinutes: TIER_C_MINUTES,
          expectedNoise: "high",
        });
      }
    }
  }

  return queries;
}
