-- What is happening, and whose desk it lands on.
--
-- Both nullable with no backfill: rows enriched under prompt llm-v2 were
-- never asked either question, and inferring an answer now would be
-- indistinguishable, later, from one the model actually gave.
ALTER TABLE "mentions" ADD COLUMN "event_type" text;
--> statement-breakpoint
ALTER TABLE "mentions" ADD COLUMN "department" text;
--> statement-breakpoint
CREATE INDEX "mentions_event_type_idx" ON "mentions" ("event_type") WHERE "event_type" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "mentions_department_idx" ON "mentions" ("department") WHERE "department" IS NOT NULL;
