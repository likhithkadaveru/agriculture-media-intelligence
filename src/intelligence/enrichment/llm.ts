/**
 * LLM enricher — structured extraction through the Vercel AI SDK with the
 * same Zod contract as the heuristic enricher. Inactive until an LLM
 * credential is configured (AI_GATEWAY_API_KEY, or ANTHROPIC_API_KEY with a
 * gateway model string); selection happens in getEnricher().
 *
 * generateObject enforces EnrichmentResultSchema at the call layer, so a
 * malformed model response never reaches the database.
 */
import { generateObject } from "ai";
import {
  DISTRICTS,
  CROPS,
  GOVERNMENT_ENTITIES,
  SCHEMES,
  TOPICS,
} from "@/ontology";
import {
  EnrichmentResultSchema,
  type Enricher,
  type EnrichmentInput,
  type EnrichmentResult,
} from "./schema";
import { HeuristicEnricher } from "./heuristic";

export const ENRICHMENT_PROMPT_VERSION = "llm-v1";

function buildPrompt(input: EnrichmentInput): string {
  return [
    "You analyse public content about Telangana agriculture for a government intelligence system.",
    "Extract ONLY what the text supports. Use null when information is absent — never guess districts, claims, or author attributes.",
    "",
    `Allowed topic ids: ${TOPICS.map((t) => t.id).join(", ")}`,
    `Allowed scheme ids: ${SCHEMES.map((s) => s.id).join(", ")}`,
    `Allowed crop ids: ${CROPS.map((c) => c.id).join(", ")}`,
    `Allowed government entity ids: ${GOVERNMENT_ENTITIES.map((e) => e.id).join(", ")}`,
    `Allowed district ids: ${DISTRICTS.map((d) => d.id).join(", ")} (null if not clearly evidenced)`,
    "",
    "Stance is the author's stance toward the government/public authorities on this issue.",
    "If the text is Telugu or mixed, provide a faithful English translation; otherwise englishTranslation is null.",
    "claim: one falsifiable factual assertion the content makes, or null.",
    "",
    `PLATFORM: ${input.platform}`,
    `AUTHOR: ${input.authorName ?? "unknown"}`,
    `AUTHOR BIO: ${input.authorBio ?? "unknown"}`,
    `OFFICIAL ACCOUNT: ${input.isOfficialAccount}`,
    input.title ? `TITLE: ${input.title}` : "",
    "TEXT:",
    input.originalText,
  ]
    .filter(Boolean)
    .join("\n");
}

export class LlmEnricher implements Enricher {
  provider = "ai-gateway";
  promptVersion = ENRICHMENT_PROMPT_VERSION;
  model: string;

  constructor(model?: string) {
    this.model = model ?? process.env.LLM_MODEL ?? "anthropic/claude-sonnet-4-5";
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentResult> {
    const { object } = await generateObject({
      model: this.model,
      schema: EnrichmentResultSchema,
      prompt: buildPrompt(input),
    });
    return object;
  }
}

/** Select the active enricher based on available credentials. */
export function getEnricher(): Enricher {
  if (process.env.AI_GATEWAY_API_KEY || process.env.LLM_API_KEY) {
    return new LlmEnricher();
  }
  return new HeuristicEnricher();
}
