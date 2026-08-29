/**
 * Video transcript retrieval.
 *
 * Broadcast agriculture coverage names its district out loud far more often
 * than in the title: measured on live data, 1 of 20 enriched YouTube items
 * carried a district from title and description alone, against 19 of 87 for
 * X. The location is spoken, not written.
 *
 * Cost discipline mirrors the Apify connectors. The actor bills $0.01 per
 * video, so transcripts are fetched only for items that already passed the
 * relevance gate, once each, and never re-attempted for a video that has no
 * caption track. A status of "unavailable" is a real answer and is recorded
 * as one rather than retried every cycle.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { mentions } from "@/db/schema";

const ACTOR = "pintostudio~youtube-transcript-scraper";
const APIFY_API = "https://api.apify.com/v2";

/** Words below which a caption track is treated as no transcript at all. */
const MIN_WORDS = 20;

interface Segment {
  text?: string;
}

/**
 * Fetch one video's captions. Returns null when the video has no usable
 * track — short news clips frequently return only "[సంగీతం]" music markers.
 */
export async function fetchTranscript(
  videoUrl: string,
  language = "te",
  token = process.env.APIFY_API_TOKEN,
): Promise<string | null> {
  if (!token) throw new Error("APIFY_API_TOKEN is not configured");
  const response = await fetch(
    `${APIFY_API}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoUrl, targetLanguage: language }),
      signal: AbortSignal.timeout(180000),
    },
  );
  if (!response.ok) {
    throw new Error(`transcript actor failed: HTTP ${response.status}`);
  }
  const items = (await response.json()) as Array<{ data?: Segment[] }>;
  const text = (items[0]?.data ?? [])
    .map((s) => s.text ?? "")
    // Caption tracks mark non-speech in brackets: "[సంగీతం]" is music, not words.
    .filter((t) => !/^\[.*\]$/.test(t.trim()))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(" ").filter(Boolean).length >= MIN_WORDS ? text : null;
}

export interface TranscriptStageResult {
  attempted: number;
  retrieved: number;
  unavailable: number;
  failed: number;
}

/**
 * Fetch transcripts for accepted video mentions that have not been tried.
 * `limit` is a spend cap, not a batch size: at $0.01 a video an unbounded
 * pass over a backfill would be a bill nobody agreed to.
 */
export async function runTranscriptStage(
  db: Db,
  options: { limit?: number; log?: (m: string) => void } = {},
): Promise<TranscriptStageResult> {
  const limit = options.limit ?? Number(process.env.TRANSCRIPT_MAX_PER_CYCLE ?? 10);
  const log = options.log ?? (() => {});
  const result: TranscriptStageResult = {
    attempted: 0,
    retrieved: 0,
    unavailable: 0,
    failed: 0,
  };
  if (!process.env.APIFY_API_TOKEN) {
    log("transcripts: skipped — APIFY_API_TOKEN not set");
    return result;
  }

  const candidates = await db
    .select()
    .from(mentions)
    .where(
      and(
        eq(mentions.platform, "youtube"),
        eq(mentions.relevanceStatus, "accepted"),
        eq(mentions.status, "normalized"),
        isNull(mentions.transcript),
        // "unavailable" is the untried default written at normalization;
        // "none" is this stage's verdict that the video genuinely has none.
        eq(mentions.transcriptStatus, "unavailable"),
        sql`${mentions.url} is not null`,
      ),
    )
    .limit(limit);

  for (const mention of candidates) {
    if (!mention.url) continue;
    result.attempted++;
    try {
      const text = await fetchTranscript(mention.url);
      await db
        .update(mentions)
        .set({
          transcript: text,
          transcriptStatus: text ? "available" : "none",
          updatedAt: new Date(),
        })
        .where(eq(mentions.id, mention.id));
      if (text) {
        result.retrieved++;
        log(`transcript: ${text.split(" ").length} words for ${mention.url}`);
      } else {
        result.unavailable++;
      }
    } catch (error) {
      // One unavailable video must not cost the rest of the batch.
      result.failed++;
      log(`transcript FAILED ${mention.url}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return result;
}
