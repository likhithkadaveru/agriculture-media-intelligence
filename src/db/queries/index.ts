/**
 * Read-model queries for the UI. Server components call these; they never
 * run pipeline logic. All reads are against precomputed narrative/finding
 * aggregates — never live aggregation over raw items.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  authors,
  evidenceLinks,
  intelligenceFindings,
  mentions,
  narrativeMentions,
  narratives,
  narrativeSnapshots,
  processingEvents,
  rawItems,
} from "@/db/schema";

export type FindingRow = typeof intelligenceFindings.$inferSelect;
export type NarrativeRow = typeof narratives.$inferSelect;
export type MentionRow = typeof mentions.$inferSelect;
export type AuthorRow = typeof authors.$inferSelect;
export type EventRow = typeof processingEvents.$inferSelect;

export interface EnvironmentInfo {
  /** Distinct data origins present among mentions. */
  origins: string[];
  /**
   * The environment label shown in the UI, computed from the lineage of the
   * ACTIVE FINDINGS (not from what happens to sit in the database):
   * live evidence → LIVE PUBLIC DATA, snapshot → VERIFIED SNAPSHOT,
   * seed → DEVELOPMENT DATA.
   */
  activeOrigin: "live" | "verified_snapshot" | "demo_seed" | null;
  totalMentions: number;
  relevantMentions: number;
  narrativeCount: number;
  activeFindingCount: number;
  lastGeneratedAt: Date | null;
}

export async function getEnvironmentInfo(db: Db): Promise<EnvironmentInfo> {
  const mentionRows = await db
    .select({ dataOrigin: mentions.dataOrigin, relevanceStatus: mentions.relevanceStatus })
    .from(mentions);
  const narrativeRows = await db
    .select({ id: narratives.id, dataOrigin: narratives.dataOrigin })
    .from(narratives);
  const findingRows = await db
    .select({
      generatedAt: intelligenceFindings.generatedAt,
      dataOrigin: intelligenceFindings.dataOrigin,
    })
    .from(intelligenceFindings)
    .where(eq(intelligenceFindings.status, "active"))
    .orderBy(desc(intelligenceFindings.generatedAt));

  // Environment label follows the findings actually on screen. Live evidence
  // wins over a snapshot, which wins over development data.
  const findingOrigins = new Set(findingRows.map((f) => f.dataOrigin));
  const activeOrigin = findingOrigins.has("live")
    ? "live"
    : findingOrigins.has("verified_snapshot")
      ? "verified_snapshot"
      : findingOrigins.has("demo_seed")
        ? "demo_seed"
        : null;

  return {
    origins: [...new Set(mentionRows.map((m) => m.dataOrigin))],
    activeOrigin,
    totalMentions: mentionRows.length,
    relevantMentions: mentionRows.filter(
      (m) => m.relevanceStatus === "accepted" && (!activeOrigin || m.dataOrigin === activeOrigin),
    ).length,
    narrativeCount: narrativeRows.filter((n) => !activeOrigin || n.dataOrigin === activeOrigin)
      .length,
    activeFindingCount: findingRows.filter((f) => f.dataOrigin === activeOrigin).length,
    lastGeneratedAt: findingRows[0]?.generatedAt ?? null,
  };
}

export interface FindingWithNarrative {
  finding: FindingRow;
  narrative: NarrativeRow;
  evidenceCount: number;
}

/**
 * Active findings for NOW, restricted to a single data origin. Once a
 * verified snapshot exists alongside live data, both carry active findings;
 * showing them together would mix evidence lineages in one view, so the
 * caller passes the origin the environment resolved to.
 */
export async function getActiveFindings(
  db: Db,
  activeOrigin: string | null,
): Promise<FindingWithNarrative[]> {
  const allActive = await db
    .select()
    .from(intelligenceFindings)
    .where(eq(intelligenceFindings.status, "active"))
    .orderBy(asc(intelligenceFindings.rank));
  const findingRows = activeOrigin
    ? allActive.filter((f) => f.dataOrigin === activeOrigin)
    : allActive;
  if (findingRows.length === 0) return [];

  const narrativeIds = findingRows.map((f) => f.narrativeId);
  const narrativeRows = await db
    .select()
    .from(narratives)
    .where(inArray(narratives.id, narrativeIds));
  const narrativeById = new Map(narrativeRows.map((n) => [n.id, n]));

  const links = await db
    .select({ findingId: evidenceLinks.findingId })
    .from(evidenceLinks)
    .where(inArray(evidenceLinks.findingId, findingRows.map((f) => f.id)));
  const evidenceCounts = new Map<string, number>();
  for (const link of links) {
    evidenceCounts.set(link.findingId, (evidenceCounts.get(link.findingId) ?? 0) + 1);
  }

  return findingRows
    .filter((f) => narrativeById.has(f.narrativeId))
    .map((finding) => ({
      finding,
      narrative: narrativeById.get(finding.narrativeId)!,
      evidenceCount: evidenceCounts.get(finding.id) ?? 0,
    }));
}

export interface NarrativeListItem {
  narrative: NarrativeRow;
  evidenceCount: number;
  /** Active finding for this narrative, when one exists. */
  findingId: string | null;
}

/** Narratives for the Narratives surface, restricted to the active origin. */
export async function getNarratives(
  db: Db,
  activeOrigin: string | null,
): Promise<NarrativeListItem[]> {
  const rows = await db
    .select()
    .from(narratives)
    .orderBy(desc(narratives.mentionCount));
  const scoped = activeOrigin ? rows.filter((n) => n.dataOrigin === activeOrigin) : rows;
  if (scoped.length === 0) return [];

  const links = await db
    .select({ narrativeId: narrativeMentions.narrativeId, role: narrativeMentions.role })
    .from(narrativeMentions)
    .where(inArray(narrativeMentions.narrativeId, scoped.map((n) => n.id)));
  const counts = new Map<string, number>();
  for (const link of links) {
    counts.set(link.narrativeId, (counts.get(link.narrativeId) ?? 0) + 1);
  }

  const findingRows = await db
    .select({ id: intelligenceFindings.id, narrativeId: intelligenceFindings.narrativeId })
    .from(intelligenceFindings)
    .where(eq(intelligenceFindings.status, "active"));
  const findingByNarrative = new Map(findingRows.map((f) => [f.narrativeId, f.id]));

  return scoped.map((narrative) => ({
    narrative,
    evidenceCount: counts.get(narrative.id) ?? 0,
    findingId: findingByNarrative.get(narrative.id) ?? null,
  }));
}

export interface NarrativeDetail {
  narrative: NarrativeRow;
  evidence: EvidenceItem[];
  claims: { claim: string; confidence: number | null; mentionId: string; authorType: string }[];
  timeline: { date: string; count: number }[];
  findingId: string | null;
  snapshots: { capturedAt: Date; metrics: Record<string, unknown> }[];
}

export async function getNarrativeDetail(
  db: Db,
  narrativeId: string,
): Promise<NarrativeDetail | null> {
  const [narrative] = await db.select().from(narratives).where(eq(narratives.id, narrativeId));
  if (!narrative) return null;

  const links = await db
    .select()
    .from(narrativeMentions)
    .where(eq(narrativeMentions.narrativeId, narrativeId));
  const evidence =
    links.length > 0
      ? await buildEvidenceItems(
          db,
          links.map((l) => ({ mentionId: l.mentionId, role: l.role })),
        )
      : [];

  const claims = evidence
    .filter((item) => item.mention.claim)
    .map((item) => ({
      claim: item.mention.claim!,
      confidence: item.mention.claimConfidence,
      mentionId: item.mention.id,
      authorType: item.author?.authorType ?? "unknown",
    }));

  // Daily timeline over canonical evidence.
  const dayCounts = new Map<string, number>();
  for (const item of evidence) {
    const when = item.mention.publishedAt ?? item.mention.collectedAt;
    const key = when.toISOString().slice(0, 10);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }
  const timeline = [...dayCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  const [finding] = await db
    .select({ id: intelligenceFindings.id })
    .from(intelligenceFindings)
    .where(
      and(
        eq(intelligenceFindings.narrativeId, narrativeId),
        eq(intelligenceFindings.status, "active"),
      ),
    );

  const snapshotRows = await db
    .select()
    .from(narrativeSnapshots)
    .where(eq(narrativeSnapshots.narrativeId, narrativeId))
    .orderBy(asc(narrativeSnapshots.capturedAt));

  return {
    narrative,
    evidence,
    claims,
    timeline,
    findingId: finding?.id ?? null,
    snapshots: snapshotRows.map((s) => ({
      capturedAt: s.capturedAt,
      metrics: s.metrics as Record<string, unknown>,
    })),
  };
}

export interface EvidenceItem {
  mention: MentionRow;
  author: AuthorRow | null;
  linkRole: string;
  events: EventRow[];
  rawItemCreatedAt: Date | null;
  /** Duplicates of this canonical mention (empty for duplicates themselves). */
  duplicates: { mention: MentionRow; author: AuthorRow | null }[];
}

export interface FindingDetail {
  finding: FindingRow;
  narrative: NarrativeRow;
  evidence: EvidenceItem[];
}

export async function getFindingDetail(db: Db, findingId: string): Promise<FindingDetail | null> {
  const [finding] = await db
    .select()
    .from(intelligenceFindings)
    .where(eq(intelligenceFindings.id, findingId));
  if (!finding) return null;

  const [narrative] = await db
    .select()
    .from(narratives)
    .where(eq(narratives.id, finding.narrativeId));
  if (!narrative) return null;

  const links = await db
    .select()
    .from(evidenceLinks)
    .where(eq(evidenceLinks.findingId, findingId));
  if (links.length === 0) return { finding, narrative, evidence: [] };

  const evidence = await buildEvidenceItems(
    db,
    links.map((l) => ({ mentionId: l.mentionId, role: l.role })),
  );
  return { finding, narrative, evidence };
}

/**
 * Shared evidence assembly: hydrates mentions with authors, processing
 * events and raw-item provenance, nests duplicates under their canonical
 * item, and orders public voices before official ones.
 */
async function buildEvidenceItems(
  db: Db,
  links: { mentionId: string; role: string }[],
): Promise<EvidenceItem[]> {
  if (links.length === 0) return [];
  const mentionIds = links.map((l) => l.mentionId);
  const mentionRows = await db.select().from(mentions).where(inArray(mentions.id, mentionIds));
  const mentionById = new Map(mentionRows.map((m) => [m.id, m]));

  const authorIds = mentionRows.map((m) => m.authorId).filter((x): x is string => x !== null);
  const authorRows = authorIds.length
    ? await db.select().from(authors).where(inArray(authors.id, authorIds))
    : [];
  const authorById = new Map(authorRows.map((a) => [a.id, a]));

  const eventRows = await db
    .select()
    .from(processingEvents)
    .where(inArray(processingEvents.mentionId, mentionIds))
    .orderBy(asc(processingEvents.createdAt));
  const eventsByMention = new Map<string, EventRow[]>();
  for (const event of eventRows) {
    if (!event.mentionId) continue;
    const list = eventsByMention.get(event.mentionId) ?? [];
    list.push(event);
    eventsByMention.set(event.mentionId, list);
  }

  const rawRows = await db
    .select({ id: rawItems.id, createdAt: rawItems.createdAt })
    .from(rawItems)
    .where(inArray(rawItems.id, mentionRows.map((m) => m.rawItemId)));
  const rawById = new Map(rawRows.map((r) => [r.id, r]));

  const linkRoleByMention = new Map(links.map((l) => [l.mentionId, l.role] as const));

  // Group duplicates under their canonical mention.
  const duplicatesByCanonical = new Map<string, MentionRow[]>();
  const canonicalMentions: MentionRow[] = [];
  for (const m of mentionRows) {
    if (m.status === "duplicate" && m.duplicateOfMentionId && mentionById.has(m.duplicateOfMentionId)) {
      const list = duplicatesByCanonical.get(m.duplicateOfMentionId) ?? [];
      list.push(m);
      duplicatesByCanonical.set(m.duplicateOfMentionId, list);
    } else {
      canonicalMentions.push(m);
    }
  }

  // Order: official voices last (so public evidence leads), newest first within groups.
  const sorted = canonicalMentions.sort((a, b) => {
    if (a.isOfficialVoice !== b.isOfficialVoice) return a.isOfficialVoice ? 1 : -1;
    const at = a.publishedAt?.getTime() ?? 0;
    const bt = b.publishedAt?.getTime() ?? 0;
    return bt - at;
  });

  return sorted.map((mention) => ({
    mention,
    author: mention.authorId ? (authorById.get(mention.authorId) ?? null) : null,
    linkRole: linkRoleByMention.get(mention.id) ?? "supporting",
    events: eventsByMention.get(mention.id) ?? [],
    rawItemCreatedAt: rawById.get(mention.rawItemId)?.createdAt ?? null,
    duplicates: (duplicatesByCanonical.get(mention.id) ?? []).map((dup) => ({
      mention: dup,
      author: dup.authorId ? (authorById.get(dup.authorId) ?? null) : null,
    })),
  }));
}
