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

/*
 * Closing twice must be harmless. On a signal the scheduler closes the handle
 * from its shutdown hook while the main path is still unwinding, and it then
 * closes again on the way out — pg throws "Called end on pool more than once"
 * for the second call, so an orderly Ctrl-C or a watchdog SIGTERM exited 1
 * with a stack trace and read, in the log, exactly like a crash.
 */
function once(close: () => Promise<unknown>): () => Promise<void> {
  let closing: Promise<unknown> | null = null;
  // The promise is reused, not just a flag: a second caller should wait for
  // the first close to finish rather than race ahead of it.
  return () => (closing ??= close()).then(() => undefined);
}

/**
 * Fail loudly on a connection string that is not one.
 *
 * A .env file may quote its values and the loader strips those, but anything
 * injecting the variable directly — GitHub Actions secrets, a systemd
 * EnvironmentFile, a Docker -e flag — passes them through verbatim. pg then
 * parses the leading quote as part of the host and reports
 * `getaddrinfo EAI_AGAIN base`, naming a host nobody configured and saying
 * nothing about the real fault. That cost a debugging session; the check
 * costs a microsecond.
 */
function assertUsableUrl(url: string): void {
  const quoted = /^['"]|['"]$/.test(url);
  let parses = false;
  try {
    parses = ["postgres:", "postgresql:"].includes(new URL(url).protocol);
  } catch {
    parses = false;
  }
  if (quoted || !parses) {
    throw new Error(
      "DATABASE_URL is not a usable Postgres URL" +
        (quoted ? " — it is wrapped in quotes, which belong in a .env file but not in the value itself." : ".") +
        " Expected postgres://user:password@host/database. " +
        `Got ${url.length} characters starting ${JSON.stringify(url.slice(0, 12))}.`,
    );
  }
}

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
    assertUsableUrl(url);
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
    return { db, driver: "pg", close: once(() => pool.end()) };
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
  return { db, driver: "pglite", close: once(() => pglite.close()) };
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
