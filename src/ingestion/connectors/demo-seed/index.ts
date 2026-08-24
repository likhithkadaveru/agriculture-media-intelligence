/**
 * Demo seed connector — the only connector active during credential-free
 * development. Emits the fictional development corpus with
 * data_origin = "demo_seed" on every item.
 *
 * It implements the same SourceConnector interface a live connector will,
 * so replacing it with real collection requires no pipeline or UI changes.
 */
import type {
  CollectionQuery,
  NormalizedMention,
  RawSourceItem,
  SourceConnector,
} from "@/types/core";
import { normalizeRawItem } from "@/ingestion/normalization";
import { SEED_CORPUS, type SeedItem } from "./corpus";

function toRawItem(seed: SeedItem, collectedAt: Date): RawSourceItem {
  return {
    platform: seed.platform,
    externalId: seed.externalId,
    payload: seed.payload,
    collectedAt,
    dataOrigin: "demo_seed",
  };
}

export class DemoSeedConnector implements SourceConnector {
  key = "demo-seed";
  platform = "web" as const; // multi-platform corpus; per-item platform governs

  async collect(query: CollectionQuery): Promise<RawSourceItem[]> {
    void query; // the demo corpus is fixed; live connectors use the query
    const collectedAt = new Date();
    return SEED_CORPUS.map((s) => toRawItem(s, collectedAt));
  }

  async normalize(item: RawSourceItem): Promise<NormalizedMention> {
    const seed = SEED_CORPUS.find(
      (s) => s.externalId === item.externalId && s.platform === item.platform,
    );
    const mention = normalizeRawItem(item, {
      publishedAt: seed ? new Date(seed.publishedAt) : null,
    });
    // Development-only translations authored with the corpus; recorded as
    // seed_authored provenance downstream. Live connectors never set this.
    mention.seedTranslation = seed?.devTranslation ?? null;
    return mention;
  }
}
