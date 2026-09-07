/**
 * Send one real alert to every subscribed device, right now.
 *
 *   npm run alert:test
 *
 * Why this exists: when an officer says "notifications aren't working", that
 * covers three different failures — nothing was sent, the subscription is
 * dead, or the phone received it and chose not to interrupt. Waiting for the
 * next unfavourable story to find out which takes hours and proves nothing.
 *
 * This goes through sendToAll, the same path the pipeline uses, so a pass
 * here means the server side is genuinely fine and the remaining question is
 * the phone's own notification settings. It is deliberately NOT recorded in
 * sent_alerts: a test must never consume a real narrative's one alert.
 */
import "./env";
import { desc } from "drizzle-orm";
import { createDb } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { pushConfigured, sendToAll } from "@/lib/push";

function ago(date: Date | null): string {
  if (!date) return "never";
  const hours = (Date.now() - date.getTime()) / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** The push service host, which is the only part of an endpoint worth showing. */
function service(endpoint: string): string {
  try {
    const host = new URL(endpoint).host;
    if (host.includes("push.apple")) return "Apple (iPhone/iPad/Mac)";
    if (host.includes("fcm.googleapis") || host.includes("android")) return "Google (Android/Chrome)";
    if (host.includes("notify.windows") || host.includes("wns")) return "Microsoft (Edge)";
    if (host.includes("mozilla")) return "Mozilla (Firefox)";
    return host;
  } catch {
    return "unknown";
  }
}

async function main() {
  const handle = await createDb({ migrateOnCreate: false });

  if (!pushConfigured()) {
    console.error(
      "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set, so push is inert.\n" +
        "Nothing was sent. Set them in .env.local and try again.",
    );
    await handle.close();
    process.exit(1);
  }

  const subs = await handle.db
    .select()
    .from(pushSubscriptions)
    .orderBy(desc(pushSubscriptions.createdAt));

  if (subs.length === 0) {
    console.error(
      "No devices are subscribed. Open the site, tap 'Enable alerts', and run this again.\n" +
        "On iPhone the site must be on the Home Screen first — Safari refuses permission in a tab.",
    );
    await handle.close();
    process.exit(1);
  }

  console.log(`${subs.length} subscribed device(s):`);
  for (const sub of subs) {
    console.log(
      `  · ${service(sub.endpoint)}${sub.label ? ` — ${sub.label}` : ""}` +
        `  (registered ${ago(sub.createdAt)}, last notified ${ago(sub.lastNotifiedAt)})`,
    );
  }

  const base = process.env.PUBLIC_SITE_URL ?? "https://agriculture.likhithlabs.com";
  const stamp = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  const result = await sendToAll(handle.db, {
    title: "Test alert",
    body: `Sent ${stamp}. If this arrived silently, the phone is holding notifications back — not the server.`,
    url: base,
    // A fresh tag each run, so a second test is a second notification rather
    // than a silent replacement of the first.
    tag: `test-${Date.now()}`,
  }, { log: (m) => console.log(`  ${m}`) });

  console.log(
    `\nsent ${result.sent}, failed ${result.failed}, removed ${result.removed} dead subscription(s)`,
  );
  if (result.sent > 0) {
    console.log(
      "The push service accepted it. If nothing appeared on the phone within a few\n" +
        "seconds, the delivery is being suppressed on the device — check Settings →\n" +
        "Notifications → Agri Intel for 'Immediate Delivery', banners, and Focus.",
    );
  }
  await handle.close();
  process.exit(result.sent > 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
