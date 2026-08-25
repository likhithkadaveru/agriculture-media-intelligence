import { createDb } from "@/db/client";
import { intelligenceFindings, narratives } from "@/db/schema";
import { eq } from "drizzle-orm";
async function main() {
  const { db, close } = await createDb();
  const ns = await db.select().from(narratives);
  for (const n of ns) {
    console.log(`\n▸ ${n.key}  [${n.dataOrigin}] trend=${n.trendStatus}`);
    console.log(`  TITLE: ${n.title}`);
    if (n.explanation) console.log(`  AI: ${n.explanation}`);
    console.log(`  ${n.mentionCount} items · ${n.uniqueAuthorCount} authors · districts=${JSON.stringify(n.districts)}`);
    console.log(`  voices=${JSON.stringify(n.voiceMix)} stance=${JSON.stringify(n.stanceSummary)}`);
  }
  const fs = await db.select().from(intelligenceFindings).where(eq(intelligenceFindings.status, "active"));
  console.log(`\n═══ FINDINGS (${fs.length}) ═══`);
  for (const f of fs.sort((a,b)=>a.rank-b.rank)) {
    console.log(`\n#${f.rank} [${f.category}] ${f.headline}`);
    console.log(`  ${f.summary}`);
  }
  await close();
}
main();
