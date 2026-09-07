/**
 * LLM enricher + enricher selection.
 *
 * Selection order (override with ENRICHER=heuristic|openai|gateway|claude-cli):
 *   1. OPENAI_API_KEY present  → LlmEnricher against OpenAI directly
 *   2. AI Gateway key present  → LlmEnricher against the gateway
 *   3. local Claude Code CLI   → ClaudeCliEnricher
 *   4. deterministic HeuristicEnricher
 *
 * An API key is preferred over the CLI deliberately. The CLI authenticates
 * with an OAuth session that expires, and when it did, every enrichment in
 * every cycle failed silently for a day — an unattended collector needs a
 * credential that does not time out.
 *
 * All satisfy the same Zod contract; the pipeline cannot tell them apart
 * except through the enrichment metadata each records.
 */
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
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

/*
 * Default model per route, overridable with LLM_MODEL.
 *
 * gpt-5.4-mini was chosen by measurement, not reputation. On a real Telugu
 * headline the cheaper gpt-4.1-mini returned the right stance but null for
 * both district and department — it would have left the department tagging
 * permanently empty. gpt-5.5 matched 5.4-mini's answers but took 6.8s to its
 * 2.9s, which across a 2,900-item backlog is hours, not seconds.
 */
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_GATEWAY_MODEL = "anthropic/claude-sonnet-4-5";

export class LlmEnricher implements Enricher {
  provider: string;
  promptVersion = ENRICHMENT_PROMPT_VERSION;
  model: string;
  /** Direct-provider handle; undefined when routing through the gateway. */
  private openai?: ReturnType<typeof createOpenAI>;

  constructor(model?: string, route: "openai" | "gateway" = "gateway") {
    if (route === "openai") {
      this.provider = "openai";
      this.model = model ?? process.env.LLM_MODEL ?? DEFAULT_OPENAI_MODEL;
      this.openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      this.provider = "ai-gateway";
      this.model = model ?? process.env.LLM_MODEL ?? DEFAULT_GATEWAY_MODEL;
    }
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentResult> {
    const { object } = await generateObject({
      // The gateway takes a "provider/model" string; a direct provider takes
      // a model handle. Same call either way from here down.
      model: this.openai ? this.openai(this.model) : this.model,
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
  if (override === "openai") return new LlmEnricher(undefined, "openai");
  if (override === "gateway") return new LlmEnricher(undefined, "gateway");
  if (override === "claude-cli") return new ClaudeCliEnricher();

  if (process.env.OPENAI_API_KEY) {
    return new LlmEnricher(undefined, "openai");
  }
  if (process.env.AI_GATEWAY_API_KEY || process.env.LLM_API_KEY) {
    return new LlmEnricher(undefined, "gateway");
  }
  if (await claudeCliAvailable()) {
    return new ClaudeCliEnricher();
  }
  return new HeuristicEnricher();
}
