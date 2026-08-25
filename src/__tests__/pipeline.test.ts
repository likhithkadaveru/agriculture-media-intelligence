/**
 * Vertical-slice integration test: seed corpus → raw items → mentions →
 * relevance → enrichment → dedup → narratives → findings, on an in-memory
 * PGlite instance with the deterministic heuristic enricher.
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createDb, type DbHandle } from "@/db/client";
import {
  evidenceLinks,
  intelligenceFindings,
  mentions,
  narrativeMentions,
  narratives,
  processingEvents,
  rawItems,
} from "@/db/schema";
import { runJob } from "@/ingestion/jobs";
import { HeuristicEnricher } from "@/intelligence/enrichment/heuristic";

let handle: DbHandle;

const ctx = () => ({
  db: handle.db,
  log: () => {},
  enricher: new HeuristicEnricher(),
});

beforeAll(async () => {
  handle = await createDb({ memory: true });
  await runJob("ingestDemoSeed", ctx());
  await runJob("runIntelligence", ctx());
});

afterAll(async () => {
  await handle.close();
});

describe("ingestion", () => {
  it("is idempotent — re-running ingestion and intelligence creates no new rows", async () => {
    const rawBefore = (await handle.db.select({ id: rawItems.id }).from(rawItems)).length;
    const mentionsBefore = (await handle.db.select({ id: mentions.id }).from(mentions)).length;
    const nmBefore = (
      await handle.db.select({ id: narrativeMentions.id }).from(narrativeMentions)
    ).length;

    await runJob("ingestDemoSeed", ctx());
    await runJob("runIntelligence", ctx());

    const rawAfter = (await handle.db.select({ id: rawItems.id }).from(rawItems)).length;
    const mentionsAfter = (await handle.db.select({ id: mentions.id }).from(mentions)).length;
    const nmAfter = (
      await handle.db.select({ id: narrativeMentions.id }).from(narrativeMentions)
    ).length;

    expect(rawAfter).toBe(rawBefore);
    expect(mentionsAfter).toBe(mentionsBefore);
    expect(nmAfter).toBe(nmBefore);
  });

  it("preserves data_origin = demo_seed on every row", async () => {
    for (const row of await handle.db.select().from(rawItems)) {
      expect(row.dataOrigin).toBe("demo_seed");
    }
    for (const row of await handle.db.select().from(mentions)) {
      expect(row.dataOrigin).toBe("demo_seed");
    }
    for (const row of await handle.db.select().from(narratives)) {
      expect(row.dataOrigin).toBe("demo_seed");
    }
    for (const row of await handle.db.select().from(intelligenceFindings)) {
      expect(row.dataOrigin).toBe("demo_seed");
    }
  });
});

describe("relevance", () => {
  it("rejects the deliberate noise items", async () => {
    const rejected = await handle.db
      .select({ externalId: mentions.externalId })
      .from(mentions)
      .where(eq(mentions.relevanceStatus, "rejected"));
    const ids = rejected.map((r) => r.externalId).sort();
    expect(ids).toEqual([
      "seed-news-006", // Warangal marathon — no agriculture
      "seed-news-007", // Punjab procurement — not Telangana
      "seed-news-008", // Karnataka protest — not Telangana
      "seed-x-010", // Hyderabad biryani — neither
      "seed-yt-004", // toy tractors — neither
    ]);
  });
});

describe("deduplication", () => {
  it("marks the syndicated copy as exact and the rewrite as near duplicate", async () => {
    const [exact] = await handle.db
      .select()
      .from(mentions)
      .where(eq(mentions.externalId, "seed-news-002"));
    expect(exact.status).toBe("duplicate");
    expect(exact.duplicateType).toBe("exact");

    const [near] = await handle.db
      .select()
      .from(mentions)
      .where(eq(mentions.externalId, "seed-news-003"));
    expect(near.status).toBe("duplicate");
    expect(near.duplicateType).toBe("near");

    const [canonical] = await handle.db
      .select()
      .from(mentions)
      .where(eq(mentions.externalId, "seed-news-001"));
    expect(exact.duplicateOfMentionId).toBe(canonical.id);
    expect(near.duplicateOfMentionId).toBe(canonical.id);
  });
});

describe("narrative aggregation", () => {
  it("builds the DAP narrative without counting duplicates", async () => {
    const [narrative] = await handle.db
      .select()
      .from(narratives)
      .where(eq(narratives.key, "fertilizer-availability/dap-availability"));
    expect(narrative).toBeDefined();

    const links = await handle.db
      .select()
      .from(narrativeMentions)
      .where(eq(narrativeMentions.narrativeId, narrative.id));
    const duplicateLinks = links.filter((l) => l.role === "duplicate");
    const evidenceLinksCount = links.filter((l) => l.role !== "duplicate").length;

    expect(duplicateLinks.length).toBe(2);
    // mentionCount excludes duplicates and equals non-duplicate links.
    expect(narrative.mentionCount).toBe(evidenceLinksCount);
    expect(narrative.mentionCount).toBeGreaterThanOrEqual(6);
    expect(Object.keys(narrative.districts).length).toBeGreaterThanOrEqual(2);
    expect(narrative.voiceMix["farmer"]).toBeGreaterThanOrEqual(3);
    expect(narrative.voiceMix["government"]).toBeGreaterThanOrEqual(1);
  });
});

describe("findings", () => {
  it("generates an emerging DAP finding with explainable components and evidence links", async () => {
    const active = await handle.db
      .select()
      .from(intelligenceFindings)
      .where(eq(intelligenceFindings.status, "active"));
    expect(active.length).toBeGreaterThanOrEqual(2);

    const [dapNarrative] = await handle.db
      .select()
      .from(narratives)
      .where(eq(narratives.key, "fertilizer-availability/dap-availability"));
    const dapFinding = active.find((f) => f.narrativeId === dapNarrative.id);
    expect(dapFinding).toBeDefined();
    expect(dapFinding!.category).toBe("emerging");
    expect(dapFinding!.rank).toBe(1);

    const components = dapFinding!.components as Record<string, unknown>;
    expect(components.divergenceObserved).toBe(true);
    expect(components.duplicatesExcluded).toBe(2);
    expect(dapFinding!.reason).toContain("thresholds");

    const links = await handle.db
      .select()
      .from(evidenceLinks)
      .where(eq(evidenceLinks.findingId, dapFinding!.id));
    const duplicateLinks = links.filter((l) => l.role === "duplicate");
    // Every canonical narrative mention is linked as evidence, and the
    // duplicates ride along without being counted in mentionCount.
    expect(links.length).toBe(dapNarrative.mentionCount + duplicateLinks.length);
    expect(duplicateLinks.length).toBe(2);
    expect(links.filter((l) => l.role === "official").length).toBeGreaterThanOrEqual(1);
  });

  it("splits distinct narratives under one topic instead of one fertilizer bucket", async () => {
    const fertilizerNarratives = await handle.db.select().from(narratives);
    const keys = fertilizerNarratives.map((n) => n.key);
    // DAP availability is its own narrative, not merged into a generic
    // fertilizer bucket (Phase 2 subtopic separation).
    expect(keys).toContain("fertilizer-availability/dap-availability");
  });
});

describe("provenance", () => {
  it("records a full event trail for a mention that reached a narrative", async () => {
    const [mention] = await handle.db
      .select()
      .from(mentions)
      .where(eq(mentions.externalId, "seed-x-001"));
    const events = await handle.db
      .select()
      .from(processingEvents)
      .where(eq(processingEvents.mentionId, mention.id));
    const types = events.map((e) => e.eventType);
    for (const expected of [
      "NORMALIZED",
      "RELEVANCE_ACCEPTED",
      "ENRICHED",
      "DEDUPED",
      "NARRATIVE_ASSIGNED",
    ]) {
      expect(types).toContain(expected);
    }
  });

  it("records enrichment failures as events without crashing the stage", async () => {
    const failing = {
      provider: "test",
      model: "always-fails",
      promptVersion: "t1",
      enrich: async () => {
        throw new Error("boom");
      },
    };
    // Reset one mention to pre-enrichment state so the stage picks it up.
    const [victim] = await handle.db
      .select()
      .from(mentions)
      .where(
        and(eq(mentions.externalId, "seed-x-009"), eq(mentions.relevanceStatus, "accepted")),
      );
    await handle.db
      .update(mentions)
      .set({ status: "normalized" })
      .where(eq(mentions.id, victim.id));

    const { runEnrichmentStage } = await import("@/intelligence/enrichment/stage");
    const result = await runEnrichmentStage(handle.db, failing);
    expect(result.failed).toBe(1);

    const events = await handle.db
      .select()
      .from(processingEvents)
      .where(
        and(
          eq(processingEvents.mentionId, victim.id),
          eq(processingEvents.eventType, "ENRICHMENT_FAILED"),
        ),
      );
    expect(events.length).toBe(1);

    // Restore state for other tests (re-enrich with the real enricher).
    await runEnrichmentStage(handle.db, new HeuristicEnricher());
  });
});

describe("origin isolation", () => {
  it("never mixes data origins inside one narrative", async () => {
    const rows = await handle.db.select().from(narrativeMentions);
    for (const link of rows) {
      const [narrative] = await handle.db
        .select()
        .from(narratives)
        .where(eq(narratives.id, link.narrativeId));
      const [mention] = await handle.db
        .select()
        .from(mentions)
        .where(eq(mentions.id, link.mentionId));
      expect(mention.dataOrigin).toBe(narrative.dataOrigin);
    }
  });

  it("never mixes data origins inside one finding's evidence", async () => {
    const links = await handle.db.select().from(evidenceLinks);
    for (const link of links) {
      const [finding] = await handle.db
        .select()
        .from(intelligenceFindings)
        .where(eq(intelligenceFindings.id, link.findingId));
      const [mention] = await handle.db
        .select()
        .from(mentions)
        .where(eq(mentions.id, link.mentionId));
      expect(mention.dataOrigin).toBe(finding.dataOrigin);
    }
  });
});
