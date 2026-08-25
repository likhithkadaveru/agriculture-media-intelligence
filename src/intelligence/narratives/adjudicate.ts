/**
 * LLM narrative adjudication — optional refinement pass.
 *
 * For each narrative with enough evidence, an LLM proposes a precise title
 * and a 2–3 sentence synthesis grounded ONLY in the representative evidence
 * shown to it. Output is Zod-validated; the deterministic title/summary
 * always remain as fallback (synthesis is stored in `explanation`, never
 * replacing the computed executive summary). Skipped silently when no LLM
 * path is available.
 */
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { mentions, narrativeMentions, narratives } from "@/db/schema";
import { ClaudeCliEnricher, claudeCliAvailable, extractJsonObject } from "@/intelligence/enrichment/claude-cli";

const AdjudicationSchema = z.object({
  title: z.string().min(8).max(90),
  synthesis: z.string().min(40).max(600),
});

export async function adjudicateNarratives(
  db: Db,
  opts?: { minMentions?: number; log?: (m: string) => void },
): Promise<{ adjudicated: number; skipped: string }> {
  const minMentions = opts?.minMentions ?? 3;
  const log = opts?.log ?? (() => {});

  if (process.env.ENRICHER === "heuristic" || !(await claudeCliAvailable())) {
    return { adjudicated: 0, skipped: "no LLM path available" };
  }
  const cli = new ClaudeCliEnricher();

  const allNarratives = await db.select().from(narratives);
  let adjudicated = 0;

  for (const narrative of allNarratives) {
    if (narrative.mentionCount < minMentions) continue;
    // Adjudicate once per narrative; the refined title survives re-aggregation
    // (the narrative stage preserves titles when an explanation exists).
    if (narrative.explanation) continue;

    const links = await db
      .select()
      .from(narrativeMentions)
      .where(
        and(
          eq(narrativeMentions.narrativeId, narrative.id),
          eq(narrativeMentions.role, "evidence"),
        ),
      );
    const evidence = await db
      .select()
      .from(mentions)
      .where(inArray(mentions.id, links.map((l) => l.mentionId)));
    const representative = evidence
      .sort((a, b) => (b.engagement?.views ?? 0) - (a.engagement?.views ?? 0))
      .slice(0, 6);

    const prompt = [
      "You name and summarise one public-discussion narrative for a Telangana agriculture intelligence system.",
      "Ground yourself ONLY in the evidence lines below. Do not invent facts, numbers, causes or locations not present.",
      "The title must be a specific, neutral, executive-quality noun phrase (max 80 chars) — not a headline, not sensational.",
      "The synthesis is 2–3 plain sentences in English describing what is being discussed and by whom.",
      'Respond with ONLY a JSON object: {"title": "...", "synthesis": "..."}',
      "",
      `CURRENT WORKING TITLE: ${narrative.title}`,
      "EVIDENCE:",
      ...representative.map((m, i) => {
        const summary = m.summary ?? m.englishTranslation ?? m.title ?? m.originalText.slice(0, 160);
        return `${i + 1}. [${m.platform}] ${summary}`;
      }),
    ].join("\n");

    try {
      const raw = await cli.invoke(prompt);
      const parsed = AdjudicationSchema.parse(extractJsonObject(raw));
      await db
        .update(narratives)
        .set({ title: parsed.title, explanation: parsed.synthesis, updatedAt: new Date() })
        .where(eq(narratives.id, narrative.id));
      adjudicated++;
      log(`adjudicated: "${parsed.title}"`);
    } catch {
      log(`adjudication failed for ${narrative.key}; deterministic title retained`);
    }
  }

  return { adjudicated, skipped: "" };
}
