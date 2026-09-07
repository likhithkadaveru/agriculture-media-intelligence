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

  /*
   * What is physically happening. Separate from stance on purpose: a rally is
   * an event whether or not the reporting takes a side, and an officer needs
   * to be told one is under way even when the coverage is perfectly neutral.
   * Nullable but NOT defaulted: OpenAI's strict structured outputs require
   * every property to appear in `required`, and a Zod default makes the field
   * optional in the emitted JSON schema — which the API rejects outright
   * ("'required' is required to be supplied and to be an array including
   * every key in properties"). The prompt always asks for both, so a plain
   * nullable is both accepted and honest.
   */
  eventType: z
    .enum(["protest", "rally", "meeting", "inspection", "launch", "arrest", "disaster"])
    .nullable(),
  /** Arm of the Agriculture & Cooperation Department this concerns. */
  department: z.string().nullable(),

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
