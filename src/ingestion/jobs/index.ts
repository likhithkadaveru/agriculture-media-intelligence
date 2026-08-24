/**
 * Application-level job layer.
 *
 * Jobs are plain async functions over a JobContext. Nothing here knows about
 * Vercel Cron, Trigger.dev, Temporal or any scheduler — any execution
 * backend that can call `runJob(name)` can drive the system. Vercel Cron (or
 * a CLI script, which is what Phase 1 uses) is just one caller.
 */
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { locations } from "@/db/schema";
import { DISTRICTS } from "@/ontology";
import { registerConnector, runCollection } from "@/ingestion/router";
import { DemoSeedConnector } from "@/ingestion/connectors/demo-seed";
import { runRelevanceStage } from "@/intelligence/relevance/stage";
import { runEnrichmentStage } from "@/intelligence/enrichment/stage";
import { getEnricher } from "@/intelligence/enrichment/llm";
import { runDedupStage } from "@/intelligence/dedup";
import { runNarrativeStage } from "@/intelligence/narratives/stage";
import { runFindingStage } from "@/intelligence/findings/stage";
import type { Enricher } from "@/intelligence/enrichment/schema";

export interface JobContext {
  db: Db;
  log: (message: string) => void;
  /** Test seam; defaults to credential-based selection. */
  enricher?: Enricher;
}

export type JobResult = Record<string, unknown>;

registerConnector("demo-seed", () => new DemoSeedConnector());

/** Seed the locations table from the ontology (idempotent). */
export async function ensureLocations(db: Db): Promise<void> {
  const keys = DISTRICTS.map((d) => d.id);
  const existing = await db
    .select({ key: locations.key })
    .from(locations)
    .where(inArray(locations.key, keys));
  const have = new Set(existing.map((r) => r.key));
  for (const district of DISTRICTS) {
    if (have.has(district.id)) continue;
    const districtId = randomUUID();
    await db.insert(locations).values({
      id: districtId,
      key: district.id,
      nameEn: district.en,
      nameTe: district.te ?? null,
      kind: "district",
      parentId: null,
    });
    for (const mandal of district.mandals ?? []) {
      await db.insert(locations).values({
        id: randomUUID(),
        key: `${district.id}/${mandal.id}`,
        nameEn: mandal.en,
        nameTe: mandal.te ?? null,
        kind: "mandal",
        parentId: districtId,
      });
    }
  }
}

export const jobs = {
  /** Collect + normalize the development corpus (demo_seed). */
  async ingestDemoSeed(ctx: JobContext): Promise<JobResult> {
    await ensureLocations(ctx.db);
    const result = await runCollection(ctx.db, "demo-seed");
    ctx.log(
      `ingest: ${result.collected} collected, ${result.newRawItems} new raw items, ${result.newMentions} new mentions`,
    );
    return { ...result };
  },

  /** Full intelligence pass: relevance → enrichment → dedup → narratives → findings. */
  async runIntelligence(ctx: JobContext): Promise<JobResult> {
    const relevance = await runRelevanceStage(ctx.db);
    ctx.log(
      `relevance: ${relevance.assessed} assessed, ${relevance.accepted} accepted, ${relevance.rejected} rejected`,
    );
    const enricher = ctx.enricher ?? getEnricher();
    ctx.log(`enrichment: using ${enricher.provider}/${enricher.model}`);
    const enrichment = await runEnrichmentStage(ctx.db, enricher);
    ctx.log(
      `enrichment: ${enrichment.processed} processed, ${enrichment.succeeded} succeeded, ${enrichment.failed} failed`,
    );
    const dedup = await runDedupStage(ctx.db);
    ctx.log(
      `dedup: ${dedup.examined} examined, ${dedup.exactDuplicates} exact + ${dedup.nearDuplicates} near duplicates`,
    );
    const narrative = await runNarrativeStage(ctx.db);
    ctx.log(
      `narratives: ${narrative.narrativesUpdated} updated, ${narrative.mentionsAssigned} mentions assigned`,
    );
    const findings = await runFindingStage(ctx.db);
    ctx.log(`findings: ${findings.generated} generated`);
    return { relevance, enrichment, dedup, narrative, findings };
  },
} satisfies Record<string, (ctx: JobContext) => Promise<JobResult>>;

export type JobName = keyof typeof jobs;

export async function runJob(name: JobName, ctx: JobContext): Promise<JobResult> {
  return jobs[name](ctx);
}
