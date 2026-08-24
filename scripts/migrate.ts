/** Apply migrations to the configured database (DATABASE_URL or local PGlite). */
import { createDb } from "@/db/client";

async function main() {
  const handle = await createDb({ migrateOnCreate: true });
  console.log(`[migrate] applied migrations (driver=${handle.driver})`);
  await handle.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
