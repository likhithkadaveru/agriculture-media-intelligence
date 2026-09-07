-- Cadence moves from hours to minutes.
--
-- A rename plus a conversion rather than a drop and re-add: every row carries
-- a cadence that was tuned per source, and dropping the column would reset all
-- 320 of them to the default and silently re-poll the paid sources.
ALTER TABLE "collection_queries" RENAME COLUMN "frequency_hours" TO "frequency_minutes";
--> statement-breakpoint
ALTER TABLE "collection_queries" ALTER COLUMN "frequency_minutes" DROP DEFAULT;
--> statement-breakpoint
UPDATE "collection_queries" SET "frequency_minutes" = "frequency_minutes" * 60;
--> statement-breakpoint
ALTER TABLE "collection_queries" ALTER COLUMN "frequency_minutes" SET DEFAULT 1440;
