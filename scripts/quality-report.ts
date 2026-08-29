/**
 * Internal data-quality report (CLI, not a public surface).
 *
 *   npm run quality
 */
import "./env";
import { createDb } from "@/db/client";
import { collectionQueries, mentions, processingEvents } from "@/db/schema";
import { eq } from "drizzle-orm";

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((n / d) * 100).toFixed(1)}%`;
}

async function main() {
  const handle = await createDb();
  const db = handle.db;

  // Which database this reads is the first thing to know: a report against
  // the embedded PGlite and one against Neon look identical otherwise.
  const target =
    handle.driver === "pg"
      ? (process.env.DATABASE_URL ?? "").replace(/:[^:@/]*@/, ":***@").split("?")[0]
      : ".data/pglite";
  console.log(`database: ${handle.driver} · ${target}`);

  const all = await db.select().from(mentions);
  const origins = [...new Set(all.map((m) => m.dataOrigin))];

  for (const origin of origins) {
    const rows = all.filter((m) => m.dataOrigin === origin);
    const accepted = rows.filter((m) => m.relevanceStatus === "accepted");
    const enriched = accepted.filter((m) => m.enrichmentMeta?.success);
    const dupes = rows.filter((m) => m.status === "duplicate");

    console.log(`\n═══ DATA QUALITY · ${origin} ═══`);
    console.log(`collected            ${rows.length}`);
    console.log(`rejected (relevance) ${rows.length - accepted.length}  ${pct(rows.length - accepted.length, rows.length)}`);
    console.log(`accepted             ${accepted.length}  ${pct(accepted.length, rows.length)}`);
    console.log(`duplicate rate       ${pct(dupes.length, accepted.length)}  (${dupes.length} of ${accepted.length})`);
    console.log(`unknown location     ${pct(accepted.filter((m) => !m.district).length, accepted.length)}`);
    console.log(`unknown author type  ${pct(enriched.filter((m) => !m.isOfficialVoice && !m.isThirdPartyVoice).length, enriched.length)}`);
    console.log(`low confidence <0.6  ${pct(enriched.filter((m) => (m.classificationConfidence ?? 0) < 0.6).length, enriched.length)}`);
    console.log(`translation present  ${pct(accepted.filter((m) => m.englishTranslation).length, accepted.filter((m) => m.language !== "en").length)} of non-English`);
  }

  const failures = await db
    .select()
    .from(processingEvents)
    .where(eq(processingEvents.eventType, "ENRICHMENT_FAILED"));
  const enrichedEvents = await db
    .select()
    .from(processingEvents)
    .where(eq(processingEvents.eventType, "ENRICHED"));
  console.log(`\n═══ PIPELINE HEALTH ═══`);
  console.log(`enrichment failures  ${failures.length}  ${pct(failures.length, failures.length + enrichedEvents.length)}`);

  const queries = await db.select().from(collectionQueries);
  const run = queries.filter((q) => q.runsCount > 0);
  console.log(`\n═══ QUERY YIELD (${run.length} executed of ${queries.length} planned) ═══`);
  for (const q of run.sort((a, b) => b.itemsReturned - a.itemsReturned)) {
    console.log(
      `${(q.label ?? q.query).slice(0, 34).padEnd(36)} tier ${q.tier}  items ${String(q.itemsReturned).padStart(4)}  relevant ${String(q.relevantItems).padStart(3)}  yield ${pct(q.relevantItems, q.itemsReturned)}`,
    );
  }

  await handle.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
