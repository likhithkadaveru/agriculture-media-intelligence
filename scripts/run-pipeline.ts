/**
 * CLI pipeline runner — the Phase 2 execution backend for the job layer.
 *
 *   npm run pipeline           live collection (YouTube) + intelligence
 *   npm run pipeline:seed      demo_seed corpus + intelligence (development)
 *
 * Idempotent: safe to run repeatedly. Live and seed data stay strictly
 * separated by data_origin at every stage.
 */
import { createDb } from "@/db/client";
import { runJob } from "@/ingestion/jobs";

async function main() {
  const mode = process.argv[2] === "seed" ? "seed" : "live";
  const handle = await createDb();
  console.log(`[db] driver=${handle.driver}`);
  const ctx = { db: handle.db, log: (m: string) => console.log(`[pipeline] ${m}`) };
  if (mode === "seed") {
    await runJob("ingestDemoSeed", ctx);
  } else {
    await runJob("collectLive", ctx);
  }
  await runJob("runIntelligence", ctx);
  await handle.close();
  console.log("[pipeline] done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
