/**
 * Enrichment stage runner — applies the active enricher to relevance-accepted
 * mentions, validates the structured output, persists it with full metadata
 * (provider, model, prompt version, duration, success), and records events.
 */
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { authors, mentions, locations } from "@/db/schema";
import { recordEvent } from "@/lib/events";
import { getSeedTranslations } from "@/ingestion/router";
import { DISTRICTS } from "@/ontology";
import type { Enricher } from "./schema";

export interface EnrichmentStageResult {
  processed: number;
  succeeded: number;
  failed: number;
}

export async function runEnrichmentStage(
  db: Db,
  enricher: Enricher,
): Promise<EnrichmentStageResult> {
  const candidates = await db
    .select()
    .from(mentions)
    .where(and(eq(mentions.status, "normalized"), eq(mentions.relevanceStatus, "accepted")));

  const seedTranslations = await getSeedTranslations(
    db,
    candidates.map((m) => m.id),
  );

  const districtRows = await db
    .select()
    .from(locations)
    .where(inArray(locations.key, DISTRICTS.map((d) => d.id)));
  const districtIdByKey = new Map(districtRows.map((r) => [r.key, r.id]));
  const districtNameByKey = new Map(DISTRICTS.map((d) => [d.id, d.en]));

  let succeeded = 0;
  let failed = 0;

  for (const mention of candidates) {
    const author = mention.authorId
      ? (await db.select().from(authors).where(eq(authors.id, mention.authorId)))[0]
      : null;

    const started = Date.now();
    try {
      const result = await enricher.enrich({
        platform: mention.platform,
        title: mention.title,
        originalText: mention.originalText,
        authorName: author?.name ?? null,
        authorBio: author?.bio ?? null,
        isOfficialAccount: author?.isOfficial ?? false,
        dataOrigin: mention.dataOrigin,
        seedTranslation: seedTranslations.get(mention.id) ?? null,
      });
      const durationMs = Date.now() - started;

      const isOfficialVoice = result.authorType === "government";
      const enrichmentMeta = {
        provider: enricher.provider,
        model: enricher.model,
        promptVersion: enricher.promptVersion,
        durationMs,
        success: true,
        enrichedAt: new Date().toISOString(),
      };

      await db
        .update(mentions)
        .set({
          language: result.language,
          telanganaRelevance: result.telanganaRelevance,
          agricultureRelevance: result.agricultureRelevance,
          topics: result.topics,
          subtopics: result.subtopics,
          schemes: result.schemes,
          crops: result.crops,
          governmentEntities: result.governmentEntities,
          district: result.district ? (districtNameByKey.get(result.district) ?? result.district) : null,
          districtId: result.district ? (districtIdByKey.get(result.district) ?? null) : null,
          mandal: result.mandal,
          locationConfidence: result.locationConfidence,
          sentiment: result.sentiment,
          stance: result.stance,
          claim: result.claim,
          claimConfidence: result.claimConfidence,
          englishTranslation: result.englishTranslation,
          translationProvenance: result.englishTranslation
            ? enricher.provider === "heuristic"
              ? "seed_authored"
              : "llm"
            : null,
          summary: result.summary,
          classificationConfidence: result.confidence,
          isOfficialVoice,
          isThirdPartyVoice: !isOfficialVoice,
          status: "enriched",
          enrichmentMeta,
          updatedAt: new Date(),
        })
        .where(eq(mentions.id, mention.id));

      // Keep author classification on the author record too.
      if (author && result.authorType !== "unknown") {
        await db
          .update(authors)
          .set({
            authorType: result.authorType,
            authorTypeConfidence: result.authorTypeConfidence,
            isOfficial: isOfficialVoice || author.isOfficial,
          })
          .where(eq(authors.id, author.id));
      }

      await recordEvent(db, "ENRICHED", {
        mentionId: mention.id,
        rawItemId: mention.rawItemId,
        detail: enrichmentMeta,
      });
      succeeded++;
    } catch (error) {
      const durationMs = Date.now() - started;
      await recordEvent(db, "ENRICHMENT_FAILED", {
        mentionId: mention.id,
        rawItemId: mention.rawItemId,
        detail: {
          provider: enricher.provider,
          model: enricher.model,
          promptVersion: enricher.promptVersion,
          durationMs,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      failed++;
    }
  }

  return { processed: candidates.length, succeeded, failed };
}
