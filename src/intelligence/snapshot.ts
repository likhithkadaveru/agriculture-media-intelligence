/**
 * Verified snapshot creation.
 *
 * Copies the current LIVE intelligence state into a parallel set of rows
 * carrying data_origin = 'verified_snapshot'. Live rows are never mutated
 * and never deleted: the snapshot is an independent, self-consistent copy
 * that keeps every source URL, collected timestamp, classification,
 * narrative, finding, evidence link and processing-metadata field intact,
 * so a demonstration reproduces exactly what the system concluded.
 *
 * Raw items are copied too, so provenance ("open the raw payload") still
 * resolves inside the snapshot.
 */
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Db } from "@/db/client";
import {
  authors,
  collectionRuns,
  evidenceLinks,
  intelligenceFindings,
  mentions,
  narrativeMentions,
  narratives,
  narrativeSnapshots,
  processingEvents,
  rawItems,
  verifiedSnapshots,
} from "@/db/schema";

export interface SnapshotManifest {
  label: string;
  createdAt: string;
  sourceOrigin: "live";
  counts: Record<string, number>;
  sources: string[];
  evidenceTimeRange: { earliest: string | null; latest: string | null };
  narrativeKeys: string[];
}

export interface SnapshotResult {
  snapshotId: string;
  manifest: SnapshotManifest;
}

export async function createVerifiedSnapshot(
  db: Db,
  label: string,
  log: (message: string) => void = () => {},
): Promise<SnapshotResult> {
  // 1. Gather the live state.
  const liveMentions = await db.select().from(mentions).where(eq(mentions.dataOrigin, "live"));
  if (liveMentions.length === 0) {
    throw new Error("No live mentions to snapshot. Run the live pipeline first.");
  }
  const liveNarratives = await db
    .select()
    .from(narratives)
    .where(eq(narratives.dataOrigin, "live"));
  const liveFindings = await db
    .select()
    .from(intelligenceFindings)
    .where(eq(intelligenceFindings.dataOrigin, "live"));

  // 2. Retire any previous snapshot copy so exactly one is active.
  const previous = await db
    .select()
    .from(verifiedSnapshots)
    .where(eq(verifiedSnapshots.status, "active"));
  if (previous.length > 0) {
    log(`replacing ${previous.length} previous snapshot(s)`);
    const oldNarratives = await db
      .select({ id: narratives.id })
      .from(narratives)
      .where(eq(narratives.dataOrigin, "verified_snapshot"));
    const oldFindings = await db
      .select({ id: intelligenceFindings.id })
      .from(intelligenceFindings)
      .where(eq(intelligenceFindings.dataOrigin, "verified_snapshot"));
    const oldMentions = await db
      .select({ id: mentions.id })
      .from(mentions)
      .where(eq(mentions.dataOrigin, "verified_snapshot"));
    const oldRaw = await db
      .select({ id: rawItems.id })
      .from(rawItems)
      .where(eq(rawItems.dataOrigin, "verified_snapshot"));
    const oldRuns = await db
      .select({ id: collectionRuns.id })
      .from(collectionRuns)
      .where(eq(collectionRuns.dataOrigin, "verified_snapshot"));

    if (oldFindings.length > 0) {
      await db.delete(evidenceLinks).where(
        inArray(evidenceLinks.findingId, oldFindings.map((f) => f.id)),
      );
      await db
        .delete(intelligenceFindings)
        .where(eq(intelligenceFindings.dataOrigin, "verified_snapshot"));
    }
    if (oldNarratives.length > 0) {
      const ids = oldNarratives.map((n) => n.id);
      await db.delete(narrativeMentions).where(inArray(narrativeMentions.narrativeId, ids));
      await db.delete(narrativeSnapshots).where(inArray(narrativeSnapshots.narrativeId, ids));
      await db.delete(narratives).where(eq(narratives.dataOrigin, "verified_snapshot"));
    }
    if (oldMentions.length > 0) {
      await db
        .delete(processingEvents)
        .where(inArray(processingEvents.mentionId, oldMentions.map((m) => m.id)));
      await db.delete(mentions).where(eq(mentions.dataOrigin, "verified_snapshot"));
    }
    if (oldRaw.length > 0) {
      await db.delete(rawItems).where(eq(rawItems.dataOrigin, "verified_snapshot"));
    }
    if (oldRuns.length > 0) {
      await db.delete(collectionRuns).where(eq(collectionRuns.dataOrigin, "verified_snapshot"));
    }
    await db.delete(authors).where(eq(authors.dataOrigin, "verified_snapshot"));
    await db
      .update(verifiedSnapshots)
      .set({ status: "replaced" })
      .where(eq(verifiedSnapshots.status, "active"));
  }

  // 3. Copy with fresh ids, preserving all content and provenance fields.
  const runIdMap = new Map<string, string>();
  const rawIdMap = new Map<string, string>();
  const authorIdMap = new Map<string, string>();
  const mentionIdMap = new Map<string, string>();
  const narrativeIdMap = new Map<string, string>();

  const liveRunIds = [...new Set((await db
    .select({ id: collectionRuns.id })
    .from(collectionRuns)
    .where(eq(collectionRuns.dataOrigin, "live"))).map((r) => r.id))];
  for (const runId of liveRunIds) {
    const [run] = await db.select().from(collectionRuns).where(eq(collectionRuns.id, runId));
    const newId = randomUUID();
    runIdMap.set(run.id, newId);
    await db.insert(collectionRuns).values({
      ...run,
      id: newId,
      dataOrigin: "verified_snapshot",
    });
  }

  const liveRaw = await db.select().from(rawItems).where(eq(rawItems.dataOrigin, "live"));
  for (const raw of liveRaw) {
    const newId = randomUUID();
    rawIdMap.set(raw.id, newId);
    await db.insert(rawItems).values({
      ...raw,
      id: newId,
      collectionRunId: runIdMap.get(raw.collectionRunId) ?? raw.collectionRunId,
      dataOrigin: "verified_snapshot",
    });
  }

  const liveAuthors = await db.select().from(authors).where(eq(authors.dataOrigin, "live"));
  for (const author of liveAuthors) {
    const newId = randomUUID();
    authorIdMap.set(author.id, newId);
    await db.insert(authors).values({
      ...author,
      id: newId,
      dataOrigin: "verified_snapshot",
    });
  }

  for (const mention of liveMentions) {
    const newId = randomUUID();
    mentionIdMap.set(mention.id, newId);
  }
  for (const mention of liveMentions) {
    await db.insert(mentions).values({
      ...mention,
      id: mentionIdMap.get(mention.id)!,
      rawItemId: rawIdMap.get(mention.rawItemId) ?? mention.rawItemId,
      authorId: mention.authorId ? (authorIdMap.get(mention.authorId) ?? null) : null,
      duplicateOfMentionId: mention.duplicateOfMentionId
        ? (mentionIdMap.get(mention.duplicateOfMentionId) ?? null)
        : null,
      dataOrigin: "verified_snapshot",
    });
  }

  for (const narrative of liveNarratives) {
    const newId = randomUUID();
    narrativeIdMap.set(narrative.id, newId);
    await db.insert(narratives).values({
      ...narrative,
      id: newId,
      dataOrigin: "verified_snapshot",
    });
    const links = await db
      .select()
      .from(narrativeMentions)
      .where(eq(narrativeMentions.narrativeId, narrative.id));
    for (const link of links) {
      await db.insert(narrativeMentions).values({
        ...link,
        id: randomUUID(),
        narrativeId: newId,
        mentionId: mentionIdMap.get(link.mentionId) ?? link.mentionId,
      });
    }
    const snaps = await db
      .select()
      .from(narrativeSnapshots)
      .where(eq(narrativeSnapshots.narrativeId, narrative.id));
    for (const snap of snaps) {
      await db.insert(narrativeSnapshots).values({
        ...snap,
        id: randomUUID(),
        narrativeId: newId,
      });
    }
  }

  for (const finding of liveFindings) {
    const newFindingId = randomUUID();
    await db.insert(intelligenceFindings).values({
      ...finding,
      id: newFindingId,
      narrativeId: narrativeIdMap.get(finding.narrativeId) ?? finding.narrativeId,
      dataOrigin: "verified_snapshot",
    });
    const links = await db
      .select()
      .from(evidenceLinks)
      .where(eq(evidenceLinks.findingId, finding.id));
    for (const link of links) {
      await db.insert(evidenceLinks).values({
        ...link,
        id: randomUUID(),
        findingId: newFindingId,
        mentionId: mentionIdMap.get(link.mentionId) ?? link.mentionId,
      });
    }
  }

  // Processing events keep the provenance trail intact inside the snapshot.
  const liveEvents = await db
    .select()
    .from(processingEvents)
    .where(inArray(processingEvents.mentionId, liveMentions.map((m) => m.id)));
  for (const event of liveEvents) {
    await db.insert(processingEvents).values({
      ...event,
      id: randomUUID(),
      mentionId: event.mentionId ? (mentionIdMap.get(event.mentionId) ?? null) : null,
      rawItemId: event.rawItemId ? (rawIdMap.get(event.rawItemId) ?? null) : null,
      narrativeId: event.narrativeId ? (narrativeIdMap.get(event.narrativeId) ?? null) : null,
      collectionRunId: event.collectionRunId
        ? (runIdMap.get(event.collectionRunId) ?? null)
        : null,
    });
  }

  const publishedTimes = liveMentions
    .map((m) => m.publishedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const manifest: SnapshotManifest = {
    label,
    createdAt: new Date().toISOString(),
    sourceOrigin: "live",
    counts: {
      collectionRuns: liveRunIds.length,
      rawItems: liveRaw.length,
      authors: liveAuthors.length,
      mentions: liveMentions.length,
      acceptedMentions: liveMentions.filter((m) => m.relevanceStatus === "accepted").length,
      narratives: liveNarratives.length,
      findings: liveFindings.length,
      processingEvents: liveEvents.length,
    },
    sources: [...new Set(liveMentions.map((m) => m.platform))],
    evidenceTimeRange: {
      earliest: publishedTimes[0]?.toISOString() ?? null,
      latest: publishedTimes[publishedTimes.length - 1]?.toISOString() ?? null,
    },
    narrativeKeys: liveNarratives.map((n) => n.key),
  };

  const snapshotId = randomUUID();
  await db.insert(verifiedSnapshots).values({
    id: snapshotId,
    label,
    manifest,
    status: "active",
  });

  log(
    `snapshot "${label}": ${manifest.counts.mentions} mentions, ${manifest.counts.narratives} narratives, ${manifest.counts.findings} findings`,
  );
  return { snapshotId, manifest };
}
