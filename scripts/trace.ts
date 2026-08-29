/**
 * Provenance trace — prints the full chain for one record:
 *
 *   source → raw item → mention → enrichment → narrative → finding → evidence
 *
 * Usage:
 *   npm run trace                       (traces seed-x-001)
 *   npm run trace -- <external-id>      (e.g. seed-news-001)
 */
import "./env";
import { and, eq, inArray } from "drizzle-orm";
import { createDb } from "@/db/client";
import {
  authors,
  collectionRuns,
  evidenceLinks,
  intelligenceFindings,
  mentions,
  narrativeMentions,
  narratives,
  processingEvents,
  rawItems,
  sources,
} from "@/db/schema";

const externalId = process.argv[2] ?? "seed-x-001";

function section(title: string) {
  console.log(`\n━━━ ${title} ${"━".repeat(Math.max(0, 60 - title.length))}`);
}

async function main() {
  const { db, close } = await createDb();

  const [mention] = await db
    .select()
    .from(mentions)
    .where(eq(mentions.externalId, externalId));
  if (!mention) {
    console.error(`No mention with external id "${externalId}"`);
    process.exit(1);
  }

  const [raw] = await db.select().from(rawItems).where(eq(rawItems.id, mention.rawItemId));
  const [run] = await db
    .select()
    .from(collectionRuns)
    .where(eq(collectionRuns.id, raw.collectionRunId));
  const [source] = raw.sourceId
    ? await db.select().from(sources).where(eq(sources.id, raw.sourceId))
    : [null];
  const author = mention.authorId
    ? (await db.select().from(authors).where(eq(authors.id, mention.authorId)))[0]
    : null;

  section("SOURCE");
  console.log(`connector: ${run.connector} | platform: ${raw.platform}`);
  if (source) console.log(`source: ${source.name} (${source.key})`);
  console.log(`collection run: ${run.id} | started ${run.startedAt.toISOString()}`);
  console.log(`data origin: ${raw.dataOrigin}`);

  section("RAW ITEM");
  console.log(`id: ${raw.id} | external: ${raw.externalId}`);
  console.log(`collected: ${raw.collectedAt.toISOString()}`);
  console.log(`payload (immutable):`);
  console.log(
    JSON.stringify(raw.payload, null, 2)
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n"),
  );

  section("MENTION (canonical)");
  console.log(`id: ${mention.id} | status: ${mention.status}`);
  console.log(`author: ${author?.name ?? "—"} [${author?.authorType ?? "unknown"}]`);
  console.log(`published: ${mention.publishedAt?.toISOString() ?? "—"}`);
  console.log(`language: ${mention.language ?? "—"}`);
  console.log(`text: ${mention.originalText.slice(0, 160)}`);
  if (mention.englishTranslation) {
    console.log(
      `translation (${mention.translationProvenance}): ${mention.englishTranslation.slice(0, 160)}`,
    );
  }

  section("ENRICHMENT");
  console.log(
    `relevance: ${mention.relevanceStatus} (TS ${mention.telanganaRelevance}, AG ${mention.agricultureRelevance})`,
  );
  console.log(`reason: ${mention.relevanceReason}`);
  console.log(`topics: ${mention.topics.join(", ") || "—"}`);
  console.log(
    `district: ${mention.district ?? "—"}${mention.mandal ? ` / ${mention.mandal}` : ""} (conf ${mention.locationConfidence ?? "—"})`,
  );
  console.log(`sentiment: ${mention.sentiment} | stance: ${mention.stance}`);
  console.log(`claim: ${mention.claim ?? "—"} (conf ${mention.claimConfidence ?? "—"})`);
  if (mention.enrichmentMeta) {
    const m = mention.enrichmentMeta;
    console.log(
      `enriched by ${m.provider}/${m.model} prompt=${m.promptVersion} in ${m.durationMs}ms`,
    );
  }
  if (mention.duplicateOfMentionId) {
    console.log(
      `duplicate (${mention.duplicateType}) of mention ${mention.duplicateOfMentionId}`,
    );
  }

  const nmRows = await db
    .select()
    .from(narrativeMentions)
    .where(eq(narrativeMentions.mentionId, mention.id));
  for (const nm of nmRows) {
    const [narrative] = await db
      .select()
      .from(narratives)
      .where(eq(narratives.id, nm.narrativeId));
    section("NARRATIVE");
    console.log(`"${narrative.title}" (${narrative.key})`);
    console.log(`role: ${nm.role} | assigned by: ${nm.assignedBy}`);
    console.log(
      `mentions: ${narrative.mentionCount} | authors: ${narrative.uniqueAuthorCount} | districts: ${Object.keys(narrative.districts).join(", ")}`,
    );

    const findingRows = await db
      .select()
      .from(intelligenceFindings)
      .where(
        and(
          eq(intelligenceFindings.narrativeId, narrative.id),
          eq(intelligenceFindings.status, "active"),
        ),
      );
    for (const finding of findingRows) {
      section("FINDING");
      console.log(`[${finding.category}] ${finding.headline}`);
      console.log(`rank ${finding.rank} | confidence ${finding.confidence}`);
      console.log(`reason: ${finding.reason}`);

      const links = await db
        .select()
        .from(evidenceLinks)
        .where(eq(evidenceLinks.findingId, finding.id));
      const linked = await db
        .select({ externalId: mentions.externalId })
        .from(mentions)
        .where(inArray(mentions.id, links.map((l) => l.mentionId)));
      section("EVIDENCE");
      console.log(
        `${links.length} linked items: ${linked.map((l) => l.externalId).join(", ")}`,
      );
      console.log(
        `this record is ${links.some((l) => l.mentionId === mention.id) ? "AMONG" : "NOT among"} the evidence`,
      );
    }
  }

  section("PROCESSING EVENTS");
  const events = await db
    .select()
    .from(processingEvents)
    .where(eq(processingEvents.mentionId, mention.id));
  for (const event of events) {
    console.log(`${event.createdAt.toISOString()}  ${event.eventType}`);
  }

  await close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
