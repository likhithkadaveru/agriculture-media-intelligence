/**
 * LLM enricher (AI Gateway) + enricher selection.
 *
 * Selection order (override with ENRICHER=heuristic|gateway|claude-cli):
 *   1. AI Gateway key present → LlmEnricher (Vercel AI SDK, generateObject)
 *   2. local Claude Code CLI available → ClaudeCliEnricher
 *   3. deterministic HeuristicEnricher
 *
 * All three satisfy the same Zod contract; the pipeline cannot tell them
 * apart except through recorded enrichment metadata.
 */
import { generateObject } from "ai";
import {
  EnrichmentResultSchema,
  type Enricher,
  type EnrichmentInput,
  type EnrichmentResult,
} from "./schema";
import { buildEnrichmentPrompt, ENRICHMENT_PROMPT_VERSION } from "./prompt";
import { HeuristicEnricher } from "./heuristic";
import { ClaudeCliEnricher, claudeCliAvailable } from "./claude-cli";

export { ENRICHMENT_PROMPT_VERSION };

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
      prompt: buildEnrichmentPrompt(input),
    });
    return object;
  }
}

/** Select the active enricher based on override + available credentials. */
export async function getEnricher(): Promise<Enricher> {
  const override = process.env.ENRICHER;
  if (override === "heuristic") return new HeuristicEnricher();
  if (override === "gateway") return new LlmEnricher();
  if (override === "claude-cli") return new ClaudeCliEnricher();

  if (process.env.AI_GATEWAY_API_KEY || process.env.LLM_API_KEY) {
    return new LlmEnricher();
  }
  if (await claudeCliAvailable()) {
    return new ClaudeCliEnricher();
  }
  return new HeuristicEnricher();
}
