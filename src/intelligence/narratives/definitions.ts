/**
 * Narrative derivation — Phase 2 hybrid model.
 *
 * Narratives are derived from the ontology topic/subtopic structure over the
 * enriched mention pool (per data origin):
 *
 * - A subtopic with enough distinct evidence becomes its own narrative
 *   (e.g. fertilizer-availability/dap-availability vs
 *   fertilizer-availability/fertilizer-price stay separate).
 * - Remaining topic-level mentions form a base topic narrative.
 * - A mention with several topics can evidence several narratives.
 *
 * Deterministic titles come from the ontology; when an LLM adjudicator is
 * available it may refine title/synthesis (see adjudicate.ts), with the
 * deterministic output always present as fallback. Assignment is recorded
 * as assigned_by = "rule"; a future clustering engine uses "model".
 */
import { TOPICS } from "@/ontology";

export interface PoolMention {
  id: string;
  status: string; // enriched | duplicate | narrative_assigned
  topics: string[];
  subtopics: string[];
}

export interface NarrativeCandidate {
  key: string;
  title: string;
  topicId: string;
  subtopicId: string | null;
  /** All matched mentions, including duplicates (roles decided by caller). */
  mentionIds: string[];
  canonicalCount: number;
}

/** Minimum distinct (non-duplicate) items for a subtopic to stand alone. */
const MIN_SUBTOPIC_CANONICAL = 3;
/** Minimum distinct items for a base topic narrative. */
const MIN_TOPIC_CANONICAL = 2;

/** Editorial titles where the bare subtopic label lacks context. */
const TITLE_OVERRIDES: Record<string, string> = {
  "payment-delay": "Procurement payment delays",
  "msp-demand": "MSP and support-price demands",
  "black-market-sales": "Fertilizer sales above MRP",
  "rythu-bharosa-payment": "Rythu Bharosa payments",
  "dap-availability": "DAP availability",
  "urea-availability": "Urea availability",
};

export function deriveNarratives(pool: PoolMention[]): NarrativeCandidate[] {
  const candidates: NarrativeCandidate[] = [];

  for (const topic of TOPICS) {
    const topicMentions = pool.filter((m) => m.topics.includes(topic.id));
    if (topicMentions.length === 0) continue;

    const claimed = new Set<string>();

    for (const subtopic of topic.subtopics ?? []) {
      const subMentions = topicMentions.filter((m) => m.subtopics.includes(subtopic.id));
      const canonical = subMentions.filter((m) => m.status !== "duplicate");
      if (canonical.length < MIN_SUBTOPIC_CANONICAL) continue;
      candidates.push({
        key: `${topic.id}/${subtopic.id}`,
        title: TITLE_OVERRIDES[subtopic.id] ?? subtopic.en,
        topicId: topic.id,
        subtopicId: subtopic.id,
        mentionIds: subMentions.map((m) => m.id),
        canonicalCount: canonical.length,
      });
      for (const m of subMentions) claimed.add(m.id);
    }

    const remaining = topicMentions.filter((m) => !claimed.has(m.id));
    const remainingCanonical = remaining.filter((m) => m.status !== "duplicate");
    if (remainingCanonical.length >= MIN_TOPIC_CANONICAL) {
      candidates.push({
        key: topic.id,
        title: topic.en,
        topicId: topic.id,
        subtopicId: null,
        mentionIds: remaining.map((m) => m.id),
        canonicalCount: remainingCanonical.length,
      });
    }
  }

  return candidates;
}

export type TrendStatus = "emerging" | "rising" | "stable" | "falling" | "resurfacing";

/**
 * Observation-window trend status (Phase 2: no historical baseline yet).
 * Windows are over published timestamps relative to `now`.
 */
export function computeTrendStatus(publishedTimes: Date[], now: Date): TrendStatus {
  if (publishedTimes.length === 0) return "stable";
  const sorted = [...publishedTimes].sort((a, b) => a.getTime() - b.getTime());
  const DAY = 24 * 3600 * 1000;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const recent = sorted.filter((t) => now.getTime() - t.getTime() <= 2 * DAY).length;
  const previous = sorted.filter((t) => {
    const age = now.getTime() - t.getTime();
    return age > 2 * DAY && age <= 4 * DAY;
  }).length;

  // First evidence inside the recent window → the narrative itself is new.
  if (now.getTime() - first.getTime() <= 2 * DAY) return "emerging";

  // Quiet gap of ≥7 days immediately before the most recent burst.
  if (recent > 0) {
    const beforeRecent = sorted.filter((t) => now.getTime() - t.getTime() > 2 * DAY);
    if (beforeRecent.length > 0) {
      const gap = last.getTime() - beforeRecent[beforeRecent.length - 1].getTime();
      if (gap >= 7 * DAY) return "resurfacing";
    }
  }

  if (previous === 0 && recent === 0) return "stable";
  if (recent >= Math.max(2, previous * 1.5) && recent > previous) return "rising";
  if (previous > 0 && recent <= previous * 0.5) return "falling";
  return "stable";
}
