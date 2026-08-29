/**
 * Collection daemon.
 *
 *   npm run scheduler              # run continuously
 *   npm run scheduler -- --once    # one cycle, then exit (for cron/launchd)
 *
 * Why this exists: every capability that depends on history — lead-time
 * proof, trend status, "unusual for this district" baselines, the escalation
 * ladder — can only be built from a continuous record. None of it can be
 * backfilled later. A day without collection is a day permanently missing.
 *
 * This is a *driver*, not the scheduling logic. Per-query cadence lives in
 * collection_queries and is enforced by the router; this only decides when
 * to ask. Replacing it with cron, launchd, Trigger.dev, Cloud Run or Vercel
 * Cron means calling `runCycle` from somewhere else — no connector or
 * intelligence stage changes.
 */
import { createDb, type DbHandle } from "@/db/client";
import { runJob } from "@/ingestion/jobs";

const CYCLE_MINUTES = Number(process.env.SCHEDULER_CYCLE_MINUTES ?? 60);

function stamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function log(message: string) {
  console.log(`${stamp()}  ${message}`);
}

async function runCycle(handle: DbHandle): Promise<void> {
  const ctx = { db: handle.db, log: (m: string) => log(`  ${m}`) };
  try {
    await runJob("collectLive", ctx);
    await runJob("runIntelligence", ctx);
    log("cycle complete");
  } catch (error) {
    /*
     * A failed cycle must never kill the daemon. A publisher outage, a rate
     * limit or one bad actor run should cost this cycle, not every future
     * one — an unattended collector that dies silently is worse than none.
     */
    log(`cycle FAILED: ${error instanceof Error ? error.message : error}`);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  const handle = await createDb();

  log(`scheduler starting (driver=${handle.driver}, mode=${once ? "once" : `every ${CYCLE_MINUTES}m`})`);
  log("per-query cadence is enforced by the router; this only triggers cycles");

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log(`${signal} received — finishing and closing cleanly`);
    await handle.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await runCycle(handle);

  if (once) {
    await handle.close();
    return;
  }

  const interval = CYCLE_MINUTES * 60_000;
  log(`next cycle in ${CYCLE_MINUTES} minutes — leave this running to accumulate history`);

  // A plain loop rather than setInterval: cycles can outlast their interval
  // (enrichment is slow), and overlapping runs would contend for the single
  // database connection.
  while (!stopping) {
    await new Promise((r) => setTimeout(r, interval));
    if (stopping) break;
    await runCycle(handle);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
