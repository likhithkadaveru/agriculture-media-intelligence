/**
 * Read-model queries for the UI. Server components call these; they never
 * run pipeline logic. All reads are against precomputed narrative/finding
 * aggregates — never live aggregation over raw items.
 */
import { asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  authors,
  evidenceLinks,
  intelligenceFindings,
  mentions,
  narratives,
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
  const narrativeRows = await db.select({ id: narratives.id }).from(narratives);
  const findingRows = await db
    .select({ generatedAt: intelligenceFindings.generatedAt })
    .from(intelligenceFindings)
    .where(eq(intelligenceFindings.status, "active"))
    .orderBy(desc(intelligenceFindings.generatedAt));

  return {
    origins: [...new Set(mentionRows.map((m) => m.dataOrigin))],
    totalMentions: mentionRows.length,
    relevantMentions: mentionRows.filter((m) => m.relevanceStatus === "accepted").length,
    narrativeCount: narrativeRows.length,
    activeFindingCount: findingRows.length,
    lastGeneratedAt: findingRows[0]?.generatedAt ?? null,
  };
}

export interface FindingWithNarrative {
  finding: FindingRow;
  narrative: NarrativeRow;
  evidenceCount: number;
}

export async function getActiveFindings(db: Db): Promise<FindingWithNarrative[]> {
  const findingRows = await db
    .select()
    .from(intelligenceFindings)
    .where(eq(intelligenceFindings.status, "active"))
    .orderBy(asc(intelligenceFindings.rank));
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

  const linkRoleByMention = new Map(links.map((l) => [l.mentionId, l.role]));

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

  const evidence: EvidenceItem[] = sorted.map((mention) => ({
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

  return { finding, narrative, evidence };
}
