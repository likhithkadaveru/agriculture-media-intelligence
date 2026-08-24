/**
 * CLI pipeline runner — the Phase 1 execution backend for the job layer.
 *
 *   npm run pipeline
 *
 * Ingests the demo_seed corpus and runs the full intelligence pass.
 * Idempotent: safe to run repeatedly.
 */
import { createDb } from "@/db/client";
import { runJob } from "@/ingestion/jobs";

async function main() {
  const handle = await createDb();
  console.log(`[db] driver=${handle.driver}`);
  const ctx = { db: handle.db, log: (m: string) => console.log(`[pipeline] ${m}`) };
  await runJob("ingestDemoSeed", ctx);
  await runJob("runIntelligence", ctx);
  await handle.close();
  console.log("[pipeline] done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
