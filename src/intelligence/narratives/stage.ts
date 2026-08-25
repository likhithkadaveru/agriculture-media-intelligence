/**
 * Narrative stage v2 — derives narratives from the ontology over the
 * enriched pool, STRICTLY partitioned by data origin (live evidence and
 * demo_seed evidence can never meet inside one narrative), aggregates
 * evidence, computes trend status, and captures history-building snapshots.
 *
 * Counting rules (unchanged from Phase 1):
 * - canonical mentions count; duplicates are linked as role "duplicate" and
 *   never inflate any aggregate.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Db } from "@/db/client";
import {
  authors,
  mentions,
  narrativeMentions,
  narratives,
  narrativeSnapshots,
} from "@/db/schema";
import { recordEvent } from "@/lib/events";
import { computeTrendStatus, deriveNarratives } from "./definitions";

type MentionRow = typeof mentions.$inferSelect;

function increment(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

function buildExecutiveSummary(args: {
  canonical: MentionRow[];
  uniqueAuthors: number;
  districts: Record<string, number>;
  voiceMix: Record<string, number>;
  officialCount: number;
}): string {
  const { canonical, uniqueAuthors, districts, voiceMix, officialCount } = args;
  const districtNames = Object.keys(districts);
  const farmerish =
    (voiceMix["farmer"] ?? 0) + (voiceMix["farmer_organisation"] ?? 0) + (voiceMix["fpo"] ?? 0);
  const parts: string[] = [];
  parts.push(`${canonical.length} distinct public items from ${uniqueAuthors} independent authors`);
  if (districtNames.length > 0) {
    parts.push(`with district-level evidence in ${districtNames.join(", ")}`);
  }
  if (farmerish > 0) parts.push(`${farmerish} originate from farmer or farmer-organisation voices`);
  if (officialCount > 0) {
    parts.push(`${officialCount} official statement${officialCount > 1 ? "s" : ""} recorded`);
  }
  return parts.join("; ") + ".";
}

export interface NarrativeStageResult {
  narrativesUpdated: number;
  mentionsAssigned: number;
}

export async function runNarrativeStage(db: Db): Promise<NarrativeStageResult> {
  const pool = await db
    .select()
    .from(mentions)
    .where(
      and(
        eq(mentions.relevanceStatus, "accepted"),
        inArray(mentions.status, ["enriched", "duplicate", "narrative_assigned"]),
      ),
    );

  const authorRows = await db.select().from(authors);
  const authorById = new Map(authorRows.map((a) => [a.id, a]));

  let narrativesUpdated = 0;
  let mentionsAssigned = 0;

  // STRICT origin partitioning — one narrative never mixes origins.
  const origins = [...new Set(pool.map((m) => m.dataOrigin))];

  for (const origin of origins) {
    const originPool = pool.filter((m) => m.dataOrigin === origin);
    const byId = new Map(originPool.map((m) => [m.id, m]));

    const candidates = deriveNarratives(
      originPool.map((m) => ({
        id: m.id,
        status: m.status,
        topics: m.topics,
        subtopics: m.subtopics,
      })),
    );

    for (const candidate of candidates) {
      const matched = candidate.mentionIds
        .map((id) => byId.get(id))
        .filter((m): m is MentionRow => m !== undefined);
      const canonical = matched.filter((m) => m.status !== "duplicate");
      const duplicates = matched.filter((m) => m.status === "duplicate");
      if (canonical.length === 0) continue;

      const sourceMix: Record<string, number> = {};
      const voiceMix: Record<string, number> = {};
      const districts: Record<string, number> = {};
      const stanceSummary: Record<string, number> = {};
      const stanceByVoice: Record<string, Record<string, number>> = {};
      const authorKeys = new Set<string>();
      let officialCount = 0;
      let engagementViews = 0;
      let engagementLikes = 0;

      for (const m of canonical) {
        increment(sourceMix, m.platform);
        const author = m.authorId ? authorById.get(m.authorId) : undefined;
        const voice = author?.authorType ?? "unknown";
        increment(voiceMix, voice);
        if (m.isOfficialVoice) officialCount++;
        if (m.district) increment(districts, m.district);
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
        engagementViews += m.engagement?.views ?? 0;
        engagementLikes += m.engagement?.likes ?? 0;
      }

      const times = canonical
        .map((m) => m.publishedAt ?? m.collectedAt)
        .sort((a, b) => a.getTime() - b.getTime());
      const firstDetectedAt = times[0];
      const lastDetectedAt = times[times.length - 1];
      const trendStatus = computeTrendStatus(times, new Date());

      const executiveSummary = buildExecutiveSummary({
        canonical,
        uniqueAuthors: authorKeys.size,
        districts,
        voiceMix,
        officialCount,
      });

      const confidence = Math.min(
        0.95,
        0.3 + 0.05 * authorKeys.size + 0.08 * Object.keys(sourceMix).length,
      );

      const existing = await db
        .select()
        .from(narratives)
        .where(and(eq(narratives.key, candidate.key), eq(narratives.dataOrigin, origin)));

      const narrativeId = existing[0]?.id ?? randomUUID();
      const narrativeValues = {
        title: existing[0]?.explanation ? existing[0].title : candidate.title,
        executiveSummary,
        firstDetectedAt,
        lastDetectedAt,
        mentionCount: canonical.length,
        uniqueAuthorCount: authorKeys.size,
        sourceMix,
        voiceMix,
        districts,
        stanceSummary,
        stanceByVoice,
        trendStatus,
        confidence,
        updatedAt: new Date(),
      };
      if (existing.length > 0) {
        await db.update(narratives).set(narrativeValues).where(eq(narratives.id, narrativeId));
      } else {
        await db.insert(narratives).values({
          id: narrativeId,
          key: candidate.key,
          dataOrigin: origin,
          ...narrativeValues,
        });
      }

      for (const m of matched) {
        const role = m.status === "duplicate" ? "duplicate" : "evidence";
        const already = await db
          .select({ id: narrativeMentions.id })
          .from(narrativeMentions)
          .where(
            and(
              eq(narrativeMentions.narrativeId, narrativeId),
              eq(narrativeMentions.mentionId, m.id),
            ),
          );
        if (already.length === 0) {
          await db.insert(narrativeMentions).values({
            id: randomUUID(),
            narrativeId,
            mentionId: m.id,
            role,
            assignedBy: "rule",
          });
          mentionsAssigned++;
          await recordEvent(db, "NARRATIVE_ASSIGNED", {
            mentionId: m.id,
            narrativeId,
            detail: { role, assignedBy: "rule", narrativeKey: candidate.key },
          });
        }
        if (m.status === "enriched") {
          await db
            .update(mentions)
            .set({ status: "narrative_assigned", updatedAt: new Date() })
            .where(eq(mentions.id, m.id));
        }
      }

      // Snapshot — history for Phase 3 velocity/emerging-signal work.
      const [previousSnapshot] = await db
        .select()
        .from(narrativeSnapshots)
        .where(eq(narrativeSnapshots.narrativeId, narrativeId))
        .orderBy(desc(narrativeSnapshots.capturedAt))
        .limit(1);
      const previousCount =
        (previousSnapshot?.metrics as { mentionCount?: number } | undefined)?.mentionCount ?? 0;

      await db.insert(narrativeSnapshots).values({
        id: randomUUID(),
        narrativeId,
        capturedAt: new Date(),
        metrics: {
          mentionCount: canonical.length,
          duplicateCount: duplicates.length,
          uniqueAuthorCount: authorKeys.size,
          sourceMix,
          sourceTypeCount: Object.keys(sourceMix).length,
          voiceMix,
          districts,
          districtCount: Object.keys(districts).length,
          stanceSummary,
          stanceByVoice,
          engagement: { views: engagementViews, likes: engagementLikes },
          newMentionsSincePrevious: Math.max(0, canonical.length - previousCount),
          firstSeen: firstDetectedAt.toISOString(),
          lastSeen: lastDetectedAt.toISOString(),
          trendStatus,
          confidence,
        },
      });

      await recordEvent(db, "NARRATIVE_UPDATED", {
        narrativeId,
        detail: {
          key: candidate.key,
          origin,
          mentionCount: canonical.length,
          duplicateCount: duplicates.length,
          trendStatus,
        },
      });
      narrativesUpdated++;
    }
  }

  return { narrativesUpdated, mentionsAssigned };
}
