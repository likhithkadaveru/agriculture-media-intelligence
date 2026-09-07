-- Whether a video was airing when we collected it.
--
-- Nullable with no backfill on purpose: every existing row was collected
-- without the field being requested from the API, so its broadcast state at
-- collection time is genuinely unknown. Guessing "ended" for old rows would
-- invent history the pipeline never observed.
ALTER TABLE "mentions" ADD COLUMN "broadcast_status" text;
--> statement-breakpoint
CREATE INDEX "mentions_broadcast_status_idx" ON "mentions" ("broadcast_status") WHERE "broadcast_status" IS NOT NULL;
