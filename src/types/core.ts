/**
 * Core domain types shared across ingestion, intelligence, persistence and UI.
 *
 * The canonical intelligence object is the Mention (see db/schema/mentions.ts
 * for the persisted shape and intelligence/enrichment/schema.ts for the
 * Zod-validated enrichment output).
 */

/** Provenance discriminator — present on every data-bearing row from day one. */
export type DataOrigin = "live" | "verified_snapshot" | "demo_seed";

export type Platform = "youtube" | "x" | "news" | "official" | "web";

export type Language = "te" | "en" | "mixed" | "other";

export type AuthorType =
  | "government"
  | "farmer"
  | "farmer_organisation"
  | "fpo"
  | "agriculture_expert"
  | "academic"
  | "journalist"
  | "media_organisation"
  | "politician"
  | "creator"
  | "dealer"
  | "ngo"
  | "citizen"
  | "unknown";

export type Sentiment = "negative" | "positive" | "neutral" | "mixed";

/** Stance toward the government / responsible public authority on the issue. */
export type Stance = "critical" | "supportive" | "neutral" | "mixed";

export type RelevanceStatus = "pending" | "accepted" | "rejected";

export type MentionStatus =
  | "normalized"
  | "rejected"
  | "enriched"
  | "duplicate"
  | "narrative_assigned";

export type DuplicateType = "exact" | "near";

export type FindingCategory =
  | "emerging"
  | "watch"
  | "divergence"
  | "influence"
  | "geographic";

export interface Engagement {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  reposts?: number | null;
}

/** What a connector returns before normalization. Payload is kept verbatim. */
export interface RawSourceItem {
  platform: Platform;
  externalId: string;
  /** Immutable, connector-native payload (e.g. YouTube API video resource). */
  payload: unknown;
  collectedAt: Date;
  dataOrigin: DataOrigin;
}

/** Author identity as extracted during normalization (pre-classification). */
export interface NormalizedAuthor {
  name: string;
  handle: string | null;
  bio: string | null;
  isOfficialAccount: boolean;
}

/**
 * The canonical mention produced by normalization, before enrichment.
 * Unknown information stays null — never forced into fake values.
 */
export interface NormalizedMention {
  platform: Platform;
  externalId: string;
  url: string | null;
  publishedAt: Date | null;
  author: NormalizedAuthor | null;
  title: string | null;
  originalText: string;
  engagement: Engagement | null;
  thumbnailUrl?: string | null;
  /** unavailable | available | not_applicable — never fabricated. */
  transcriptStatus?: string | null;
  /** live | upcoming | ended | null. Null means an ordinary upload. */
  broadcastStatus?: BroadcastStatus | null;
  dataOrigin: DataOrigin;
  /**
   * Development-only: translations authored alongside demo_seed corpus items.
   * Used by the heuristic enricher ONLY for demo_seed data, and recorded as
   * such in enrichment metadata. Live data never populates this.
   */
  seedTranslation?: string | null;
}

/**
 * State of a video broadcast at the moment it was collected.
 *
 * "ended" is not the same as null: a finished telecast is worth revisiting
 * because captions usually appear once a stream stops, whereas an ordinary
 * upload either has them already or never will.
 */
export type BroadcastStatus = "live" | "upcoming" | "ended";

export interface CollectionQuery {
  /** Free-form query or feed identifier understood by the connector. */
  query: string | null;
  limit?: number;
  /**
   * Collect items published on or after this instant, where the source
   * supports a historical window. RSS feeds cannot honour this — they return
   * whatever is currently in the feed — so callers must treat it as a
   * request, not a guarantee, and filter afterwards.
   */
  since?: Date;
}

/**
 * Common connector interface. The intelligence pipeline never sees
 * connector-native payload structures — only RawSourceItem/NormalizedMention.
 */
export interface SourceConnector {
  key: string;
  platform: Platform;
  collect(query: CollectionQuery): Promise<RawSourceItem[]>;
  normalize(item: RawSourceItem): Promise<NormalizedMention>;
}

export type ProcessingEventType =
  | "COLLECTED"
  | "NORMALIZED"
  | "RELEVANCE_ACCEPTED"
  | "RELEVANCE_REJECTED"
  | "ENRICHED"
  | "ENRICHMENT_FAILED"
  | "DEDUPED"
  | "NARRATIVE_ASSIGNED"
  | "NARRATIVE_UPDATED"
  | "FINDING_GENERATED";
