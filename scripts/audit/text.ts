import { createDb } from "@/db/client";
import { mentions } from "@/db/schema";
import { eq } from "drizzle-orm";
async function main() {
  const { db, close } = await createDb();
  const [m] = await db.select().from(mentions).where(eq(mentions.externalId, "4aXWSY4oK2U"));
  console.log("TITLE:", m.title);
  console.log("--- FULL TEXT (", m.originalText.length, "chars) ---");
  console.log(m.originalText.slice(0, 1400));
  await close();
}
main();
