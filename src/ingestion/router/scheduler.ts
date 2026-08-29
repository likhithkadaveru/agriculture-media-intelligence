/**
 * Quota-aware query scheduler.
 *
 * collection_queries rows describe all planned collection work:
 * - youtube-rss: one row per curated channel (query = channel id)
 * - news-rss: one row per publication feed (query = feed key)
 * - apify-*: one row per search term (query = the term)
 * - youtube-api: ontology-generated search queries (dormant without a key)
 *
 * The scheduler picks due queries (next_run_at <= now) in tier/priority
 * order, and a yield pass accumulates per-query performance so poor queries
 * can be deprioritized over time.
 */
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Db } from "@/db/client";
import { collectionQueries, collectionRuns, mentions, rawItems } from "@/db/schema";
import { generateCollectionQueries } from "@/ontology/queries";
import { YOUTUBE_CHANNELS } from "@/ingestion/connectors/youtube-rss/channels";
import { NEWS_FEEDS } from "@/ingestion/connectors/news-rss/feeds";
import {
  INSTAGRAM_HASHTAGS,
  SCHEDULED_APIFY_SOURCES,
  X_SEARCH,
} from "@/ingestion/connectors/apify/sources";

/** Idempotently upsert the planned query set from configuration. */
export async function seedCollectionQueries(db: Db): Promise<{ seeded: number }> {
  let seeded = 0;

  const existing = await db
    .select({ connector: collectionQueries.connector, query: collectionQueries.query })
    .from(collectionQueries);
  const have = new Set(existing.map((r) => `${r.connector}::${r.query}`));

  // RSS channel polls — Tier A, cheap, every cycle.
  for (const channel of YOUTUBE_CHANNELS) {
    const key = `youtube-rss::${channel.channelId}`;
    if (have.has(key)) continue;
    await db.insert(collectionQueries).values({
      id: randomUUID(),
      connector: "youtube-rss",
      query: channel.channelId,
      label: channel.name,
      language: channel.language,
      tier: "a",
      priority: 100,
      frequencyHours: 6,
      expectedNoise: channel.kind === "agriculture_programme" ? "low" : "high",
      enabled: channel.enabled,
    });
    seeded++;
  }

  // News publication feeds — Tier A. Publishers post continuously, and a
  // Telangana desk turns over faster than a channel's upload schedule, so
  // these poll more often than the video channels.
  for (const feed of NEWS_FEEDS) {
    const key = `news-rss::${feed.key}`;
    if (have.has(key)) continue;
    await db.insert(collectionQueries).values({
      id: randomUUID(),
      connector: "news-rss",
      query: feed.key,
      label: feed.name,
      language: feed.language,
      tier: "a",
      priority: feed.scope === "telangana" ? 100 : 80,
      frequencyHours: 4,
      expectedNoise:
        feed.scope === "telangana" ? "medium" : feed.scope === "national" ? "high" : "medium",
      enabled: feed.enabled,
    });
    seeded++;
  }

  // API search queries — generated from the ontology; dormant without a key.
  for (const q of generateCollectionQueries()) {
    const key = `youtube-api::${q.query}`;
    if (have.has(key)) continue;
    await db.insert(collectionQueries).values({
      id: randomUUID(),
      connector: "youtube-api",
      query: q.query,
      label: null,
      language: q.language,
      tier: q.tier,
      priority: q.priority,
      frequencyHours: q.frequencyHours,
      expectedNoise: q.expectedNoise,
      enabled: true,
    });
    seeded++;
  }

  /*
   * Apify search terms. Apify bills per result ($0.0004/tweet), so unlike
   * the free feeds these are deliberately few and slow: only the ten Tier A
   * core terms, once a day, capped at 5 queries per cycle by the job layer.
   *
   * At 15 results per term that is ~4,500 tweets a month (~$1.80), inside
   * Apify's $5 free monthly credit. Both numbers are meant to be raised
   * consciously, not by accident.
   *
   * Rows are seeded whether or not a token is present, so the plan is
   * visible in `npm run quality` before anyone pays for anything; the job
   * layer simply skips the connector when APIFY_API_TOKEN is unset.
   */
  for (const source of SCHEDULED_APIFY_SOURCES) {
    // X takes ontology search terms; Instagram takes hashtags. Both are
    // short, specific lists rather than the full generated query set,
    // because both bill per result.
    const terms =
      source.key === X_SEARCH.key
        ? generateCollectionQueries()
            .filter((g) => g.tier === "a")
            .map((g) => ({ query: g.query, language: g.language, priority: g.priority }))
        : INSTAGRAM_HASHTAGS.map((h) => ({
            query: h,
            language: null as "te" | "en" | null,
            priority: 70,
          }));

    for (const t of terms) {
      const key = `${source.key}::${t.query}`;
      if (have.has(key)) continue;
      await db.insert(collectionQueries).values({
        id: randomUUID(),
        connector: source.key,
        query: t.query,
        label: null,
        language: t.language,
        tier: "a",
        priority: t.priority,
        frequencyHours: 24,
        expectedNoise: "high",
        enabled: true,
      });
      seeded++;
    }
  }

  return { seeded };
}

export async function getDueQueries(db: Db, connector: string, limit: number) {
  const now = new Date();
  return db
    .select()
    .from(collectionQueries)
    .where(
      and(
        eq(collectionQueries.connector, connector),
        eq(collectionQueries.enabled, true),
        or(isNull(collectionQueries.nextRunAt), lte(collectionQueries.nextRunAt, now)),
      ),
    )
    .orderBy(asc(collectionQueries.tier), desc(collectionQueries.priority))
    .limit(limit);
}

export async function recordQueryRun(
  db: Db,
  queryId: string,
  itemsReturned: number,
  frequencyHours: number,
): Promise<void> {
  const now = new Date();
  await db
    .update(collectionQueries)
    .set({
      lastRunAt: now,
      nextRunAt: new Date(now.getTime() + frequencyHours * 3600 * 1000),
      runsCount: sql`${collectionQueries.runsCount} + 1`,
      itemsReturned: sql`${collectionQueries.itemsReturned} + ${itemsReturned}`,
    })
    .where(eq(collectionQueries.id, queryId));
}

/**
 * Yield pass: attribute relevance/duplicate outcomes back to the queries
 * whose collection runs produced the raw items. Recomputes absolute counts.
 */
export async function updateQueryYieldStats(db: Db): Promise<void> {
  const queries = await db.select().from(collectionQueries);
  for (const query of queries) {
    if (query.runsCount === 0) continue;
    const runs = await db
      .select({ id: collectionRuns.id })
      .from(collectionRuns)
      .where(
        and(
          eq(collectionRuns.connector, query.connector),
          eq(collectionRuns.query, query.query),
        ),
      );
    if (runs.length === 0) continue;
    const raw = await db
      .select({ id: rawItems.id })
      .from(rawItems)
      .where(inArray(rawItems.collectionRunId, runs.map((r) => r.id)));
    if (raw.length === 0) continue;
    const mentionRows = await db
      .select({ relevanceStatus: mentions.relevanceStatus, status: mentions.status })
      .from(mentions)
      .where(inArray(mentions.rawItemId, raw.map((r) => r.id)));
    const relevant = mentionRows.filter((m) => m.relevanceStatus === "accepted").length;
    const duplicates = mentionRows.filter((m) => m.status === "duplicate").length;
    await db
      .update(collectionQueries)
      .set({ relevantItems: relevant, duplicateItems: duplicates })
      .where(eq(collectionQueries.id, query.id));
  }
}
