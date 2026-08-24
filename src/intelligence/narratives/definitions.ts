/**
 * Phase 1 narrative definitions — deterministic, rule-based assignment.
 *
 * The `matches` predicate operates on enriched mention fields only. The
 * narrative stage is written against this interface so that a future
 * embedding/LLM clustering engine can replace the rule set (assigned_by =
 * "model") without changing aggregation, snapshots, findings or UI.
 */

export interface EnrichedMentionLike {
  topics: string[];
  subtopics: string[];
  schemes: string[];
  crops: string[];
}

export interface NarrativeDefinition {
  key: string;
  title: string;
  matches(mention: EnrichedMentionLike): boolean;
}

export const NARRATIVE_DEFINITIONS: NarrativeDefinition[] = [
  {
    key: "dap-availability",
    title: "DAP / fertilizer availability concerns",
    matches: (m) => m.topics.includes("fertilizer-availability"),
  },
  {
    key: "rainfall-deficit",
    title: "Rainfall deficit and paddy transplantation",
    matches: (m) =>
      m.topics.includes("rainfall") && !m.topics.includes("fertilizer-availability"),
  },
  {
    key: "procurement-payments",
    title: "Paddy procurement payment delays",
    matches: (m) =>
      m.topics.includes("procurement") && !m.topics.includes("fertilizer-availability"),
  },
];
