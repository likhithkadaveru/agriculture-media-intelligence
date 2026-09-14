/**
 * Finding generation — turns narrative aggregates into ranked NOW findings.
 *
 * Every finding carries named component metrics and a human-readable reason.
 * There is no opaque score: rank derives from a documented, transparent sum
 * of normalized components, all of which are stored and displayed.
 *
 * A finding describes a WINDOW, not a lifetime.
 *
 * Findings used to be computed from each narrative's cumulative totals. Once
 * search discovery started pulling in videos from 2017, the oldest, broadest
 * narratives passed every threshold by sheer accumulation, and the front page
 * became the five biggest piles rather than the five things that changed. A
 * wave of power-cut protests across five districts in one week sat unranked
 * below a bucket of years-old horticulture demonstrations.
 *
 * So every count below is over the last WINDOW_DAYS of evidence, and rank
 * includes how that week compares with the narrative's own recent past. A
 * narrative with no evidence in the window produces no finding at all — it is
 * still on its narrative page, it is just not "now".
 */
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Db } from "@/db/client";
import {
  authors,
  evidenceLinks,
  intelligenceFindings,
  mentions,
  narrativeMentions,
  narratives,
} from "@/db/schema";
import { recordEvent } from "@/lib/events";
import { seasonalUrgency } from "@/ontology/calendar";

import {
  BASELINE_WEEKS,
  WINDOW_DAYS,
  describeGrowth,
  trajectoryOf,
} from "./trajectory";

export { BASELINE_WEEKS, RISING_FACTOR, WINDOW_DAYS, describeGrowth, trajectoryOf } from "./trajectory";
export type { Trajectory } from "./trajectory";

const DAY = 24 * 3600 * 1000;

export interface FindingComponents {
  /** Canonical items inside the window. */
  mentionCount: number;
  independentVoices: number;
  districtCount: number;
  districts: string[];
  sourceTypeCount: number;
  sourceTypes: string[];
  officialVoicePresent: boolean;
  farmerOriginatedShare: number; // 0..1 among voiced mentions
  criticalShare: number; // 0..1 among stance-carrying canonical mentions
  divergenceObserved: boolean;
  governmentRelevant: boolean;
  duplicatesExcluded: number;
  /** Agricultural-calendar weighting — see ontology/calendar.ts. */
  seasonalMultiplier: number;
  seasonalReason: string | null;
  seasonalWindow: string | null;
  /** The window every count above describes. */
  windowDays: number;
  windowEnd: string; // ISO
  /** Canonical items per week across the BASELINE_WEEKS before the window. */
  baselineWeeklyRate: number;
  /** mentionCount ÷ baselineWeeklyRate; null when there is no baseline. */
  growthFactor: number | null;
  /** Everything the narrative has ever gathered, for context only. */
  lifetimeMentionCount: number;
}

/**
 * How much this week's volume moves the rank.
 *
 * Bounded like every other component: four times the baseline is as much
 * credit as a narrative can earn for growth, and one with no baseline at
 * all — new, or silent for a month — is treated as at that cap, because
 * something appearing from nothing is exactly the signal to surface.
 */
export function growthContribution(c: Pick<FindingComponents, "growthFactor">): number {
  const factor = c.growthFactor ?? 4;
  return Math.min(factor, 4) * 2.0;
}

/** Documented ranking: each component contributes a bounded, legible amount. */
export function rankScore(c: FindingComponents): number {
  return (
    Math.min(c.independentVoices, 10) * 1.0 +
    Math.min(c.districtCount, 5) * 2.0 +
    Math.min(c.sourceTypeCount, 5) * 1.5 +
    (c.divergenceObserved ? 4 : 0) +
    (c.governmentRelevant ? 2 : 0) +
    c.farmerOriginatedShare * 3 +
    growthContribution(c)
  ) * c.seasonalMultiplier;
}

export interface FindingStageResult {
  generated: number;
}

/** Only the columns the stage reads — mentions carry full texts, which cost transfer. */
interface LeanMention {
  id: string;
  status: string;
  dataOrigin: string;
  platform: string;
  authorId: string | null;
  district: string | null;
  stance: string | null;
  isOfficialVoice: boolean | null;
  publishedAt: Date | null;
  collectedAt: Date;
}

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

function evidenceTime(m: LeanMention): number {
  return (m.publishedAt ?? m.collectedAt).getTime();
}

export async function runFindingStage(
  db: Db,
  options: { now?: Date } = {},
): Promise<FindingStageResult> {
  const now = options.now ?? new Date();
  const allNarratives = await db.select().from(narratives);
  let generated = 0;
  if (allNarratives.length === 0) return { generated };

  const links = await db
    .select({
      narrativeId: narrativeMentions.narrativeId,
      mentionId: narrativeMentions.mentionId,
      role: narrativeMentions.role,
    })
    .from(narrativeMentions);
  const linksByNarrative = new Map<string, typeof links>();
  for (const link of links) {
    const list = linksByNarrative.get(link.narrativeId) ?? [];
    list.push(link);
    linksByNarrative.set(link.narrativeId, list);
  }

  const mentionRows: LeanMention[] = await db
    .select({
      id: mentions.id,
      status: mentions.status,
      dataOrigin: mentions.dataOrigin,
      platform: mentions.platform,
      authorId: mentions.authorId,
      district: mentions.district,
      stance: mentions.stance,
      isOfficialVoice: mentions.isOfficialVoice,
      publishedAt: mentions.publishedAt,
      collectedAt: mentions.collectedAt,
    })
    .from(mentions)
    .where(inArray(mentions.status, ["enriched", "duplicate", "narrative_assigned"]));
  const mentionById = new Map(mentionRows.map((m) => [m.id, m]));

  const authorRows = await db.select({ id: authors.id, authorType: authors.authorType }).from(authors);
  const authorTypeById = new Map(authorRows.map((a) => [a.id, a.authorType]));

  /*
   * The window closes at the newest evidence in that origin, not at the
   * clock. Live data makes no difference; a verified snapshot or the
   * development corpus would otherwise produce nothing at all a fortnight
   * after it was captured — and a snapshot's findings are meant to stay
   * reproducible.
   */
  const windowEndByOrigin = new Map<string, number>();
  for (const m of mentionRows) {
    if (m.status === "duplicate") continue;
    const t = Math.min(evidenceTime(m), now.getTime());
    windowEndByOrigin.set(m.dataOrigin, Math.max(windowEndByOrigin.get(m.dataOrigin) ?? 0, t));
  }

  const drafts: Array<{
    narrative: (typeof allNarratives)[number];
    category: "emerging" | "watch";
    components: FindingComponents;
    evidence: Array<{ mentionId: string; role: "supporting" | "official" | "duplicate" }>;
    headline: string;
    summary: string;
    whyItMatters: string;
    reason: string;
    confidence: number;
  }> = [];

  for (const narrative of allNarratives) {
    const windowEnd = windowEndByOrigin.get(narrative.dataOrigin);
    if (windowEnd === undefined) continue;
    const windowStart = windowEnd - WINDOW_DAYS * DAY;
    const baselineStart = windowStart - BASELINE_WEEKS * WINDOW_DAYS * DAY;

    const linked = (linksByNarrative.get(narrative.id) ?? [])
      .map((link) => ({ link, mention: mentionById.get(link.mentionId) }))
      .filter((x): x is { link: (typeof links)[number]; mention: LeanMention } => x.mention !== undefined);

    const inWindow = linked.filter(({ mention }) => {
      const t = evidenceTime(mention);
      return t > windowStart && t <= windowEnd;
    });
    const isDuplicate = ({ link, mention }: (typeof linked)[number]) =>
      link.role === "duplicate" || mention.status === "duplicate";
    const canonical = inWindow.filter((x) => !isDuplicate(x)).map((x) => x.mention);
    const duplicates = inWindow.filter(isDuplicate).map((x) => x.mention);
    if (canonical.length === 0) continue;

    const lifetimeCanonical = linked.filter((x) => !isDuplicate(x));
    const baselineCount = lifetimeCanonical.filter(({ mention }) => {
      const t = evidenceTime(mention);
      return t > baselineStart && t <= windowStart;
    }).length;
    const baselineWeeklyRate = baselineCount / BASELINE_WEEKS;
    const growthFactor = baselineCount === 0 ? null : canonical.length / baselineWeeklyRate;

    const sourceMix: Record<string, number> = {};
    const voiceMix: Record<string, number> = {};
    const districtMix: Record<string, number> = {};
    const stanceSummary: Record<string, number> = {};
    const stanceByVoice: Record<string, Record<string, number>> = {};
    const authorKeys = new Set<string>();
    for (const m of canonical) {
      increment(sourceMix, m.platform);
      const voice = (m.authorId ? authorTypeById.get(m.authorId) : undefined) ?? "unknown";
      increment(voiceMix, voice);
      if (m.district) increment(districtMix, m.district);
      if (m.stance) {
        increment(stanceSummary, m.stance);
        const voiceClass = m.isOfficialVoice
          ? "official"
          : voice === "media_organisation" || voice === "journalist"
            ? "media"
            : "public";
        stanceByVoice[voiceClass] = stanceByVoice[voiceClass] ?? {};
        increment(stanceByVoice[voiceClass], m.stance);
      }
      authorKeys.add(m.authorId ?? m.id);
    }
    // Strongest evidence first, so the three districts a summary names are
    // the three with the most items rather than whichever came first.
    const districts = Object.entries(districtMix)
      .sort((a, b) => b[1] - a[1])
      .map(([district]) => district);
    const sourceTypes = Object.keys(sourceMix);

    /*
     * Where the season stands changes how urgent the same issue is. The
     * narrative key carries its topic ("topic" or "topic/subtopic").
     */
    const narrativeTopic = narrative.key.split("/")[0];
    const seasonal = seasonalUrgency([narrativeTopic]);

    const voicedTotal = Object.values(voiceMix).reduce((a, b) => a + b, 0);
    const farmerOriginated =
      (voiceMix["farmer"] ?? 0) + (voiceMix["farmer_organisation"] ?? 0) + (voiceMix["fpo"] ?? 0);
    const stanceTotal = Object.values(stanceSummary).reduce((a, b) => a + b, 0);

    // Divergence: official voice leans supportive of the government position
    // while the public voice leans critical — computed, not asserted.
    const officialStances = stanceByVoice["official"] ?? {};
    const publicStances = stanceByVoice["public"] ?? {};
    const officialSupportive = (officialStances["supportive"] ?? 0) > 0;
    const publicTotal = Object.values(publicStances).reduce((a, b) => a + b, 0);
    const publicCriticalShare =
      publicTotal === 0 ? 0 : (publicStances["critical"] ?? 0) / publicTotal;
    const divergenceObserved = officialSupportive && publicCriticalShare >= 0.5;

    const components: FindingComponents = {
      mentionCount: canonical.length,
      independentVoices: authorKeys.size,
      districtCount: districts.length,
      districts,
      sourceTypeCount: sourceTypes.length,
      sourceTypes,
      officialVoicePresent: (voiceMix["government"] ?? 0) > 0,
      farmerOriginatedShare: voicedTotal === 0 ? 0 : farmerOriginated / voicedTotal,
      criticalShare: stanceTotal === 0 ? 0 : (stanceSummary["critical"] ?? 0) / stanceTotal,
      divergenceObserved,
      governmentRelevant: true, // every narrative concerns a government service area
      duplicatesExcluded: duplicates.length,
      seasonalMultiplier: seasonal.multiplier,
      seasonalReason: seasonal.reason,
      seasonalWindow: seasonal.windowLabel,
      windowDays: WINDOW_DAYS,
      windowEnd: new Date(windowEnd).toISOString(),
      baselineWeeklyRate,
      growthFactor,
      lifetimeMentionCount: lifetimeCanonical.length,
    };

    // Thresholds for finding categories — deliberately simple and legible,
    // and all counted inside the window.
    let category: "emerging" | "watch" | null = null;
    if (
      components.mentionCount >= 6 &&
      components.districtCount >= 2 &&
      components.sourceTypeCount >= 3
    ) {
      category = "emerging";
    } else if (components.mentionCount >= 2) {
      category = "watch";
    }
    if (!category) continue;

    const { headline, summary, whyItMatters, reason } = composeCopy(
      narrative.title,
      category,
      components,
    );

    const confidence = Math.min(
      0.9,
      0.35 + 0.04 * components.independentVoices + 0.06 * components.sourceTypeCount,
    );

    // Evidence is the window's evidence, duplicates marked as such. Older
    // items stay reachable on the narrative page.
    const evidence = [
      ...canonical.map((m) => ({
        mentionId: m.id,
        role: (m.isOfficialVoice ? "official" : "supporting") as "official" | "supporting",
      })),
      ...duplicates.map((m) => ({ mentionId: m.id, role: "duplicate" as const })),
    ];

    drafts.push({
      narrative,
      category,
      components,
      evidence,
      headline,
      summary,
      whyItMatters,
      reason,
      confidence,
    });
  }

  // Rank and persist. Ranking is PER DATA ORIGIN: findings from different
  // origins are never shown together, so a shared ranking would leave the
  // visible set starting at an arbitrary number.
  drafts.sort((a, b) => rankScore(b.components) - rankScore(a.components));

  for (const origin of new Set(allNarratives.map((n) => n.dataOrigin))) {
    if (!windowEndByOrigin.has(origin)) continue;
    await db
      .update(intelligenceFindings)
      .set({ status: "superseded" })
      .where(
        and(
          eq(intelligenceFindings.dataOrigin, origin),
          eq(intelligenceFindings.status, "active"),
        ),
      );
  }

  const rankByOrigin = new Map<string, number>();
  for (const draft of drafts) {
    const origin = draft.narrative.dataOrigin;
    const rank = (rankByOrigin.get(origin) ?? 0) + 1;
    rankByOrigin.set(origin, rank);

    const findingId = randomUUID();
    await db.insert(intelligenceFindings).values({
      id: findingId,
      narrativeId: draft.narrative.id,
      category: draft.category,
      headline: draft.headline,
      summary: draft.summary,
      whyItMatters: draft.whyItMatters,
      reason: draft.reason,
      components: draft.components,
      confidence: draft.confidence,
      rank,
      status: "active",
      generatedAt: new Date(),
      dataOrigin: origin,
    });

    for (const item of draft.evidence) {
      await db
        .insert(evidenceLinks)
        .values({ id: randomUUID(), findingId, mentionId: item.mentionId, role: item.role })
        .onConflictDoNothing();
    }

    await recordEvent(db, "FINDING_GENERATED", {
      findingId,
      narrativeId: draft.narrative.id,
      detail: { category: draft.category, rank, components: draft.components },
    });
    generated++;
  }

  return { generated };
}

function composeCopy(
  narrativeTitle: string,
  category: "emerging" | "watch",
  c: FindingComponents,
): { headline: string; summary: string; whyItMatters: string; reason: string } {
  /*
   * Three districts, then a count.
   *
   * Enumerating all thirteen inside a sentence produced a paragraph an
   * officer had to read to the end before learning anything, and the names
   * after the third carried almost no information — the useful facts are
   * where the evidence is strongest and how widely it has spread. Both
   * survive this form; the wall of names does not.
   */
  const NAMED_DISTRICTS = 3;
  const districtList =
    c.districts.length > NAMED_DISTRICTS
      ? `${c.districts.slice(0, NAMED_DISTRICTS).join(", ")} and ${
          c.districts.length - NAMED_DISTRICTS
        } more districts`
      : c.districts.join(", ");
  const voicesPhrase = `${c.independentVoices} independent voices across ${c.sourceTypeCount} source types`;
  const trajectory = trajectoryOf(c);
  const growth = describeGrowth(c);
  const windowPhrase = `in the past ${c.windowDays} days`;
  const seasonalNote =
    c.seasonalMultiplier !== 1
      ? ` Ranking weighted ×${c.seasonalMultiplier} by the agricultural calendar: ${c.seasonalReason}.`
      : "";

  if (category === "emerging") {
    const verb =
      trajectory === "resurfacing"
        ? "resurfacing"
        : trajectory === "steady" || trajectory === "falling"
          ? "continuing"
          : "rising";
    const headline = c.divergenceObserved
      ? `${narrativeTitle}: independent reports diverge from the official position`
      : `${narrativeTitle} ${verb} across ${c.districtCount} districts`;
    const summary = [
      `${voicesPhrase} report similar concerns ${windowPhrase}, ${growth}`,
      c.districtCount > 0 ? `with district-level evidence in ${districtList}` : null,
      c.farmerOriginatedShare > 0
        ? `${Math.round(c.farmerOriginatedShare * 100)}% of voiced items are farmer-originated`
        : null,
      c.divergenceObserved
        ? "official statements describe the situation as under control while public reports describe local problems"
        : null,
    ]
      .filter(Boolean)
      .join("; ") + ".";
    const whyItMatters = [
      c.seasonalReason ? `${c.seasonalReason}.` : null,
      c.divergenceObserved
        ? "When independent farmer reports and official positioning diverge, leadership attention and field verification are usually warranted before the gap widens in public discussion."
        : trajectory === "steady" || trajectory === "falling"
          ? "Sustained multi-district, multi-source coverage of a service-delivery topic keeps it on the Agriculture Department's operational radar."
          : "Multi-district, multi-source growth in a service-delivery topic is an early operational signal for the Agriculture Department.",
    ]
      .filter(Boolean)
      .join(" ");
    const reason =
      `Generated because ${windowPhrase} the narrative had ${c.mentionCount} distinct items (duplicates excluded: ${c.duplicatesExcluded}), ${c.districtCount} districts and ${c.sourceTypeCount} source types — thresholds for an emerging signal (≥6 items, ≥2 districts, ≥3 source types, all counted inside the window). ` +
      `This week is ${growth}; ${c.lifetimeMentionCount} items in total sit on the narrative page, and older ones do not count here.` +
      seasonalNote;
    return { headline, summary, whyItMatters, reason };
  }

  const headline = `${narrativeTitle}: early signals worth watching`;
  const summary =
    `${voicesPhrase} ${windowPhrase}, ${growth}` +
    (c.districtCount > 0 ? `, currently concentrated in ${districtList}` : "") +
    ". Volume is below the emerging-signal threshold.";
  const whyItMatters = [
    c.seasonalReason ? `${c.seasonalReason}.` : null,
    "Low-volume but consistent signals are tracked so growth or geographic spread is caught early.",
  ]
    .filter(Boolean)
    .join(" ");
  const reason =
    `Generated as a watch item: ${c.mentionCount} distinct items ${windowPhrase} (≥2 required), below the emerging thresholds. ` +
    `This week is ${growth}; ${c.lifetimeMentionCount} items in total sit on the narrative page.` +
    seasonalNote;
  return { headline, summary, whyItMatters, reason };
}
