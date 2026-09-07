/**
 * Claude CLI enricher — real structured LLM enrichment with zero API keys,
 * by shelling out to the locally-installed Claude Code CLI in headless mode
 * (`claude -p --output-format json`). Uses the developer's existing Claude
 * session; intended as the development/pilot bridge until an AI Gateway key
 * is configured (LlmEnricher), which uses the identical prompt and schema.
 *
 * Output is fence-stripped, JSON-parsed and Zod-validated; one retry on
 * malformed output. Failures are recorded by the enrichment stage as events.
 */
import { execFile, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import {
  EnrichmentResultSchema,
  type Enricher,
  type EnrichmentInput,
  type EnrichmentResult,
} from "./schema";
import { buildEnrichmentPrompt, ENRICHMENT_PROMPT_VERSION } from "./prompt";

const execFileAsync = promisify(execFile);

export function extractJsonObject(text: string): unknown {
  let candidate = text.trim();
  const fenceMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) candidate = fenceMatch[1].trim();
  // Fall back to the outermost braces if there is leading/trailing prose.
  if (!candidate.startsWith("{")) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) candidate = candidate.slice(start, end + 1);
  }
  return JSON.parse(candidate);
}

/**
 * Pull the human-readable reason out of a CLI result envelope.
 *
 * The CLI reports API-level problems — quota, auth, rate limits — inside a
 * JSON envelope on *stdout*, and may still exit non-zero with an empty
 * stderr. Reading only stderr therefore produced `claude-cli exited 1: `,
 * which says nothing about a spend limit or an expired session and makes a
 * whole stalled enrichment stage look like an unexplained crash.
 */
export function envelopeError(stdout: string): string | null {
  let envelope: { result?: unknown; api_error_status?: unknown };
  try {
    envelope = JSON.parse(stdout.trim());
  } catch {
    return null;
  }
  if (typeof envelope.result !== "string" || envelope.result.length === 0) return null;
  const status =
    typeof envelope.api_error_status === "number" ? ` (HTTP ${envelope.api_error_status})` : "";
  return `${envelope.result}${status}`;
}

export class ClaudeCliEnricher implements Enricher {
  provider = "claude-cli";
  promptVersion = ENRICHMENT_PROMPT_VERSION;
  model: string;

  constructor(model?: string) {
    this.model = model ?? process.env.CLAUDE_CLI_MODEL ?? "haiku";
  }

  /** Raw single-prompt invocation; also used by narrative adjudication. */
  async invoke(prompt: string): Promise<string> {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn("claude", ["-p", "--output-format", "json", "--model", this.model], {
        cwd: tmpdir(), // avoid loading this project's CLAUDE.md into context
        stdio: ["pipe", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("claude-cli timed out"));
      }, 180000);

      child.stdout.on("data", (chunk) => (out += chunk));
      child.stderr.on("data", (chunk) => (err += chunk));
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) return resolve(out);
        const reason = envelopeError(out) ?? err.trim() ?? "";
        reject(
          new Error(`claude-cli exited ${code}: ${reason.slice(0, 300) || "no diagnostic output"}`),
        );
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });

    const envelope = JSON.parse(stdout) as { is_error?: boolean; result?: string };
    if (envelope.is_error || typeof envelope.result !== "string") {
      throw new Error(
        `claude-cli returned an error envelope: ${envelopeError(stdout) ?? "no reason given"}`,
      );
    }
    return envelope.result;
  }

  async enrich(input: EnrichmentInput): Promise<EnrichmentResult> {
    const prompt = buildEnrichmentPrompt(input);
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.invoke(
          attempt === 0
            ? prompt
            : `${prompt}\n\nYour previous response was not valid JSON for the required schema. Respond with ONLY the JSON object.`,
        );
        return EnrichmentResultSchema.parse(extractJsonObject(raw));
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

/** True when the claude binary is on PATH (cheap sync check at startup). */
export async function claudeCliAvailable(): Promise<boolean> {
  try {
    await execFileAsync("claude", ["--version"], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}
