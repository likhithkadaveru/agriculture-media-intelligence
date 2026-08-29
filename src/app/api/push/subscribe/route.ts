/**
 * Push subscription registration.
 *
 * The browser generates the subscription; this only stores it. Endpoints are
 * unique, so a device re-subscribing updates its keys rather than
 * accumulating duplicate rows and duplicate notifications.
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";

export const dynamic = "force-dynamic";

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(256), auth: z.string().max(256) }),
  label: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = SubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  const { db } = await getDb();
  await db
    .insert(pushSubscriptions)
    .values({
      id: randomUUID(),
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      label: parsed.data.label ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
    });

  return NextResponse.json({ ok: true });
}

/** The public VAPID key, which the browser needs before it can subscribe. */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ enabled: false });
  return NextResponse.json({ enabled: true, publicKey: key });
}
