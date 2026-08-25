/**
 * Create a verified snapshot of the current live intelligence state.
 *
 *   npm run snapshot:create -- --label "2026-08 Telangana Agriculture Demo"
 */
import { createDb } from "@/db/client";
import { createVerifiedSnapshot } from "@/intelligence/snapshot";

async function main() {
  const labelIndex = process.argv.indexOf("--label");
  const label =
    labelIndex >= 0 && process.argv[labelIndex + 1]
      ? process.argv[labelIndex + 1]
      : `Snapshot ${new Date().toISOString().slice(0, 16)}`;

  const handle = await createDb();
  const { snapshotId, manifest } = await createVerifiedSnapshot(handle.db, label, (m) =>
    console.log(`[snapshot] ${m}`),
  );
  console.log(`[snapshot] id=${snapshotId}`);
  console.log(JSON.stringify(manifest, null, 2));
  await handle.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
