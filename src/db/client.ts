/**
 * Database client factory.
 *
 * - DATABASE_URL set   → node-postgres (Neon or any Postgres).
 * - DATABASE_URL unset → embedded PGlite persisted under .data/pglite, so
 *   development and tests run with zero credentials. Same schema, same
 *   migrations, same Drizzle API.
 *
 * Everything downstream depends only on the `Db` type, never on the driver.
 */
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "src/db/migrations");

export interface DbHandle {
  db: Db;
  driver: "pg" | "pglite";
  close: () => Promise<void>;
}

/** Create a database handle. `memory: true` gives an in-memory PGlite (tests). */
export async function createDb(opts?: {
  url?: string;
  memory?: boolean;
  migrateOnCreate?: boolean;
}): Promise<DbHandle> {
  const url = opts?.url ?? process.env.DATABASE_URL;
  const migrateOnCreate = opts?.migrateOnCreate ?? true;

  if (url && !opts?.memory) {
    /*
     * keepAlive matters for this workload specifically: the enrichment stage
     * sits idle ~55s between queries while an LLM call runs, which is long
     * enough for an intermediary to drop a pooled connection silently.
     */
    const pool = new Pool({ connectionString: url, keepAlive: true });
    /*
     * A pool with no 'error' listener turns a dropped idle backend into an
     * uncaught exception that takes the whole process down. Idle-client
     * failures are recoverable — the pool discards the client and opens a
     * fresh one on the next query — so log and carry on.
     */
    pool.on("error", (error) => {
      console.error(`[db] idle client error (recovered): ${error.message}`);
    });
    const db = drizzlePg(pool, { schema });
    if (migrateOnCreate) {
      await migratePg(db, { migrationsFolder: MIGRATIONS_FOLDER });
    }
    return { db, driver: "pg", close: () => pool.end() };
  }

  let pglite: PGlite;
  if (opts?.memory) {
    pglite = new PGlite();
  } else {
    const dataDir = path.join(process.cwd(), ".data/pglite");
    mkdirSync(dataDir, { recursive: true });
    pglite = new PGlite(dataDir);
  }
  const db = drizzlePglite(pglite, { schema });
  if (migrateOnCreate) {
    await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER });
  }
  return { db, driver: "pglite", close: () => pglite.close() };
}

/**
 * App-wide singleton (Next.js server components, pipeline scripts).
 * Stored on globalThis to survive Next.js dev-mode module reloads —
 * PGlite allows only one connection to a data directory.
 */
const globalForDb = globalThis as unknown as { __taiccDb?: Promise<DbHandle> };

export function getDb(): Promise<DbHandle> {
  if (!globalForDb.__taiccDb) {
    globalForDb.__taiccDb = createDb();
  }
  return globalForDb.__taiccDb;
}
