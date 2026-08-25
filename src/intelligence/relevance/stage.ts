/** Relevance stage runner — gates pending mentions before enrichment. */
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { authors, mentions } from "@/db/schema";
import { recordEvent } from "@/lib/events";
import { assessRelevance } from "./index";

export interface RelevanceStageResult {
  assessed: number;
  accepted: number;
  rejected: number;
}

export async function runRelevanceStage(db: Db): Promise<RelevanceStageResult> {
  const pending = await db
    .select()
    .from(mentions)
    .where(and(eq(mentions.status, "normalized"), eq(mentions.relevanceStatus, "pending")));

  let accepted = 0;
  let rejected = 0;

  const authorRows = await db.select().from(authors);
  const authorById = new Map(authorRows.map((a) => [a.id, a]));

  for (const mention of pending) {
    // Read the boilerplate-stripped text: channel promo/SEO tails otherwise
    // create false Telangana/agriculture matches.
    const text = mention.contentText ?? [mention.title, mention.originalText].filter(Boolean).join("\n");
    const author = mention.authorId ? authorById.get(mention.authorId) : undefined;
    // Channel registry kind is carried on the author bio as "channel-kind:x".
    const sourceKind = author?.bio?.startsWith("channel-kind:")
      ? author.bio.slice("channel-kind:".length)
      : null;
    const verdict = assessRelevance(text, {
      title: mention.title,
      authorContext: author ? [author.name, author.bio].filter(Boolean).join(" ") : null,
      sourceKind,
    });

    await db
      .update(mentions)
      .set({
        telanganaRelevance: verdict.telanganaRelevance,
        agricultureRelevance: verdict.agricultureRelevance,
        relevanceStatus: verdict.accepted ? "accepted" : "rejected",
        relevanceReason: verdict.reason,
        status: verdict.accepted ? "normalized" : "rejected",
        updatedAt: new Date(),
      })
      .where(eq(mentions.id, mention.id));

    await recordEvent(db, verdict.accepted ? "RELEVANCE_ACCEPTED" : "RELEVANCE_REJECTED", {
      mentionId: mention.id,
      rawItemId: mention.rawItemId,
      detail: {
        reason: verdict.reason,
        telanganaRelevance: verdict.telanganaRelevance,
        agricultureRelevance: verdict.agricultureRelevance,
      },
    });

    if (verdict.accepted) accepted++;
    else rejected++;
  }

  return { assessed: pending.length, accepted, rejected };
}
