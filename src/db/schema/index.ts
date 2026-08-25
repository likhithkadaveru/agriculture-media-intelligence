/**
 * Phase 1 database schema — minimum set for the vertical slice.
 *
 * Identifier strategy: application-generated UUID v4 primary keys plus
 * natural-key unique constraints for idempotency (platform + external id +
 * data origin). Raw payloads are immutable once written.
 *
 * Every data-bearing table carries data_origin: 'live' | 'verified_snapshot'
 * | 'demo_seed'. Demo seed data is never presented as live.
 */
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const dataOriginEnum = pgEnum("data_origin", [
  "live",
  "verified_snapshot",
  "demo_seed",
]);

export const platformEnum = pgEnum("platform", [
  "youtube",
  "x",
  "news",
  "official",
  "web",
]);

export const authorTypeEnum = pgEnum("author_type", [
  "government",
  "farmer",
  "farmer_organisation",
  "fpo",
  "agriculture_expert",
  "academic",
  "journalist",
  "media_organisation",
  "politician",
  "creator",
  "dealer",
  "ngo",
  "citizen",
  "unknown",
]);

export const sentimentEnum = pgEnum("sentiment", [
  "negative",
  "positive",
  "neutral",
  "mixed",
]);

export const stanceEnum = pgEnum("stance", [
  "critical",
  "supportive",
  "neutral",
  "mixed",
]);

export const relevanceStatusEnum = pgEnum("relevance_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const mentionStatusEnum = pgEnum("mention_status", [
  "normalized",
  "rejected",
  "enriched",
  "duplicate",
  "narrative_assigned",
]);

export const duplicateTypeEnum = pgEnum("duplicate_type", ["exact", "near"]);

export const findingCategoryEnum = pgEnum("finding_category", [
  "emerging",
  "watch",
  "divergence",
  "influence",
  "geographic",
]);

/* ------------------------------------------------------------------ */

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    platform: platformEnum("platform").notNull(),
    isOfficial: boolean("is_official").notNull().default(false),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sources_key_idx").on(t.key)],
);

export const collectionRuns = pgTable("collection_runs", {
  id: uuid("id").primaryKey(),
  sourceId: uuid("source_id").references(() => sources.id),
  connector: text("connector").notNull(),
  query: text("query"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  itemCount: integer("item_count").notNull().default(0),
  status: text("status").notNull().default("running"), // running | succeeded | failed
  error: text("error"),
  dataOrigin: dataOriginEnum("data_origin").notNull(),
});

export const rawItems = pgTable(
  "raw_items",
  {
    id: uuid("id").primaryKey(),
    collectionRunId: uuid("collection_run_id")
      .notNull()
      .references(() => collectionRuns.id),
    sourceId: uuid("source_id").references(() => sources.id),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    /** Immutable connector-native payload. Never updated after insert. */
    payload: jsonb("payload").notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull(),
    dataOrigin: dataOriginEnum("data_origin").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("raw_items_natural_key_idx").on(t.platform, t.externalId, t.dataOrigin),
  ],
);

export const authors = pgTable(
  "authors",
  {
    id: uuid("id").primaryKey(),
    platform: platformEnum("platform").notNull(),
    /** platform + (handle ?? name), lowercased — idempotent author identity. */
    naturalKey: text("natural_key").notNull(),
    name: text("name").notNull(),
    handle: text("handle"),
    bio: text("bio"),
    authorType: authorTypeEnum("author_type").notNull().default("unknown"),
    authorTypeConfidence: doublePrecision("author_type_confidence"),
    isOfficial: boolean("is_official").notNull().default(false),
    dataOrigin: dataOriginEnum("data_origin").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("authors_natural_key_idx").on(t.platform, t.naturalKey, t.dataOrigin)],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey(),
    /** Ontology id, e.g. "karimnagar" or "karimnagar/huzurabad". */
    key: text("key").notNull(),
    nameEn: text("name_en").notNull(),
    nameTe: text("name_te"),
    kind: text("kind").notNull(), // state | district | mandal
    parentId: uuid("parent_id"),
  },
  (t) => [uniqueIndex("locations_key_idx").on(t.key)],
);

export const mentions = pgTable(
  "mentions",
  {
    id: uuid("id").primaryKey(),
    rawItemId: uuid("raw_item_id")
      .notNull()
      .references(() => rawItems.id),
    sourceId: uuid("source_id").references(() => sources.id),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull(),

    authorId: uuid("author_id").references(() => authors.id),

    language: text("language"), // te | en | mixed | other — null until detected
    originalText: text("original_text").notNull(),
    /**
     * Author-written content with channel boilerplate removed (derived, not
     * source). Relevance, dedup and enrichment read this; original_text is
     * kept verbatim as evidence.
     */
    contentText: text("content_text"),
    englishTranslation: text("english_translation"),
    translationProvenance: text("translation_provenance"), // llm | seed_authored
    title: text("title"),
    summary: text("summary"),

    telanganaRelevance: doublePrecision("telangana_relevance"),
    agricultureRelevance: doublePrecision("agriculture_relevance"),
    relevanceStatus: relevanceStatusEnum("relevance_status").notNull().default("pending"),
    relevanceReason: text("relevance_reason"),

    districtId: uuid("district_id").references(() => locations.id),
    district: text("district"),
    mandal: text("mandal"),
    locationConfidence: doublePrecision("location_confidence"),

    topics: jsonb("topics").$type<string[]>().notNull().default([]),
    subtopics: jsonb("subtopics").$type<string[]>().notNull().default([]),
    schemes: jsonb("schemes").$type<string[]>().notNull().default([]),
    crops: jsonb("crops").$type<string[]>().notNull().default([]),
    governmentEntities: jsonb("government_entities").$type<string[]>().notNull().default([]),

    sentiment: sentimentEnum("sentiment"),
    stance: stanceEnum("stance"),
    claim: text("claim"),
    claimConfidence: doublePrecision("claim_confidence"),

    engagement: jsonb("engagement").$type<{
      views?: number | null;
      likes?: number | null;
      comments?: number | null;
      reposts?: number | null;
    }>(),

    thumbnailUrl: text("thumbnail_url"),
    /** unavailable | available | not_applicable — never fabricated. */
    transcriptStatus: text("transcript_status"),

    classificationConfidence: doublePrecision("classification_confidence"),
    isOfficialVoice: boolean("is_official_voice").notNull().default(false),
    isThirdPartyVoice: boolean("is_third_party_voice").notNull().default(false),

    status: mentionStatusEnum("status").notNull().default("normalized"),

    contentHash: text("content_hash"),
    duplicateOfMentionId: uuid("duplicate_of_mention_id"),
    duplicateType: duplicateTypeEnum("duplicate_type"),

    /** provider/model/promptVersion/durationMs/success for the last enrichment. */
    enrichmentMeta: jsonb("enrichment_meta").$type<{
      provider: string;
      model: string;
      promptVersion: string;
      durationMs: number;
      success: boolean;
      enrichedAt: string;
    }>(),

    dataOrigin: dataOriginEnum("data_origin").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mentions_natural_key_idx").on(t.platform, t.externalId, t.dataOrigin),
    uniqueIndex("mentions_raw_item_idx").on(t.rawItemId),
    index("mentions_status_idx").on(t.status),
    index("mentions_content_hash_idx").on(t.contentHash),
  ],
);

export const narratives = pgTable(
  "narratives",
  {
    id: uuid("id").primaryKey(),
    key: text("key").notNull(),
    title: text("title").notNull(),
    executiveSummary: text("executive_summary"),
    explanation: text("explanation"),
    firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }),
    lastDetectedAt: timestamp("last_detected_at", { withTimezone: true }),
    mentionCount: integer("mention_count").notNull().default(0),
    uniqueAuthorCount: integer("unique_author_count").notNull().default(0),
    sourceMix: jsonb("source_mix").$type<Record<string, number>>().notNull().default({}),
    voiceMix: jsonb("voice_mix").$type<Record<string, number>>().notNull().default({}),
    districts: jsonb("districts").$type<Record<string, number>>().notNull().default({}),
    stanceSummary: jsonb("stance_summary").$type<Record<string, number>>().notNull().default({}),
    /** Stance distribution partitioned by voice class — divergence raw material. */
    stanceByVoice: jsonb("stance_by_voice")
      .$type<Record<string, Record<string, number>>>()
      .notNull()
      .default({}),
    /** emerging | rising | stable | falling | resurfacing (observation-window based). */
    trendStatus: text("trend_status"),
    confidence: doublePrecision("confidence"),
    dataOrigin: dataOriginEnum("data_origin").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("narratives_key_idx").on(t.key, t.dataOrigin)],
);

export const narrativeMentions = pgTable(
  "narrative_mentions",
  {
    id: uuid("id").primaryKey(),
    narrativeId: uuid("narrative_id")
      .notNull()
      .references(() => narratives.id),
    mentionId: uuid("mention_id")
      .notNull()
      .references(() => mentions.id),
    /** evidence | representative | duplicate — duplicates never inflate counts. */
    role: text("role").notNull().default("evidence"),
    assignedBy: text("assigned_by").notNull().default("rule"), // rule | model
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("narrative_mentions_idx").on(t.narrativeId, t.mentionId)],
);

export const narrativeSnapshots = pgTable("narrative_snapshots", {
  id: uuid("id").primaryKey(),
  narrativeId: uuid("narrative_id")
    .notNull()
    .references(() => narratives.id),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  metrics: jsonb("metrics").notNull(),
});

export const intelligenceFindings = pgTable("intelligence_findings", {
  id: uuid("id").primaryKey(),
  narrativeId: uuid("narrative_id")
    .notNull()
    .references(() => narratives.id),
  category: findingCategoryEnum("category").notNull(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  whyItMatters: text("why_it_matters"),
  /** Human-readable explanation of why this finding was generated. */
  reason: text("reason").notNull(),
  /** Named component metrics — no opaque scores. */
  components: jsonb("components").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  rank: integer("rank").notNull().default(0),
  status: text("status").notNull().default("active"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
  dataOrigin: dataOriginEnum("data_origin").notNull(),
});

export const evidenceLinks = pgTable(
  "evidence_links",
  {
    id: uuid("id").primaryKey(),
    findingId: uuid("finding_id")
      .notNull()
      .references(() => intelligenceFindings.id),
    mentionId: uuid("mention_id")
      .notNull()
      .references(() => mentions.id),
    role: text("role").notNull().default("supporting"), // supporting | representative | official | duplicate
    note: text("note"),
  },
  (t) => [uniqueIndex("evidence_links_idx").on(t.findingId, t.mentionId)],
);

/**
 * Query scheduler — quota-aware collection planning. Rows describe both
 * ontology-generated search queries (youtube-api) and channel polls
 * (youtube-rss, query = channel id). Yield statistics accumulate so poor
 * queries can be deprioritized.
 */
export const collectionQueries = pgTable(
  "collection_queries",
  {
    id: uuid("id").primaryKey(),
    /** Connector key this query is for (e.g. youtube-api, youtube-rss). */
    connector: text("connector").notNull(),
    query: text("query").notNull(),
    /** Human label, e.g. channel name for RSS polls. */
    label: text("label"),
    language: text("language"), // te | en | mixed | null
    /** a = every cycle, b = rotated, c = long-tail rotation. */
    tier: text("tier").notNull().default("b"),
    priority: integer("priority").notNull().default(50),
    frequencyHours: integer("frequency_hours").notNull().default(24),
    expectedNoise: text("expected_noise"), // low | medium | high
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    /** Cumulative yield stats. */
    runsCount: integer("runs_count").notNull().default(0),
    itemsReturned: integer("items_returned").notNull().default(0),
    relevantItems: integer("relevant_items").notNull().default(0),
    duplicateItems: integer("duplicate_items").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("collection_queries_key_idx").on(t.connector, t.query)],
);

/**
 * Verified snapshots — frozen copies of a real (live) intelligence state,
 * suitable for offline/demo use. Copied rows carry
 * data_origin = 'verified_snapshot'; live rows are never mutated.
 * Phase 2 supports one active snapshot at a time (creating a new one
 * replaces the previous copy; the manifest rows record history).
 */
export const verifiedSnapshots = pgTable("verified_snapshots", {
  id: uuid("id").primaryKey(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Row counts, source list, time range — the reproducibility manifest. */
  manifest: jsonb("manifest").notNull(),
  status: text("status").notNull().default("active"), // active | replaced
});

export const processingEvents = pgTable(
  "processing_events",
  {
    id: uuid("id").primaryKey(),
    eventType: text("event_type").notNull(),
    collectionRunId: uuid("collection_run_id"),
    rawItemId: uuid("raw_item_id"),
    mentionId: uuid("mention_id"),
    narrativeId: uuid("narrative_id"),
    findingId: uuid("finding_id"),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("processing_events_mention_idx").on(t.mentionId),
    index("processing_events_type_idx").on(t.eventType),
  ],
);
