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

/** Error text worth logging: push services and Drizzle both nest the cause. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : "";
  return `${error.message}${cause}`;
}

export interface DeliveryResult {
  sent: number;
  removed: number;
  failed: number;
}

/*
 * Delivery headers (RFC 8030). Both matter on iOS, where Apple's push
 * service translates them into APNs behaviour:
 *
 * - Urgency decides whether the phone is woken to show the notification now
 *   or whether the push may be held back until the device next reports in.
 *   web-push defaults to "normal"; an unfavourable story breaking is the one
 *   case this system exists for, so it asks for "high" explicitly.
 * - TTL is how long the push service keeps retrying a phone that is off or
 *   out of signal. The library default is four weeks, which for a breaking
 *   story means an officer could be interrupted by news that is three weeks
 *   stale. Six hours: still delivered after a night with the phone off,
 *   dropped once it is no longer worth an interruption.
 */
const URGENCY = "high";
const TTL_SECONDS = 6 * 60 * 60;

/** Send one payload to every registered subscription. */
export async function sendToAll(
  db: Db,
  payload: AlertPayload,
  options: { log?: (m: string) => void } = {},
): Promise<DeliveryResult> {
  const log = options.log ?? (() => {});
  const out: DeliveryResult = { sent: 0, removed: 0, failed: 0 };
  if (!pushConfigured()) return out;
  configure();

  const subs = await db.select().from(pushSubscriptions);
  const expired: string[] = [];

  for (const sub of subs) {
    /*
     * Delivery and bookkeeping are separate steps on purpose. They used to
     * share one try/catch, so a failing lastNotifiedAt write counted the
     * same device as BOTH sent and failed — "sent 2, failed 2" out of two
     * subscriptions, which reads as a delivery problem when the phones in
     * fact received it. Whether the push arrived is the only thing the
     * counters may speak to.
     */
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { urgency: URGENCY, TTL: TTL_SECONDS },
      );
      out.sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        expired.push(sub.id);
        out.removed++;
      } else {
        out.failed++;
        // Swallowing this silently is how a mute alerting system looks
        // healthy: every push failing still reports a clean cycle.
        log(`push failed (${status ?? "no status"}): ${describe(error)}`);
      }
      continue;
    }

    /*
     * lastNotifiedAt is an audit trail, not delivery state. Losing one write
     * must not cost the alert, so this failure is reported and stepped over.
     */
    try {
      await db
        .update(pushSubscriptions)
        .set({ lastNotifiedAt: new Date() })
        .where(eq(pushSubscriptions.id, sub.id));
    } catch (error) {
      log(`delivered, but recording lastNotifiedAt failed: ${describe(error)}`);
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
