/** Processing event trail — provenance for every pipeline transition. */
import { randomUUID } from "node:crypto";
import type { Db } from "@/db/client";
import { processingEvents } from "@/db/schema";
import type { ProcessingEventType } from "@/types/core";

export async function recordEvent(
  db: Db,
  eventType: ProcessingEventType,
  refs: {
    collectionRunId?: string;
    rawItemId?: string;
    mentionId?: string;
    narrativeId?: string;
    findingId?: string;
    detail?: unknown;
  },
): Promise<void> {
  await db.insert(processingEvents).values({
    id: randomUUID(),
    eventType,
    collectionRunId: refs.collectionRunId ?? null,
    rawItemId: refs.rawItemId ?? null,
    mentionId: refs.mentionId ?? null,
    narrativeId: refs.narrativeId ?? null,
    findingId: refs.findingId ?? null,
    detail: refs.detail ?? null,
  });
}
