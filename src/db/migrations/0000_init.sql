CREATE TYPE "public"."author_type" AS ENUM('government', 'farmer', 'farmer_organisation', 'fpo', 'agriculture_expert', 'academic', 'journalist', 'media_organisation', 'politician', 'creator', 'dealer', 'ngo', 'citizen', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."data_origin" AS ENUM('live', 'verified_snapshot', 'demo_seed');--> statement-breakpoint
CREATE TYPE "public"."duplicate_type" AS ENUM('exact', 'near');--> statement-breakpoint
CREATE TYPE "public"."finding_category" AS ENUM('emerging', 'watch', 'divergence', 'influence', 'geographic');--> statement-breakpoint
CREATE TYPE "public"."mention_status" AS ENUM('normalized', 'rejected', 'enriched', 'duplicate', 'narrative_assigned');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('youtube', 'x', 'news', 'official', 'web');--> statement-breakpoint
CREATE TYPE "public"."relevance_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('negative', 'positive', 'neutral', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."stance" AS ENUM('critical', 'supportive', 'neutral', 'mixed');--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"platform" "platform" NOT NULL,
	"natural_key" text NOT NULL,
	"name" text NOT NULL,
	"handle" text,
	"bio" text,
	"author_type" "author_type" DEFAULT 'unknown' NOT NULL,
	"author_type_confidence" double precision,
	"is_official" boolean DEFAULT false NOT NULL,
	"data_origin" "data_origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid,
	"connector" text NOT NULL,
	"query" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"item_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text,
	"data_origin" "data_origin" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"finding_id" uuid NOT NULL,
	"mention_id" uuid NOT NULL,
	"role" text DEFAULT 'supporting' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "intelligence_findings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"narrative_id" uuid NOT NULL,
	"category" "finding_category" NOT NULL,
	"headline" text NOT NULL,
	"summary" text NOT NULL,
	"why_it_matters" text,
	"reason" text NOT NULL,
	"components" jsonb NOT NULL,
	"confidence" double precision NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"data_origin" "data_origin" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name_en" text NOT NULL,
	"name_te" text,
	"kind" text NOT NULL,
	"parent_id" uuid
);
--> statement-breakpoint
CREATE TABLE "mentions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"raw_item_id" uuid NOT NULL,
	"source_id" uuid,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"url" text,
	"published_at" timestamp with time zone,
	"collected_at" timestamp with time zone NOT NULL,
	"author_id" uuid,
	"language" text,
	"original_text" text NOT NULL,
	"english_translation" text,
	"translation_provenance" text,
	"title" text,
	"summary" text,
	"telangana_relevance" double precision,
	"agriculture_relevance" double precision,
	"relevance_status" "relevance_status" DEFAULT 'pending' NOT NULL,
	"relevance_reason" text,
	"district_id" uuid,
	"district" text,
	"mandal" text,
	"location_confidence" double precision,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtopics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schemes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"crops" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"government_entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sentiment" "sentiment",
	"stance" "stance",
	"claim" text,
	"claim_confidence" double precision,
	"engagement" jsonb,
	"classification_confidence" double precision,
	"is_official_voice" boolean DEFAULT false NOT NULL,
	"is_third_party_voice" boolean DEFAULT false NOT NULL,
	"status" "mention_status" DEFAULT 'normalized' NOT NULL,
	"content_hash" text,
	"duplicate_of_mention_id" uuid,
	"duplicate_type" "duplicate_type",
	"enrichment_meta" jsonb,
	"data_origin" "data_origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "narrative_mentions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"narrative_id" uuid NOT NULL,
	"mention_id" uuid NOT NULL,
	"role" text DEFAULT 'evidence' NOT NULL,
	"assigned_by" text DEFAULT 'rule' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "narrative_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"narrative_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"metrics" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "narratives" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"executive_summary" text,
	"explanation" text,
	"first_detected_at" timestamp with time zone,
	"last_detected_at" timestamp with time zone,
	"mention_count" integer DEFAULT 0 NOT NULL,
	"unique_author_count" integer DEFAULT 0 NOT NULL,
	"source_mix" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"voice_mix" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"districts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stance_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stance_by_voice" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" double precision,
	"data_origin" "data_origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"collection_run_id" uuid,
	"raw_item_id" uuid,
	"mention_id" uuid,
	"narrative_id" uuid,
	"finding_id" uuid,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"collection_run_id" uuid NOT NULL,
	"source_id" uuid,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"collected_at" timestamp with time zone NOT NULL,
	"data_origin" "data_origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"platform" "platform" NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_runs" ADD CONSTRAINT "collection_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_finding_id_intelligence_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."intelligence_findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_mention_id_mentions_id_fk" FOREIGN KEY ("mention_id") REFERENCES "public"."mentions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_findings" ADD CONSTRAINT "intelligence_findings_narrative_id_narratives_id_fk" FOREIGN KEY ("narrative_id") REFERENCES "public"."narratives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_raw_item_id_raw_items_id_fk" FOREIGN KEY ("raw_item_id") REFERENCES "public"."raw_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_district_id_locations_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_mentions" ADD CONSTRAINT "narrative_mentions_narrative_id_narratives_id_fk" FOREIGN KEY ("narrative_id") REFERENCES "public"."narratives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_mentions" ADD CONSTRAINT "narrative_mentions_mention_id_mentions_id_fk" FOREIGN KEY ("mention_id") REFERENCES "public"."mentions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_snapshots" ADD CONSTRAINT "narrative_snapshots_narrative_id_narratives_id_fk" FOREIGN KEY ("narrative_id") REFERENCES "public"."narratives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_items" ADD CONSTRAINT "raw_items_collection_run_id_collection_runs_id_fk" FOREIGN KEY ("collection_run_id") REFERENCES "public"."collection_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_items" ADD CONSTRAINT "raw_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authors_natural_key_idx" ON "authors" USING btree ("platform","natural_key","data_origin");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_links_idx" ON "evidence_links" USING btree ("finding_id","mention_id");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_key_idx" ON "locations" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "mentions_natural_key_idx" ON "mentions" USING btree ("platform","external_id","data_origin");--> statement-breakpoint
CREATE UNIQUE INDEX "mentions_raw_item_idx" ON "mentions" USING btree ("raw_item_id");--> statement-breakpoint
CREATE INDEX "mentions_status_idx" ON "mentions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mentions_content_hash_idx" ON "mentions" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "narrative_mentions_idx" ON "narrative_mentions" USING btree ("narrative_id","mention_id");--> statement-breakpoint
CREATE UNIQUE INDEX "narratives_key_idx" ON "narratives" USING btree ("key","data_origin");--> statement-breakpoint
CREATE INDEX "processing_events_mention_idx" ON "processing_events" USING btree ("mention_id");--> statement-breakpoint
CREATE INDEX "processing_events_type_idx" ON "processing_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_items_natural_key_idx" ON "raw_items" USING btree ("platform","external_id","data_origin");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_key_idx" ON "sources" USING btree ("key");