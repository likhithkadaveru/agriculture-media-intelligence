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
import { generateCollectionQueries, SCAN_MINUTES } from "@/ontology/queries";
import { YOUTUBE_CHANNELS } from "@/ingestion/connectors/youtube-rss/channels";
import { NEWS_FEEDS } from "@/ingestion/connectors/news-rss/feeds";
import {
  INSTAGRAM_HASHTAGS,
  SCHEDULED_APIFY_SOURCES,
  ACTIVE_X_SOURCE,
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
      frequencyMinutes: SCAN_MINUTES,
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
      frequencyMinutes: SCAN_MINUTES,
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
      frequencyMinutes: q.frequencyMinutes,
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
      source.key === ACTIVE_X_SOURCE.key
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
        frequencyMinutes: SCAN_MINUTES,
        expectedNoise: "high",
        enabled: true,
      });
      seeded++;
    }
  }

  /*
   * Live-telecast watch — a deliberately short list.
   *
   * eventType=live returns only what is airing at this instant, so a broad
   * query set would burn the 100-search daily allowance discovering the same
   * handful of running streams. These are the terms where a telecast being
   * live is itself the news: an officer wants to know a channel is running a
   * farmer protest right now, not that one aired yesterday.
   */
  for (const term of LIVE_WATCH_TERMS) {
    const key = `youtube-live::${term.query}`;
    if (have.has(key)) continue;
    await db.insert(collectionQueries).values({
      id: randomUUID(),
      connector: "youtube-live",
      query: term.query,
      label: `live · ${term.query}`,
      language: term.language,
      tier: "a",
      priority: 100,
      frequencyMinutes: SCAN_MINUTES,
      expectedNoise: "medium",
      enabled: true,
    });
    seeded++;
  }

  return { seeded };
}

/**
 * Terms watched for live broadcasts. Anchored on place, never on crop.
 *
 * Measured against the live API, not reasoned about. eventType=live matches
 * the running stream's OWN title, and a telecast is titled "Telangana
 * Assembly Sessions" or "NTV Telugu News LIVE" — never "Telangana rythu". So
 * the obvious agricultural phrasings return nothing at all:
 *
 *   "Telangana rythu"            0 live
 *   "తెలంగాణ రైతు"                  0 live
 *   "Telangana farmers protest"  0 live
 *
 * And dropping the district to widen them is worse than useless, because the
 * bare crop words are swamped by pan-India and unrelated video:
 *
 *   "రైతు"        10 live — Hindi kisan schemes, jackfruit harvesting
 *   "vyavasayam"  10 live — Malayalam agri news, a monkey eating ice cream
 *
 * What works is the place name, which is in the title of every Telangana
 * broadcast: assembly sessions, CM speeches, protests outside the assembly.
 * Narrowing to agriculture is the relevance stage's job, and it is far better
 * at it than a search term — so collect broad here and let it reject.
 *
 * Three terms, not six: the per-cycle cap is one search, so the list rotates.
 * Fewer terms means each is checked more often — at three, every 90 minutes.
 */
const LIVE_WATCH_TERMS: Array<{ query: string; language: "te" | "en" }> = [
  { query: "తెలంగాణ", language: "te" },
  { query: "Telangana", language: "en" },
  { query: "Telangana assembly", language: "en" },
];

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

/**
 * Every enabled query for a connector, ignoring cadence.
 *
 * getDueQueries answers "what should be polled on schedule right now"; a
 * backfill asks a different question — "reach as far back as this source
 * allows, now" — and must not be gated by next_run_at. Using the due filter
 * for both meant a backfill run shortly after a normal cycle silently
 * collected nothing from exactly the paid sources that can reach history.
 */
export async function getBackfillQueries(db: Db, connector: string, limit: number) {
  return db
    .select()
    .from(collectionQueries)
    .where(
      and(
        eq(collectionQueries.connector, connector),
        eq(collectionQueries.enabled, true),
      ),
    )
    .orderBy(asc(collectionQueries.tier), desc(collectionQueries.priority))
    .limit(limit);
}

export async function recordQueryRun(
  db: Db,
  queryId: string,
  itemsReturned: number,
  frequencyMinutes: number,
): Promise<void> {
  const now = new Date();
  await db
    .update(collectionQueries)
    .set({
      lastRunAt: now,
      nextRunAt: new Date(now.getTime() + frequencyMinutes * 60 * 1000),
      runsCount: sql`${collectionQueries.runsCount} + 1`,
      itemsReturned: sql`${collectionQueries.itemsReturned} + ${itemsReturned}`,
    })
    .where(eq(collectionQueries.id, queryId));
}

/**
 * Yield pass: attribute collection and relevance/duplicate outcomes back to
 * the queries whose collection runs produced the raw items.
 *
 * Every counter here is recomputed absolutely from collection_runs, which is
 * the only complete record of what was actually polled. recordQueryRun keeps
 * these fresh during a cycle by incrementing, but any caller that collects
 * without recording — or that is added later — would otherwise leave the
 * yield table silently understated. Deriving the totals makes the pass
 * self-healing rather than dependent on every call site remembering.
 *
 * lastRunAt is only ever moved forward, and nextRunAt is left to
 * recordQueryRun: a query whose cadence was never recorded should come due
 * again, not be retroactively suppressed.
 */
export async function updateQueryYieldStats(db: Db): Promise<void> {
  const queries = await db.select().from(collectionQueries);
  for (const query of queries) {
    const runs = await db
      .select({
        id: collectionRuns.id,
        itemCount: collectionRuns.itemCount,
        startedAt: collectionRuns.startedAt,
      })
      .from(collectionRuns)
      .where(
        and(
          eq(collectionRuns.connector, query.connector),
          eq(collectionRuns.query, query.query),
        ),
      );
    if (runs.length === 0) continue;

    const itemsReturned = runs.reduce((sum, r) => sum + r.itemCount, 0);
    const latestRun = runs.reduce(
      (latest, r) => (latest === null || r.startedAt > latest ? r.startedAt : latest),
      null as Date | null,
    );

    let relevant = 0;
    let duplicates = 0;
    const raw = await db
      .select({ id: rawItems.id })
      .from(rawItems)
      .where(inArray(rawItems.collectionRunId, runs.map((r) => r.id)));
    if (raw.length > 0) {
      const mentionRows = await db
        .select({ relevanceStatus: mentions.relevanceStatus, status: mentions.status })
        .from(mentions)
        .where(inArray(mentions.rawItemId, raw.map((r) => r.id)));
      relevant = mentionRows.filter((m) => m.relevanceStatus === "accepted").length;
      duplicates = mentionRows.filter((m) => m.status === "duplicate").length;
    }

    await db
      .update(collectionQueries)
      .set({
        runsCount: runs.length,
        itemsReturned,
        relevantItems: relevant,
        duplicateItems: duplicates,
        ...(latestRun && (!query.lastRunAt || latestRun > query.lastRunAt)
          ? { lastRunAt: latestRun }
          : {}),
      })
      .where(eq(collectionQueries.id, query.id));
  }
}
