/**
 * Move collected intelligence between databases.
 *
 *   npm run db:export                 # local PGlite  → data/export.json
 *   npm run db:import                 # data/export.json → DATABASE_URL
 *
 * Used to carry the corpus from the development PGlite file into the
 * provisioned Postgres so the deployed site opens with real evidence rather
 * than an empty screen.
 *
 * Rows are written in dependency order and every insert is
 * `onConflictDoNothing`, so a partial run can simply be repeated. Ids are
 * preserved exactly — foreign keys, provenance and data_origin all survive
 * the move, which is the whole point: an imported corpus must remain
 * traceable to its original sources.
 */
import "./env";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDb } from "@/db/client";
import {
  authors,
  collectionQueries,
  collectionRuns,
  evidenceLinks,
  intelligenceFindings,
  locations,
  mentions,
  narrativeMentions,
  narratives,
  narrativeSnapshots,
  processingEvents,
  rawItems,
  sources,
  verifiedSnapshots,
} from "@/db/schema";

/** Dependency order — parents before children. */
const TABLES = [
  ["sources", sources],
  ["locations", locations],
  ["collection_queries", collectionQueries],
  ["collection_runs", collectionRuns],
  ["raw_items", rawItems],
  ["authors", authors],
  ["mentions", mentions],
  ["narratives", narratives],
  ["narrative_mentions", narrativeMentions],
  ["narrative_snapshots", narrativeSnapshots],
  ["intelligence_findings", intelligenceFindings],
  ["evidence_links", evidenceLinks],
  ["processing_events", processingEvents],
  ["verified_snapshots", verifiedSnapshots],
] as const;

const FILE = path.join(process.cwd(), "data", "export.json");

async function exportAll() {
  // Force the embedded database regardless of DATABASE_URL — the export
  // source is always the local development corpus.
  const { db, close } = await createDb({ url: undefined, memory: false });
  const out: Record<string, unknown[]> = {};
  for (const [name, table] of TABLES) {
    const rows = await db.select().from(table);
    out[name] = rows;
    console.log(`  ${name.padEnd(22)} ${rows.length}`);
  }
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(out));
  console.log(`\nWrote ${FILE}`);
  await close();
}

/** Revive ISO date strings that JSON flattened on the way out. */
function reviveDates(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] =
      typeof v === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v) ? new Date(v) : v;
  }
  return out;
}

async function importAll() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — nothing to import into");

  const payload = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, Record<string, unknown>[]>;
  const { db, close } = await createDb({ url });

  for (const [name, table] of TABLES) {
    const rows = payload[name] ?? [];
    if (rows.length === 0) {
      console.log(`  ${name.padEnd(22)} 0`);
      continue;
    }
    let written = 0;
    // Chunked: a single insert of thousands of rows exceeds parameter limits.
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200).map(reviveDates);
      try {
        await db.insert(table).values(chunk as never).onConflictDoNothing();
        written += chunk.length;
      } catch (error) {
        console.log(
          `  ${name}: chunk ${i} failed — ${error instanceof Error ? error.message.slice(0, 90) : error}`,
        );
      }
    }
    console.log(`  ${name.padEnd(22)} ${written}`);
  }
  console.log("\nImport complete.");
  await close();
}

const mode = process.argv[2];
const run = mode === "export" ? exportAll : mode === "import" ? importAll : null;
if (!run) {
  console.error("usage: export-import.ts <export|import>");
  process.exit(1);
}
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
