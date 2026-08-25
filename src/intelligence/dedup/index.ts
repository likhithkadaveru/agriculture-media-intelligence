/**
 * Deduplication stage.
 *
 * Exact duplicates: sha256 over aggressively normalized text.
 * Near duplicates: Jaccard similarity over 3-word shingles (conservative
 * threshold), pairwise within the enriched set. O(n²) is acceptable at
 * Phase 1 volumes; the interface allows swapping in MinHash/embeddings later
 * without touching callers.
 *
 * Duplicates are RETAINED as evidence — status "duplicate", pointing at the
 * canonical mention (earliest published) — and excluded from narrative
 * volume counts.
 */
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { mentions } from "@/db/schema";
import { recordEvent } from "@/lib/events";

export function normalizeForHash(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ") // drop punctuation; keep letters AND combining marks (Telugu matras are \p{M})
    .replace(/\s+/g, " ")
    .trim();
}

export function contentHash(text: string): string {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex");
}

export function shingles(text: string, size = 2): Set<string> {
  const words = normalizeForHash(text).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i <= words.length - size; i++) {
    out.add(words.slice(i, i + size).join(" "));
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Combined near-duplicate rule, calibrated against the development corpus:
 * lightly re-edited syndicated copy scores bigram≈0.55 / unigram≈0.78 while
 * the closest genuinely-distinct pair scores bigram≈0.17 / unigram≈0.41.
 * Requiring BOTH thresholds keeps a wide safety margin in each direction.
 */
export const NEAR_DUP_BIGRAM_THRESHOLD = 0.4;
export const NEAR_DUP_UNIGRAM_THRESHOLD = 0.6;
/**
 * Title gate. Live data showed body similarity alone is not sufficient:
 * distinct stories from one channel share boilerplate and house style. Two
 * items are only near-duplicates if their TITLES also substantially agree —
 * a different headline means a different story, which protects independent
 * voices reporting the same issue from being collapsed.
 */
export const NEAR_DUP_TITLE_THRESHOLD = 0.3;

export interface DedupText {
  title: string | null;
  body: string;
}

/**
 * Broadcast-title stopwords. Telugu news titles are pipe-separated and end
 * in channel branding ("… | V6 News"); these tokens otherwise grant every
 * pair from one channel free similarity.
 */
const TITLE_STOPWORDS = new Set([
  "live",
  "news",
  "tv",
  "telugu",
  "latest",
  "today",
  "update",
  "updates",
  "breaking",
  "exclusive",
  "full",
  "video",
  "top",
  "hd",
]);

/**
 * The headline core: the first pipe-separated segment (where Telugu news
 * titles carry the actual story), minus broadcast stopwords.
 */
export function headlineCore(title: string): Set<string> {
  const firstSegment = title.split("|")[0];
  const tokens = normalizeForHash(firstSegment).split(" ").filter(Boolean);
  return new Set(tokens.filter((t) => !TITLE_STOPWORDS.has(t) && t.length > 1));
}

export function titleSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 1; // no title to disagree on (e.g. short posts)
  const coreA = headlineCore(a);
  const coreB = headlineCore(b);
  if (coreA.size === 0 || coreB.size === 0) return 1;
  return jaccard(coreA, coreB);
}

export function nearDuplicateSimilarity(a: DedupText, b: DedupText): number {
  if (titleSimilarity(a.title, b.title) < NEAR_DUP_TITLE_THRESHOLD) return 0;
  const bigram = jaccard(shingles(a.body, 2), shingles(b.body, 2));
  if (bigram < NEAR_DUP_BIGRAM_THRESHOLD) return 0;
  const unigram = jaccard(shingles(a.body, 1), shingles(b.body, 1));
  if (unigram < NEAR_DUP_UNIGRAM_THRESHOLD) return 0;
  return bigram;
}

export interface DedupStageResult {
  examined: number;
  exactDuplicates: number;
  nearDuplicates: number;
}

export async function runDedupStage(db: Db): Promise<DedupStageResult> {
  const all = await db.select().from(mentions).where(eq(mentions.status, "enriched"));

  /*
   * Deduplicate WITHIN each data origin, never across. A verified-snapshot
   * copy is byte-identical to the live mention it was copied from, but it is
   * not a duplicate of it — the two belong to separate, self-consistent
   * universes. Comparing across origins would mark an entire snapshot as
   * duplicate content and hollow it out.
   */
  const origins = [...new Set(all.map((m) => m.dataOrigin))];
  const totals: DedupStageResult = { examined: 0, exactDuplicates: 0, nearDuplicates: 0 };
  for (const origin of origins) {
    const result = await dedupWithinOrigin(
      db,
      all.filter((m) => m.dataOrigin === origin),
    );
    totals.examined += result.examined;
    totals.exactDuplicates += result.exactDuplicates;
    totals.nearDuplicates += result.nearDuplicates;
  }
  return totals;
}

async function dedupWithinOrigin(
  db: Db,
  enriched: (typeof mentions.$inferSelect)[],
): Promise<DedupStageResult> {

  // Hash the boilerplate-stripped text so identical promo blocks cannot
  // make distinct items collide.
  const dedupTextOf = (m: (typeof enriched)[number]) => m.contentText ?? m.originalText;
  for (const m of enriched) {
    if (!m.contentHash) {
      m.contentHash = contentHash(dedupTextOf(m));
      await db
        .update(mentions)
        .set({ contentHash: m.contentHash, updatedAt: new Date() })
        .where(eq(mentions.id, m.id));
    }
  }

  // Order by published time so the earliest item becomes canonical.
  const ordered = [...enriched].sort(
    (a, b) =>
      (a.publishedAt?.getTime() ?? a.collectedAt.getTime()) -
      (b.publishedAt?.getTime() ?? b.collectedAt.getTime()),
  );

  const canonicalByHash = new Map<string, (typeof ordered)[number]>();
  const canonicals: (typeof ordered)[number][] = [];
  let exactDuplicates = 0;
  let nearDuplicates = 0;

  for (const m of ordered) {
    // 1. Exact.
    const exactCanonical = canonicalByHash.get(m.contentHash!);
    if (exactCanonical) {
      await markDuplicate(db, m.id, exactCanonical.id, "exact", m.rawItemId);
      exactDuplicates++;
      continue;
    }

    // 2. Near — only against canonical (non-duplicate) items.
    let nearCanonical: (typeof ordered)[number] | null = null;
    let bestSimilarity = 0;
    for (const c of canonicals) {
      const similarity = nearDuplicateSimilarity(
        { title: m.title, body: dedupTextOf(m) },
        { title: c.title, body: dedupTextOf(c) },
      );
      if (similarity > bestSimilarity) {
        nearCanonical = c;
        bestSimilarity = similarity;
      }
    }
    if (nearCanonical) {
      await markDuplicate(db, m.id, nearCanonical.id, "near", m.rawItemId, bestSimilarity);
      nearDuplicates++;
      continue;
    }

    canonicalByHash.set(m.contentHash!, m);
    canonicals.push(m);
    await recordEvent(db, "DEDUPED", {
      mentionId: m.id,
      rawItemId: m.rawItemId,
      detail: { outcome: "canonical" },
    });
  }

  return { examined: enriched.length, exactDuplicates, nearDuplicates };
}

async function markDuplicate(
  db: Db,
  mentionId: string,
  canonicalId: string,
  type: "exact" | "near",
  rawItemId: string,
  similarity?: number,
) {
  await db
    .update(mentions)
    .set({
      status: "duplicate",
      duplicateOfMentionId: canonicalId,
      duplicateType: type,
      updatedAt: new Date(),
    })
    .where(eq(mentions.id, mentionId));
  await recordEvent(db, "DEDUPED", {
    mentionId,
    rawItemId,
    detail: {
      outcome: "duplicate",
      duplicateType: type,
      canonicalMentionId: canonicalId,
      ...(similarity !== undefined ? { similarity: Number(similarity.toFixed(3)) } : {}),
    },
  });
}
