import { createDb } from "@/db/client";
import { mentions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
async function main() {
  const { db, close } = await createDb();
  const live = await db.select().from(mentions).where(eq(mentions.dataOrigin, "live"));
  const modelRej = live.filter(m => m.relevanceReason?.includes("Model relevance"));
  const survived = live.filter(m => m.relevanceStatus === "accepted");
  console.log(`SURVIVED MODEL CONFIRMATION (${survived.length}):`);
  for (const m of survived) console.log(`  ✓ TS=${m.telanganaRelevance} AG=${m.agricultureRelevance} | ${m.title?.slice(0,88)}`);
  console.log(`\nREJECTED BY MODEL (${modelRej.length}):`);
  for (const m of modelRej) console.log(`  ✗ TS=${m.telanganaRelevance} AG=${m.agricultureRelevance} | ${m.title?.slice(0,88)}`);
  await close();
}
main();
