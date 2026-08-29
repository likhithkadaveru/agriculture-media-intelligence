/**
 * Source router: runs a connector, persists raw items immutably, normalizes
 * them into canonical mentions, and records processing events.
 *
 * Idempotency: raw_items and mentions are keyed by
 * (platform, external_id, data_origin). Re-running a collection inserts
 * nothing new for already-seen items.
 */
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Db } from "@/db/client";
import {
  authors,
  collectionRuns,
  mentions,
  processingEvents,
  rawItems,
  sources,
} from "@/db/schema";
import type { NormalizedMention, SourceConnector } from "@/types/core";
import { deriveContentText } from "@/ingestion/normalization/boilerplate";
import { recordEvent } from "@/lib/events";

const CONNECTOR_REGISTRY = new Map<string, () => SourceConnector>();

export function registerConnector(key: string, factory: () => SourceConnector) {
  CONNECTOR_REGISTRY.set(key, factory);
}

export function getConnector(key: string): SourceConnector {
  const factory = CONNECTOR_REGISTRY.get(key);
  if (!factory) throw new Error(`Unknown connector: ${key}`);
  return factory();
}

async function ensureSource(db: Db, connector: SourceConnector) {
  const existing = await db
    .select()
    .from(sources)
    .where(eq(sources.key, connector.key));
  if (existing.length > 0) return existing[0];
  const row = {
    id: randomUUID(),
    key: connector.key,
    name: connector.key,
    platform: connector.platform,
    isOfficial: false,
    description: null,
  };
  await db.insert(sources).values(row).onConflictDoNothing();
  const [inserted] = await db.select().from(sources).where(eq(sources.key, connector.key));
  return inserted;
}

async function upsertAuthor(db: Db, mention: NormalizedMention): Promise<string | null> {
  if (!mention.author) return null;
  const naturalKey = (mention.author.handle ?? mention.author.name).toLowerCase();
  const existing = await db
    .select()
    .from(authors)
    .where(
      and(
        eq(authors.platform, mention.platform),
        eq(authors.naturalKey, naturalKey),
        eq(authors.dataOrigin, mention.dataOrigin),
      ),
    );
  if (existing.length > 0) return existing[0].id;
  const id = randomUUID();
  await db
    .insert(authors)
    .values({
      id,
      platform: mention.platform,
      naturalKey,
      name: mention.author.name,
      handle: mention.author.handle,
      bio: mention.author.bio,
      isOfficial: mention.author.isOfficialAccount,
      dataOrigin: mention.dataOrigin,
    })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(authors)
    .where(
      and(
        eq(authors.platform, mention.platform),
        eq(authors.naturalKey, naturalKey),
        eq(authors.dataOrigin, mention.dataOrigin),
      ),
    );
  return row.id;
}

export interface CollectionResult {
  runId: string;
  collected: number;
  newRawItems: number;
  newMentions: number;
}

export async function runCollection(
  db: Db,
  connectorKey: string,
  query: string | null = null,
  /**
   * Passed through to the connector. `since` is honoured only by sources
   * that support a historical window (Apify actors); feed-based sources
   * return whatever the publisher currently serves.
   */
  options: { limit?: number; since?: Date } = {},
): Promise<CollectionResult> {
  const connector = getConnector(connectorKey);
  const source = await ensureSource(db, connector);

  const runId = randomUUID();
  const startedAt = new Date();
  const items = await connector.collect({ query, ...options });
  const dataOrigin = items[0]?.dataOrigin ?? "live";

  await db.insert(collectionRuns).values({
    id: runId,
    sourceId: source.id,
    connector: connectorKey,
    query,
    startedAt,
    itemCount: items.length,
    status: "running",
    dataOrigin,
  });

  let newRawItems = 0;
  let newMentions = 0;

  for (const item of items) {
    // Raw item — immutable, idempotent insert.
    const existingRaw = await db
      .select({ id: rawItems.id })
      .from(rawItems)
      .where(
        and(
          eq(rawItems.platform, item.platform),
          eq(rawItems.externalId, item.externalId),
          eq(rawItems.dataOrigin, item.dataOrigin),
        ),
      );

    let rawItemId: string;
    if (existingRaw.length > 0) {
      rawItemId = existingRaw[0].id;
    } else {
      rawItemId = randomUUID();
      await db.insert(rawItems).values({
        id: rawItemId,
        collectionRunId: runId,
        sourceId: source.id,
        platform: item.platform,
        externalId: item.externalId,
        payload: item.payload,
        collectedAt: item.collectedAt,
        dataOrigin: item.dataOrigin,
      });
      newRawItems++;
      await recordEvent(db, "COLLECTED", {
        collectionRunId: runId,
        rawItemId,
        detail: { platform: item.platform, externalId: item.externalId },
      });
    }

    // Mention — idempotent on the same natural key.
    const existingMention = await db
      .select({ id: mentions.id })
      .from(mentions)
      .where(
        and(
          eq(mentions.platform, item.platform),
          eq(mentions.externalId, item.externalId),
          eq(mentions.dataOrigin, item.dataOrigin),
        ),
      );
    if (existingMention.length > 0) continue;

    const normalized = await connector.normalize(item);
    const authorId = await upsertAuthor(db, normalized);
    const mentionId = randomUUID();
    await db.insert(mentions).values({
      id: mentionId,
      rawItemId,
      sourceId: source.id,
      platform: normalized.platform,
      externalId: normalized.externalId,
      url: normalized.url,
      publishedAt: normalized.publishedAt,
      collectedAt: item.collectedAt,
      authorId,
      title: normalized.title,
      originalText: normalized.originalText,
      contentText: deriveContentText(normalized.title, normalized.originalText),
      englishTranslation: null,
      engagement: normalized.engagement,
      thumbnailUrl: normalized.thumbnailUrl ?? null,
      transcriptStatus: normalized.transcriptStatus ?? null,
      isOfficialVoice: normalized.author?.isOfficialAccount ?? false,
      status: "normalized",
      dataOrigin: normalized.dataOrigin,
    });
    // Development-only: stash seed translation for the enrichment stage via
    // events detail so it stays traceable (only present for demo_seed).
    if (normalized.seedTranslation) {
      await recordEvent(db, "NORMALIZED", {
        rawItemId,
        mentionId,
        detail: { seedTranslation: normalized.seedTranslation },
      });
    } else {
      await recordEvent(db, "NORMALIZED", { rawItemId, mentionId });
    }
    newMentions++;
  }

  await db
    .update(collectionRuns)
    .set({ finishedAt: new Date(), status: "succeeded" })
    .where(eq(collectionRuns.id, runId));

  return { runId, collected: items.length, newRawItems, newMentions };
}

/** Fetch seed translations recorded at normalization time (demo_seed only). */
export async function getSeedTranslations(
  db: Db,
  mentionIds: string[],
): Promise<Map<string, string>> {
  if (mentionIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(processingEvents)
    .where(
      and(
        eq(processingEvents.eventType, "NORMALIZED"),
        inArray(processingEvents.mentionId, mentionIds),
      ),
    );
  const map = new Map<string, string>();
  for (const row of rows) {
    const detail = row.detail as { seedTranslation?: string } | null;
    if (row.mentionId && detail?.seedTranslation) {
      map.set(row.mentionId, detail.seedTranslation);
    }
  }
  return map;
}
