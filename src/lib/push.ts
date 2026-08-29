/**
 * Web push delivery for official alerts.
 *
 * Why web push rather than email or SMS: an officer adds the site to their
 * home screen once and receives alerts with no account, no app store and no
 * phone number on file. On iOS this is the ONLY way a website may notify —
 * Safari refuses permission from a normal tab, so the site must be added to
 * the Home Screen (iOS 16.4+). Android and desktop Chrome allow it from an
 * ordinary tab.
 *
 * Subscriptions are disposable: a 404 or 410 is the push service telling us
 * the endpoint is gone, and the row is deleted rather than retried forever.
 */
import { randomUUID } from "node:crypto";
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { pushSubscriptions, sentAlerts } from "@/db/schema";

export interface AlertPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** True when VAPID credentials are present; push is inert without them. */
export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure(): void {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:alerts@example.invalid",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export interface DeliveryResult {
  sent: number;
  removed: number;
  failed: number;
}

/** Send one payload to every registered subscription. */
export async function sendToAll(db: Db, payload: AlertPayload): Promise<DeliveryResult> {
  const out: DeliveryResult = { sent: 0, removed: 0, failed: 0 };
  if (!pushConfigured()) return out;
  configure();

  const subs = await db.select().from(pushSubscriptions);
  const expired: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      out.sent++;
      await db
        .update(pushSubscriptions)
        .set({ lastNotifiedAt: new Date() })
        .where(eq(pushSubscriptions.id, sub.id));
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        expired.push(sub.id);
        out.removed++;
      } else {
        out.failed++;
      }
    }
  }

  if (expired.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, expired));
  }
  return out;
}

/** Record that a narrative has been alerted on, so it never fires twice. */
export async function markAlerted(
  db: Db,
  findingId: string,
  narrativeId: string,
  recipients: number,
): Promise<void> {
  await db
    .insert(sentAlerts)
    .values({ id: randomUUID(), findingId, narrativeId, recipients })
    .onConflictDoNothing();
}
