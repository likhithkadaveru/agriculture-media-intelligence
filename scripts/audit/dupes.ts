import { createDb } from "@/db/client";
import { mentions, processingEvents } from "@/db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  const { db, close } = await createDb();
  const dups = await db.select().from(mentions).where(eq(mentions.status, "duplicate"));
  for (const d of dups) {
    const [canon] = await db.select().from(mentions).where(eq(mentions.id, d.duplicateOfMentionId!));
    const [ev] = await db.select().from(processingEvents).where(and(eq(processingEvents.mentionId, d.id), eq(processingEvents.eventType, "DEDUPED")));
    const detail = ev?.detail as Record<string, unknown> | null;
    console.log(`\n[${d.duplicateType}] sim=${detail?.similarity ?? "-"}`);
    console.log(`  DUP:   ${d.title?.slice(0, 110)}`);
    console.log(`         ${d.url}`);
    console.log(`  CANON: ${canon?.title?.slice(0, 110)}`);
    console.log(`         ${canon?.url}`);
  }
  await close();
}
main();
