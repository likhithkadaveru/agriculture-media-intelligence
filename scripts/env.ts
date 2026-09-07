/**
 * Environment loading for CLI scripts.
 *
 * `next dev` loads .env.local on its own; plain `tsx` does not. Without this
 * every script here silently fell through to the embedded PGlite database
 * while the app read Neon — two divergent corpora, no error, no warning.
 *
 * Import it first in any script that touches the database or a connector:
 *
 *   import "./env";
 *
 * Precedence matches Next.js: an already-exported shell variable wins, then
 * .env.local, then .env. Nothing is overwritten, so
 * `DATABASE_URL=... npm run quality` still targets whatever you name.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Files in precedence order — earlier wins, as in Next.js. */
const ENV_FILES = [".env.local", ".env"];

function stripQuotes(value: string): string {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.at(-1) === quote && value.length >= 2) {
    const inner = value.slice(1, -1);
    // Only double quotes carry escapes, matching dotenv.
    return quote === '"' ? inner.replace(/\\n/g, "\n").replace(/\\"/g, '"') : inner;
  }
  // Unquoted values end at the first comment marker.
  return value.split(" #")[0].trim();
}

export function parseEnv(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of contents.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    if (!key) continue;
    out[key] = stripQuotes(line.slice(eq + 1).trim());
  }
  return out;
}

/** Populate process.env from the env files. Returns the files actually read. */
export function loadEnv(cwd: string = process.cwd()): string[] {
  const loaded: string[] = [];
  for (const file of ENV_FILES) {
    const filePath = path.join(cwd, file);
    if (!existsSync(filePath)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(filePath, "utf8")))) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
    loaded.push(file);
  }
  return loaded;
}

loadEnv();
