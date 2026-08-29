/**
 * Structured enrichment contract. EVERY enricher (heuristic or LLM) must
 * produce output that parses against this schema before it can touch the
 * database or the UI. LLM responses are never trusted raw.
 */
import { z } from "zod";

export const EnrichmentResultSchema = z.object({
  language: z.enum(["te", "en", "mixed", "other"]),

  telanganaRelevance: z.number().min(0).max(1),
  agricultureRelevance: z.number().min(0).max(1),

  topics: z.array(z.string()),
  subtopics: z.array(z.string()),
  schemes: z.array(z.string()),
  crops: z.array(z.string()),
  governmentEntities: z.array(z.string()),

  /** Ontology district id, or null when no district is evidenced. */
  district: z.string().nullable(),
  mandal: z.string().nullable(),
  locationConfidence: z.number().min(0).max(1).nullable(),

  authorType: z.enum([
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
  ]),
  authorTypeConfidence: z.number().min(0).max(1).nullable(),

  sentiment: z.enum(["negative", "positive", "neutral", "mixed"]),
  stance: z.enum(["critical", "supportive", "neutral", "mixed"]),

  claim: z.string().nullable(),
  claimConfidence: z.number().min(0).max(1).nullable(),

  englishTranslation: z.string().nullable(),
  summary: z.string().nullable(),

  /** Overall classification confidence for this enrichment. */
  confidence: z.number().min(0).max(1),
});

export type EnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

export interface EnrichmentInput {
  platform: string;
  title: string | null;
  originalText: string;
  authorName: string | null;
  authorBio: string | null;
  isOfficialAccount: boolean;
  dataOrigin: string;
  /** Spoken-word transcript for video items; null when none was retrievable. */
  transcript?: string | null;
  /** Development-only, demo_seed corpus translations. */
  seedTranslation?: string | null;
}

export interface EnrichmentMeta {
  provider: string;
  model: string;
  promptVersion: string;
  durationMs: number;
  success: boolean;
  enrichedAt: string;
}

export interface Enricher {
  provider: string;
  model: string;
  promptVersion: string;
  enrich(input: EnrichmentInput): Promise<EnrichmentResult>;
}
