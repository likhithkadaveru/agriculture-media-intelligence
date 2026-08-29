/**
 * Finding generation — turns narrative aggregates into ranked NOW findings.
 *
 * Every finding carries named component metrics and a human-readable reason.
 * There is no opaque score: rank derives from a documented, transparent sum
 * of normalized components, all of which are stored and displayed.
 */
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Db } from "@/db/client";
import {
  evidenceLinks,
  intelligenceFindings,
  mentions,
  narrativeMentions,
  narratives,
} from "@/db/schema";
import { recordEvent } from "@/lib/events";
import { seasonalUrgency } from "@/ontology/calendar";

export interface FindingComponents {
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
}

/** Documented ranking: each component contributes a bounded, legible amount. */
export function rankScore(c: FindingComponents): number {
  return (
    Math.min(c.independentVoices, 10) * 1.0 +
    Math.min(c.districtCount, 5) * 2.0 +
    Math.min(c.sourceTypeCount, 5) * 1.5 +
    (c.divergenceObserved ? 4 : 0) +
    (c.governmentRelevant ? 2 : 0) +
    c.farmerOriginatedShare * 3
  ) * c.seasonalMultiplier;
}

export interface FindingStageResult {
  generated: number;
}

export async function runFindingStage(db: Db): Promise<FindingStageResult> {
  const allNarratives = await db.select().from(narratives);
  let generated = 0;

  const drafts: Array<{
    narrative: (typeof allNarratives)[number];
    category: "emerging" | "watch";
    components: FindingComponents;
    headline: string;
    summary: string;
    whyItMatters: string;
    reason: string;
    confidence: number;
  }> = [];

  for (const narrative of allNarratives) {
    const voiceMix = narrative.voiceMix;
    const stanceSummary = narrative.stanceSummary;
    const stanceByVoice = narrative.stanceByVoice;
    const districts = Object.keys(narrative.districts);
    const sourceTypes = Object.keys(narrative.sourceMix);

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
      mentionCount: narrative.mentionCount,
      independentVoices: narrative.uniqueAuthorCount,
      districtCount: districts.length,
      districts,
      sourceTypeCount: sourceTypes.length,
      sourceTypes,
      officialVoicePresent: (voiceMix["government"] ?? 0) > 0,
      farmerOriginatedShare: voicedTotal === 0 ? 0 : farmerOriginated / voicedTotal,
      criticalShare: stanceTotal === 0 ? 0 : (stanceSummary["critical"] ?? 0) / stanceTotal,
      divergenceObserved,
      governmentRelevant: true, // every narrative concerns a government service area
      duplicatesExcluded: 0, // filled below
      seasonalMultiplier: seasonal.multiplier,
      seasonalReason: seasonal.reason,
      seasonalWindow: seasonal.windowLabel,
    };

    const dupLinks = await db
      .select()
      .from(narrativeMentions)
      .where(
        and(
          eq(narrativeMentions.narrativeId, narrative.id),
          eq(narrativeMentions.role, "duplicate"),
        ),
      );
    components.duplicatesExcluded = dupLinks.length;

    // Thresholds for finding categories — deliberately simple and legible.
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

    drafts.push({
      narrative,
      category,
      components,
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

  for (const origin of new Set(drafts.map((d) => d.narrative.dataOrigin))) {
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

    // Evidence links: every narrative mention, duplicates marked as such.
    const links = await db
      .select()
      .from(narrativeMentions)
      .where(eq(narrativeMentions.narrativeId, draft.narrative.id));
    for (const link of links) {
      const [mention] = await db
        .select({ isOfficialVoice: mentions.isOfficialVoice })
        .from(mentions)
        .where(eq(mentions.id, link.mentionId));
      await db
        .insert(evidenceLinks)
        .values({
          id: randomUUID(),
          findingId,
          mentionId: link.mentionId,
          role:
            link.role === "duplicate"
              ? "duplicate"
              : mention?.isOfficialVoice
                ? "official"
                : "supporting",
        })
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
  const districtList = c.districts.join(", ");
  const voicesPhrase = `${c.independentVoices} independent voices across ${c.sourceTypeCount} source types`;

  if (category === "emerging") {
    const headline = c.divergenceObserved
      ? `${narrativeTitle}: independent reports diverge from the official position`
      : `${narrativeTitle} rising across ${c.districtCount} districts`;
    const summary = [
      `${voicesPhrase} report similar concerns`,
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
        : "Multi-district, multi-source growth in a service-delivery topic is an early operational signal for the Agriculture Department.",
    ]
      .filter(Boolean)
      .join(" ");
    const reason =
      `Generated because the narrative reached ${c.mentionCount} distinct items (duplicates excluded: ${c.duplicatesExcluded}), ${c.districtCount} districts and ${c.sourceTypeCount} source types — thresholds for an emerging signal (≥6 items, ≥2 districts, ≥3 source types).` +
      (c.seasonalMultiplier !== 1
        ? ` Ranking weighted ×${c.seasonalMultiplier} by the agricultural calendar: ${c.seasonalReason}.`
        : "");
    return { headline, summary, whyItMatters, reason };
  }

  const headline = `${narrativeTitle}: early signals worth watching`;
  const summary =
    `${voicesPhrase}` +
    (c.districtCount > 0 ? `, currently concentrated in ${districtList}` : "") +
    ". Volume is below the emerging-signal threshold.";
  const whyItMatters = [
    c.seasonalReason ? `${c.seasonalReason}.` : null,
    "Low-volume but consistent signals are tracked so growth or geographic spread is caught early.",
  ]
    .filter(Boolean)
    .join(" ");
  const reason =
    `Generated as a watch item: ${c.mentionCount} distinct items (≥2 required), below the emerging thresholds.` +
    (c.seasonalMultiplier !== 1
      ? ` Ranking weighted ×${c.seasonalMultiplier} by the agricultural calendar: ${c.seasonalReason}.`
      : "");
  return { headline, summary, whyItMatters, reason };
}
