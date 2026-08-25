import { createDb } from "@/db/client";
import { mentions } from "@/db/schema";
import { eq } from "drizzle-orm";
async function main() {
  const { db, close } = await createDb();
  const all = await db.select().from(mentions).where(eq(mentions.dataOrigin, "live"));
  const hits = all.filter(x => x.district === "Khammam" || x.title?.includes("ఆందోళన"));
  for (const m of hits) console.log(`${m.externalId} | district=${m.district} | ${m.title?.slice(0,80)}`);
  await close();
}
main();
