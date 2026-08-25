CREATE TABLE "collection_queries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"connector" text NOT NULL,
	"query" text NOT NULL,
	"label" text,
	"language" text,
	"tier" text DEFAULT 'b' NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"frequency_hours" integer DEFAULT 24 NOT NULL,
	"expected_noise" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"runs_count" integer DEFAULT 0 NOT NULL,
	"items_returned" integer DEFAULT 0 NOT NULL,
	"relevant_items" integer DEFAULT 0 NOT NULL,
	"duplicate_items" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verified_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"manifest" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "transcript_status" text;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_queries_key_idx" ON "collection_queries" USING btree ("connector","query");