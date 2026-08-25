import { createDb } from "@/db/client";
import { processingEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
async function main() {
  const { db, close } = await createDb();
  const evs = await db.select().from(processingEvents).where(eq(processingEvents.eventType, "ENRICHMENT_FAILED"));
  console.log("failures:", evs.length);
  console.log(JSON.stringify(evs[0]?.detail, null, 2));
  await close();
}
main();
