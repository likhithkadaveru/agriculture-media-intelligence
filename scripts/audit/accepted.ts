import { createDb } from "@/db/client";
import { mentions, authors } from "@/db/schema";
import { eq } from "drizzle-orm";
async function main() {
  const { db, close } = await createDb();
  const acc = await db.select().from(mentions).where(eq(mentions.relevanceStatus, "accepted"));
  console.log(`ACCEPTED: ${acc.length}\n`);
  for (const m of acc) {
    const [a] = m.authorId ? await db.select().from(authors).where(eq(authors.id, m.authorId)) : [null];
    console.log(`• [${a?.name ?? "?"}] ${m.title?.slice(0, 95)}`);
  }
  const [ap] = await db.select().from(mentions).where(eq(mentions.externalId, "4aXWSY4oK2U"));
  console.log(`\nAP-FARMERS TEST ITEM → ${ap?.relevanceStatus} :: ${ap?.relevanceReason}`);
  await close();
}
main();
