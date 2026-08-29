/**
 * Historical backfill.
 *
 *   npm run backfill -- --days 14           # estimate only, spends nothing
 *   npm run backfill -- --days 14 --confirm # actually collect
 *
 * What a backfill can and cannot reach differs sharply by source, and the
 * report says so rather than implying uniform coverage:
 *
 *   X (Apify)         real historical window — the actor takes start/end
 *   Instagram (Apify) recent hashtag posts, filtered to the window
 *   News RSS          only what the publisher currently serves in the feed
 *   YouTube RSS       only the ~15 most recent uploads per channel
 *
 * RSS is not an archive. Asking a feed for "the last two weeks" returns
 * whatever happens to be in it — for a busy publisher that may be two days.
 * The only honest fix for real history is to keep collecting from now on.
 */
import "./env";
import { createDb } from "@/db/client";
import { runCollection } from "@/ingestion/router";
import { ensureLocations, jobs } from "@/ingestion/jobs";
import {
  seedCollectionQueries,
  getBackfillQueries,
  recordQueryRun,
} from "@/ingestion/router/scheduler";
import { INSTAGRAM_HASHTAGS } from "@/ingestion/connectors/apify/sources";
import { generateCollectionQueries } from "@/ontology/queries";

/**
 * Verified from each actor's published pricing. The X figure follows
 * ACTIVE_X_SOURCE: kaitoeasyapi (the default) bills $0.00025 per result,
 * apidojo $0.0004. An estimate that gates a paid run must price the actor
 * that will actually be called.
 */
const PRICE_PER_X_RESULT = process.env.APIFY_X_ACTOR === "apidojo" ? 0.0004 : 0.00025;
const PRICE_PER_IG_RESULT = 0.0026;

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const days = Number(arg("days") ?? 14);
  const confirm = process.argv.includes("--confirm");
  const perTerm = Number(arg("per-term") ?? 50);
  const perTag = Number(arg("per-tag") ?? 25);

  const since = new Date(Date.now() - days * 86400000);
  const hasApify = Boolean(process.env.APIFY_API_TOKEN);

  const xTerms = generateCollectionQueries().filter((q) => q.tier === "a");
  const xResults = xTerms.length * perTerm;
  const igResults = INSTAGRAM_HASHTAGS.length * perTag;
  const xCost = xResults * PRICE_PER_X_RESULT;
  const igCost = igResults * PRICE_PER_IG_RESULT;

  console.log(`\n═══ BACKFILL PLAN · last ${days} days (since ${since.toISOString().slice(0, 10)}) ═══\n`);
  console.log("PAID SOURCES (Apify)");
  console.log(
    `  X          ${xTerms.length} terms x ${perTerm} = ${xResults} results  ≈ $${xCost.toFixed(2)}`,
  );
  console.log(
    `  Instagram  ${INSTAGRAM_HASHTAGS.length} tags x ${perTag} = ${igResults} results  ≈ $${igCost.toFixed(2)}`,
  );
  console.log(`  ────────────────────────────────────────────`);
  console.log(`  estimated total                    ≈ $${(xCost + igCost).toFixed(2)}`);
  console.log(`  apify token configured: ${hasApify ? "yes" : "NO — paid sources will be skipped"}`);

  console.log("\nFREE SOURCES (no historical window available)");
  console.log("  News RSS     collects whatever each publisher currently serves");
  console.log("  YouTube RSS  collects the ~15 most recent uploads per channel");
  console.log("  Both are filtered to the window afterwards, so the counts they");
  console.log("  contribute may be far below what a true archive would give.");

  if (!confirm) {
    console.log("\nEstimate only — nothing was collected and nothing was spent.");
    console.log("Re-run with --confirm to proceed.\n");
    return;
  }

  const handle = await createDb();
  const db = handle.db;
  const log = (m: string) => console.log(`[backfill] ${m}`);

  await ensureLocations(db);
  const { seeded } = await seedCollectionQueries(db);
  log(`scheduler: ${seeded} queries seeded`);

  // Free sources first: they cost nothing, so a later failure on a paid
  // source never means we paid for a run that produced nothing usable.
  for (const connector of ["youtube-rss", "news-rss"]) {
    const due = await getBackfillQueries(db, connector, 30);
    for (const q of due) {
      try {
        const r = await runCollection(db, connector, q.query);
        // A backfill poll is a poll: it consumes the same publisher quota and
        // advances the same cadence, so it must be recorded like a scheduled
        // one. Skipping this left the query's yield stats permanently blank.
        await recordQueryRun(db, q.id, r.collected, q.frequencyHours);
        log(`${connector} · ${q.label ?? q.query}: ${r.collected} items, ${r.newMentions} new`);
      } catch (error) {
        log(`${connector} · ${q.label ?? q.query} FAILED: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  if (hasApify) {
    for (const [connector, limit] of [
      ["apify-x-search", perTerm],
      ["apify-instagram-hashtag", perTag],
    ] as const) {
      const due = await getBackfillQueries(db, connector, 20);
      for (const q of due) {
        try {
          const r = await runCollection(db, connector, q.query, { limit, since });
          await recordQueryRun(db, q.id, r.collected, q.frequencyHours);
          log(`${connector} · ${q.query}: ${r.collected} items, ${r.newMentions} new`);
        } catch (error) {
          log(`${connector} · ${q.query} FAILED: ${error instanceof Error ? error.message : error}`);
        }
      }
    }
  } else {
    log("apify skipped — APIFY_API_TOKEN not set");
  }

  log("collection complete; running intelligence");
  await jobs.runIntelligence({ db, log });

  await handle.close();
  console.log("\nBackfill done.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
