/**
 * Read-model queries for the UI. Server components call these; they never
 * run pipeline logic. All reads are against precomputed narrative/finding
 * aggregates — never live aggregation over raw items.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { DISTRICTS } from "@/ontology";
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

/** District display name (lowercased) → ontology id, for map joins. */
const DISTRICT_NAME_TO_ID: [string, string][] = DISTRICTS.map((d) => [d.en.toLowerCase(), d.id]);

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
    .select({
      dataOrigin: mentions.dataOrigin,
      relevanceStatus: mentions.relevanceStatus,
      status: mentions.status,
    })
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
    /*
     * Duplicates excluded so this is the same population the coverage tabs
     * count. It previously included them, so the standing band said 541 while
     * the tab beside it said 511 — two true numbers describing two different
     * things, with nothing on screen saying so.
     */
    relevantMentions: mentionRows.filter(
      (m) =>
        m.relevanceStatus === "accepted" &&
        m.status !== "duplicate" &&
        (!activeOrigin || m.dataOrigin === activeOrigin),
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

export interface MediaItem {
  id: string;
  title: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  channel: string | null;
  authorType: string;
  publishedAt: Date | null;
  language: string | null;
  englishTranslation: string | null;
  district: string | null;
  locationConfidence: number | null;
  topics: string[];
  engagement: {
    views?: number | null;
    likes?: number | null;
    comments?: number | null;
    reposts?: number | null;
  } | null;
  claim: string | null;
  narrativeTitle: string | null;
  /** Stance toward government — drives the concerns/positive lens. */
  stance: string | null;
}

/**
 * Collected media for the media carousel: relevance-accepted items that
 * carry a thumbnail, newest first, scoped to the active data origin so the
 * strip never mixes live footage with development or snapshot content.
 */
export async function getMediaItems(
  db: Db,
  activeOrigin: string | null,
  limit = 24,
): Promise<MediaItem[]> {
  const rows = await db
    .select()
    .from(mentions)
    .where(eq(mentions.relevanceStatus, "accepted"))
    .orderBy(desc(mentions.publishedAt));

  const scoped = rows
    .filter((m) => (activeOrigin ? m.dataOrigin === activeOrigin : true))
    .filter((m) => m.status !== "duplicate" && m.thumbnailUrl)
    .slice(0, limit);
  if (scoped.length === 0) return [];

  const authorIds = scoped.map((m) => m.authorId).filter((x): x is string => x !== null);
  const authorRows = authorIds.length
    ? await db.select().from(authors).where(inArray(authors.id, authorIds))
    : [];
  const authorById = new Map(authorRows.map((a) => [a.id, a]));

  // Narrative membership, so each card can say what conversation it belongs to.
  const links = await db
    .select()
    .from(narrativeMentions)
    .where(inArray(narrativeMentions.mentionId, scoped.map((m) => m.id)));
  const narrativeRows = links.length
    ? await db
        .select()
        .from(narratives)
        .where(inArray(narratives.id, links.map((l) => l.narrativeId)))
    : [];
  const narrativeById = new Map(narrativeRows.map((n) => [n.id, n]));
  const narrativeByMention = new Map<string, string>();
  for (const link of links) {
    const narrative = narrativeById.get(link.narrativeId);
    if (narrative && !narrativeByMention.has(link.mentionId)) {
      narrativeByMention.set(link.mentionId, narrative.title);
    }
  }

  return scoped.map((m) => {
    const author = m.authorId ? authorById.get(m.authorId) : undefined;
    return {
      id: m.id,
      title: m.title,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      channel: author?.name ?? null,
      authorType: author?.authorType ?? "unknown",
      publishedAt: m.publishedAt,
      language: m.language,
      englishTranslation: m.englishTranslation,
      district: m.district,
      locationConfidence: m.locationConfidence,
      topics: m.topics,
      engagement: m.engagement,
      claim: m.claim,
      narrativeTitle: narrativeByMention.get(m.id) ?? null,
      stance: m.stance,
    };
  });
}

export interface BriefItem {
  kind: "attention" | "escalating" | "positive" | "watch";
  findingId: string | null;
  narrativeId: string;
  headline: string;
  line: string;
  districts: string[];
  voices: number;
  seasonalReason: string | null;
  trendStatus: string | null;
  /**
   * Ontology topic id, from the narrative key's first segment.
   *
   * Carried so the interface can offer verification steps written for that
   * topic. Checking dealer stock is the right first move on a fertiliser
   * signal and the wrong one on a rainfall signal.
   */
  topic: string | null;
}

export interface MorningBrief {
  generatedAt: Date | null;
  activeOrigin: string | null;
  /** Season context so the brief opens with where the crop cycle stands. */
  items: BriefItem[];
  positives: BriefItem[];
  totals: { items: number; narratives: number; districts: number };
}

/**
 * The 07:00 brief — the five things an officer should know, assembled from
 * already-computed findings rather than re-analysing anything.
 *
 * Ordering is deliberate: what needs attention, then what is moving, then
 * what is going well. A brief that only ever carries bad news is one that
 * stops being opened.
 */
export async function getMorningBrief(
  db: Db,
  activeOrigin: string | null,
): Promise<MorningBrief> {
  const findings = await getActiveFindings(db, activeOrigin);

  const toItem = (
    f: FindingWithNarrative,
    kind: BriefItem["kind"],
  ): BriefItem => {
    const c = f.finding.components as {
      districts?: string[];
      independentVoices?: number;
      seasonalReason?: string | null;
    };
    return {
      kind,
      findingId: f.finding.id,
      narrativeId: f.narrative.id,
      headline: f.narrative.title,
      line: f.finding.summary,
      districts: c.districts ?? [],
      voices: c.independentVoices ?? 0,
      seasonalReason: c.seasonalReason ?? null,
      trendStatus: f.narrative.trendStatus,
      // Narrative keys are "topic/subtopic"; the topic is what steps key on.
      topic: f.narrative.key?.split("/")[0] ?? null,
    };
  };

  const items: BriefItem[] = [];
  const positives: BriefItem[] = [];

  for (const f of findings) {
    const stance = f.narrative.stanceSummary;
    const total = Object.values(stance).reduce((a, b) => a + b, 0);
    const criticalShare = total === 0 ? 0 : (stance["critical"] ?? 0) / total;
    const supportiveShare = total === 0 ? 0 : (stance["supportive"] ?? 0) / total;

    // A narrative read mostly positively belongs in the good-news column,
    // not buried among problems.
    if (supportiveShare >= 0.5 && criticalShare < 0.25) {
      positives.push(toItem(f, "positive"));
      continue;
    }
    const trend = f.narrative.trendStatus;
    const kind: BriefItem["kind"] =
      f.finding.category === "emerging"
        ? "attention"
        : trend === "rising" || trend === "emerging"
          ? "escalating"
          : "watch";
    items.push(toItem(f, kind));
  }

  const order: Record<BriefItem["kind"], number> = {
    attention: 0,
    escalating: 1,
    watch: 2,
    positive: 3,
  };
  items.sort((a, b) => order[a.kind] - order[b.kind]);

  const districts = new Set<string>();
  for (const f of findings) Object.keys(f.narrative.districts).forEach((d) => districts.add(d));

  return {
    generatedAt: findings[0]?.finding.generatedAt ?? null,
    activeOrigin,
    items: items.slice(0, 5),
    positives: positives.slice(0, 3),
    totals: {
      items: findings.reduce((sum, f) => sum + f.narrative.mentionCount, 0),
      narratives: findings.length,
      districts: districts.size,
    },
  };
}

export interface DistrictSignal {
  key: string;
  name: string;
  nameTe: string | null;
  mentionCount: number;
  voices: number;
  topics: { topic: string; count: number }[];
  criticalShare: number;
  narratives: { id: string; title: string; count: number }[];
}

export interface DistrictOverview {
  districts: DistrictSignal[];
  /** Items whose location could not be evidenced — shown, never distributed. */
  unlocatedCount: number;
  locatedCount: number;
}

/**
 * District-level signal for the state map.
 *
 * Counts come from enriched mentions that carry an evidenced district. Items
 * without location evidence are reported as a separate figure and never
 * apportioned across districts to make the map look complete.
 */
export async function getDistrictOverview(
  db: Db,
  activeOrigin: string | null,
): Promise<DistrictOverview> {
  const rows = await db
    .select()
    .from(mentions)
    .where(eq(mentions.relevanceStatus, "accepted"));

  const scoped = rows.filter(
    (m) => (!activeOrigin || m.dataOrigin === activeOrigin) && m.status !== "duplicate",
  );

  const links = await db.select().from(narrativeMentions);
  const narrativeRows = await db.select().from(narratives);
  const narrativeById = new Map(narrativeRows.map((n) => [n.id, n]));
  const narrativesByMention = new Map<string, string[]>();
  for (const l of links) {
    if (l.role === "duplicate") continue;
    const list = narrativesByMention.get(l.mentionId) ?? [];
    list.push(l.narrativeId);
    narrativesByMention.set(l.mentionId, list);
  }

  const byDistrict = new Map<string, DistrictSignal & { authorIds: Set<string> }>();
  let unlocated = 0;

  for (const m of scoped) {
    if (!m.district) {
      unlocated++;
      continue;
    }
    const key = m.district.toLowerCase().replace(/\s+/g, "-");
    let entry = byDistrict.get(key);
    if (!entry) {
      entry = {
        key,
        name: m.district,
        nameTe: null,
        mentionCount: 0,
        voices: 0,
        topics: [],
        criticalShare: 0,
        narratives: [],
        authorIds: new Set<string>(),
      };
      byDistrict.set(key, entry);
    }
    entry.mentionCount++;
    entry.authorIds.add(m.authorId ?? m.id);

    for (const topic of m.topics) {
      const t = entry.topics.find((x) => x.topic === topic);
      if (t) t.count++;
      else entry.topics.push({ topic, count: 1 });
    }
    for (const nid of narrativesByMention.get(m.id) ?? []) {
      const narrative = narrativeById.get(nid);
      if (!narrative) continue;
      const n = entry.narratives.find((x) => x.id === nid);
      if (n) n.count++;
      else entry.narratives.push({ id: nid, title: narrative.title, count: 1 });
    }
  }

  // Critical share per district, computed over stance-carrying items.
  for (const [key, entry] of byDistrict) {
    const districtItems = scoped.filter(
      (m) => m.district && m.district.toLowerCase().replace(/\s+/g, "-") === key,
    );
    const stanced = districtItems.filter((m) => m.stance);
    entry.criticalShare =
      stanced.length === 0
        ? 0
        : stanced.filter((m) => m.stance === "critical").length / stanced.length;
    entry.voices = entry.authorIds.size;
    entry.topics.sort((a, b) => b.count - a.count);
    entry.narratives.sort((a, b) => b.count - a.count);
  }

  // Drop the internal author set before returning the read model.
  const districts: DistrictSignal[] = [...byDistrict.values()]
    .map((entry) => {
      const { authorIds, ...rest } = entry;
      void authorIds;
      return rest;
    })
    .sort((a, b) => b.mentionCount - a.mentionCount);

  return {
    districts,
    unlocatedCount: unlocated,
    locatedCount: scoped.length - unlocated,
  };
}

export interface CommandView {
  env: EnvironmentInfo;
  brief: MorningBrief;
  findings: FindingWithNarrative[];
  districts: DistrictOverview;
  media: MediaItem[];
  /** Aggregate voice and source composition across everything on screen. */
  voiceMix: Record<string, number>;
  sourceMix: Record<string, number>;
}

/**
 * Everything the command screen needs, in one pass.
 *
 * Senior officers do not browse. The product therefore has one operational
 * surface and one evidence surface; this assembles the first so the page can
 * render without stitching six calls together.
 */
export async function getCommandView(db: Db): Promise<CommandView> {
  const env = await getEnvironmentInfo(db);
  const [brief, findings, districts, media] = await Promise.all([
    getMorningBrief(db, env.activeOrigin),
    getActiveFindings(db, env.activeOrigin),
    getDistrictOverview(db, env.activeOrigin),
    getMediaItems(db, env.activeOrigin, 20),
  ]);

  // Counted per distinct mention, not summed across findings — see above.
  const { voiceMix, sourceMix } = await getCompositionMix(db, env.activeOrigin);

  return { env, brief, findings, districts, media, voiceMix, sourceMix };
}

export interface CoverageRow {
  id: string;
  name: string;
  nameTe: string | null;
  total: number;
  favourable: number;
  unfavourable: number;
  neutral: number;
  balance: number;
  topTopic: string | null;
  narrativeId: string | null;
}

/**
 * Coverage balance per district, for the state map.
 *
 * "Favourable" and "unfavourable" are read from the stance the enrichment
 * stage already assigned — supportive and critical respectively — not from a
 * separate sentiment pass. Neutral factual reporting counts as neither, which
 * is why the three figures are reported separately rather than collapsed
 * into a single score.
 */
export async function getCoverageByDistrict(
  db: Db,
  activeOrigin: string | null,
): Promise<CoverageRow[]> {
  const rows = await db
    .select()
    .from(mentions)
    .where(eq(mentions.relevanceStatus, "accepted"));
  const scoped = rows.filter(
    (m) => (!activeOrigin || m.dataOrigin === activeOrigin) && m.status !== "duplicate" && m.district,
  );

  const links = await db.select().from(narrativeMentions);
  const narrativeByMention = new Map<string, string>();
  for (const l of links) {
    if (l.role !== "duplicate" && !narrativeByMention.has(l.mentionId)) {
      narrativeByMention.set(l.mentionId, l.narrativeId);
    }
  }

  const nameToId = new Map(DISTRICT_NAME_TO_ID);
  const acc = new Map<string, CoverageRow & { topics: Map<string, number> }>();

  for (const m of scoped) {
    const id = nameToId.get(m.district!.toLowerCase());
    if (!id) continue;
    let e = acc.get(id);
    if (!e) {
      e = {
        id,
        name: m.district!,
        nameTe: null,
        total: 0,
        favourable: 0,
        unfavourable: 0,
        neutral: 0,
        balance: 0,
        topTopic: null,
        narrativeId: null,
        topics: new Map(),
      };
      acc.set(id, e);
    }
    e.total++;
    if (m.stance === "critical") e.unfavourable++;
    else if (m.stance === "supportive") e.favourable++;
    else e.neutral++;
    for (const t of m.topics) e.topics.set(t, (e.topics.get(t) ?? 0) + 1);
    if (!e.narrativeId) e.narrativeId = narrativeByMention.get(m.id) ?? null;
  }

  return [...acc.values()].map((e) => {
    const directional = e.favourable + e.unfavourable;
    const { topics, ...rest } = e;
    const top = [...topics.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      ...rest,
      topTopic: top ? top[0] : null,
      // Balance is over directional items only: a district reported factually
      // is not "neutral-positive", it simply has no directional signal.
      balance: directional === 0 ? 0 : (e.favourable - e.unfavourable) / directional,
    };
  });
}

export interface CoverageItem {
  id: string;
  headline: string | null;
  translation: string | null;
  url: string | null;
  outlet: string | null;
  platform: string;
  publishedAt: Date | null;
  language: string | null;
  district: string | null;
  stance: string | null;
  /** protest | rally | meeting | ... — null for an ordinary report. */
  eventType: string | null;
  topics: string[];
  narrativeId: string | null;
  narrativeTitle: string | null;
}

/**
 * Press and broadcast coverage — the clippings digest.
 *
 * Separate from the media strip on purpose. The strip is visual and works
 * for video; written coverage is scanned, not looked at, so it wants a
 * dense list an officer can run an eye down.
 */
/**
 * How many accepted items exist in each stance, and per district.
 *
 * Separate from getCoverageFeed on purpose. That returns a recent WINDOW for
 * display; these are counts over the whole corpus. Deriving the tab counts
 * from the window made the screen contradict itself — the totals panel said
 * 52 unfavourable while the tab beside it said 6, because 6 was simply how
 * many of the last 30 items happened to be unfavourable. Worse, tapping a
 * district could show nothing at all while the map showed nineteen items
 * there, since none were recent enough to be in the window.
 *
 * "mixed" is grouped with unfavourable to match the command screen's lens:
 * it carries criticism, and an officer scanning for problems should see it.
 */
export interface CoverageCounts {
  unfavourable: number;
  factual: number;
  favourable: number;
  all: number;
  /** The same four counts, per district name. */
  byDistrict: Record<string, { unfavourable: number; factual: number; favourable: number; all: number }>;
}

/**
 * Voice and source composition, counted once per item.
 *
 * These used to be summed across findings, so a mention belonging to three
 * narratives was counted three times: the composition strips reported 858
 * items while the standing band above reported 541. Both were arithmetically
 * correct and they described different things, which on a page an official
 * is asked to trust is worse than either being wrong.
 *
 * Counting distinct mentions is also the only denominator that makes the
 * derived percentages mean anything — "1% farmer-originated" is a different
 * claim depending on whether its base double-counts the widely-covered
 * narratives, which are exactly the ones least likely to originate with a
 * farmer.
 */
export async function getCompositionMix(
  db: Db,
  activeOrigin: string | null,
): Promise<{ voiceMix: Record<string, number>; sourceMix: Record<string, number> }> {
  const rows = await db
    .select({
      platform: mentions.platform,
      authorType: authors.authorType,
      dataOrigin: mentions.dataOrigin,
      status: mentions.status,
    })
    .from(mentions)
    .leftJoin(authors, eq(authors.id, mentions.authorId))
    .where(eq(mentions.relevanceStatus, "accepted"));

  const voiceMix: Record<string, number> = {};
  const sourceMix: Record<string, number> = {};
  for (const r of rows) {
    if (activeOrigin && r.dataOrigin !== activeOrigin) continue;
    if (r.status === "duplicate") continue;
    const voice = r.authorType ?? "unknown";
    voiceMix[voice] = (voiceMix[voice] ?? 0) + 1;
    sourceMix[r.platform] = (sourceMix[r.platform] ?? 0) + 1;
  }
  return { voiceMix, sourceMix };
}

export async function getCoverageCounts(
  db: Db,
  activeOrigin: string | null,
): Promise<CoverageCounts> {
  const rows = await db
    .select({
      stance: mentions.stance,
      district: mentions.district,
      dataOrigin: mentions.dataOrigin,
      status: mentions.status,
    })
    .from(mentions)
    .where(eq(mentions.relevanceStatus, "accepted"));

  const empty = () => ({ unfavourable: 0, factual: 0, favourable: 0, all: 0 });
  const out: CoverageCounts = { ...empty(), byDistrict: {} };

  for (const m of rows) {
    if (activeOrigin && m.dataOrigin !== activeOrigin) continue;
    if (m.status === "duplicate") continue;
    const bucket =
      m.stance === "critical" || m.stance === "mixed"
        ? "unfavourable"
        : m.stance === "supportive"
          ? "favourable"
          : m.stance === "neutral"
            ? "factual"
            : null;
    out.all++;
    if (bucket) out[bucket]++;
    if (m.district) {
      const d = (out.byDistrict[m.district] ??= empty());
      d.all++;
      if (bucket) d[bucket]++;
    }
  }
  return out;
}

export async function getCoverageFeed(
  db: Db,
  activeOrigin: string | null,
  limit = 30,
): Promise<CoverageItem[]> {
  const rows = await db
    .select()
    .from(mentions)
    .where(eq(mentions.relevanceStatus, "accepted"))
    .orderBy(desc(mentions.publishedAt));

  const scoped = rows
    .filter((m) => (!activeOrigin || m.dataOrigin === activeOrigin) && m.status !== "duplicate")
    .slice(0, limit);
  if (scoped.length === 0) return [];

  const authorIds = scoped.map((m) => m.authorId).filter((x): x is string => x !== null);
  const authorRows = authorIds.length
    ? await db.select().from(authors).where(inArray(authors.id, authorIds))
    : [];
  const authorById = new Map(authorRows.map((a) => [a.id, a]));

  const links = await db
    .select()
    .from(narrativeMentions)
    .where(inArray(narrativeMentions.mentionId, scoped.map((m) => m.id)));
  const narrativeRows = links.length
    ? await db
        .select()
        .from(narratives)
        .where(inArray(narratives.id, links.map((l) => l.narrativeId)))
    : [];
  const narrativeById = new Map(narrativeRows.map((n) => [n.id, n]));
  const byMention = new Map<string, string>();
  for (const l of links) {
    if (l.role !== "duplicate" && !byMention.has(l.mentionId)) byMention.set(l.mentionId, l.narrativeId);
  }

  return scoped.map((m) => {
    const nid = byMention.get(m.id) ?? null;
    return {
      id: m.id,
      headline: m.title ?? m.originalText.split("\n")[0].slice(0, 160),
      translation: m.englishTranslation,
      url: m.url,
      outlet: m.authorId ? (authorById.get(m.authorId)?.name ?? null) : null,
      platform: m.platform,
      publishedAt: m.publishedAt,
      language: m.language,
      district: m.district,
      stance: m.stance,
      eventType: m.eventType,
      topics: m.topics,
      narrativeId: nid,
      narrativeTitle: nid ? (narrativeById.get(nid)?.title ?? null) : null,
    };
  });
}
