/**
 * Re-run enrichment over mentions classified by an older prompt.
 *
 *   npm run reenrich -- --dry-run     # show what would be re-done
 *   npm run reenrich                  # reset and re-enrich
 *   npm run reenrich -- --limit 200   # stage it in batches
 *
 * Why this exists: stance, district, department and event type all come from
 * the enrichment prompt, so changing the prompt only changes items enriched
 * afterwards. Everything already in the corpus keeps whatever the old prompt
 * said — including the stance bug that labelled neutral announcements
 * "Unfavourable". The command screen mixes both silently, and an officer has
 * no way to tell which rows they are looking at.
 *
 * It does NOT re-implement enrichment. It resets `status` to "normalized" so
 * the ordinary stage picks the rows up on its own terms, which keeps one
 * definition of what enrichment means.
 */
import "./env";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { mentions } from "@/db/schema";
import { getEnricher, ENRICHMENT_PROMPT_VERSION } from "@/intelligence/enrichment/llm";
import { runEnrichmentStage } from "@/intelligence/enrichment/stage";

/** Rows whose enrichment predates the current prompt, or never happened. */
const stale = or(
  isNull(sql`${mentions.enrichmentMeta}->>'promptVersion'`),
  ne(sql`${mentions.enrichmentMeta}->>'promptVersion'`, ENRICHMENT_PROMPT_VERSION),
);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limit = Number(arg("--limit") ?? 0);
  const handle = await createDb({ migrateOnCreate: false });

  const [{ count: staleCount }] = await handle.db
    .select({ count: sql<number>`count(*)::int` })
    .from(mentions)
    .where(and(eq(mentions.relevanceStatus, "accepted"), stale));

  const byVersion = await handle.db
    .select({
      version: sql<string>`coalesce(${mentions.enrichmentMeta}->>'promptVersion', '(never enriched)')`,
      count: sql<number>`count(*)::int`,
    })
    .from(mentions)
    .where(eq(mentions.relevanceStatus, "accepted"))
    .groupBy(sql`1`);

  console.log(`Current prompt: ${ENRICHMENT_PROMPT_VERSION}`);
  console.table(byVersion);
  console.log(`${staleCount} accepted mention(s) would be re-enriched${limit ? ` (capped at ${limit})` : ""}.`);

  if (dryRun) {
    console.log("\n--dry-run: nothing changed.");
    await handle.close();
    return;
  }
  if (staleCount === 0) {
    console.log("Nothing to do.");
    await handle.close();
    return;
  }

  /*
   * Reset in one statement rather than per row. A partial reset is safe to
   * re-run — the stage simply finds fewer candidates next time — but a torn
   * update mid-way would leave rows that look enriched and are not.
   */
  const target = limit
    ? sql`${mentions.id} in (select id from mentions where relevance_status = 'accepted' and (enrichment_meta->>'promptVersion' is distinct from ${ENRICHMENT_PROMPT_VERSION}) limit ${limit})`
    : and(eq(mentions.relevanceStatus, "accepted"), stale);

  await handle.db.update(mentions).set({ status: "normalized" }).where(target);
  console.log("Reset done. Running enrichment — this calls the model once per mention.\n");

  const enricher = await getEnricher();
  console.log(`enricher: ${enricher.provider}/${enricher.model ?? "?"}\n`);

  const started = Date.now();
  const result = await runEnrichmentStage(handle.db, enricher);
  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log(
    `\n${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed in ${mins} min`,
  );
  if (result.failed > 0) {
    console.log("Re-run to retry the failures; succeeded rows are skipped automatically.");
  }
  await handle.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
