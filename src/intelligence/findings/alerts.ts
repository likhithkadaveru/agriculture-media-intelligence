/**
 * Alert dispatch — decides which findings are worth interrupting an officer
 * for, and sends them once.
 *
 * The rule is the one the command screen already uses to sort a finding into
 * "Concerns" rather than "Going well", so the notification and the site can
 * never disagree about what counts as unfavourable. Duplicating that
 * judgement in two places would guarantee they drift.
 *
 * Deduplication is per NARRATIVE, not per finding: findings are regenerated
 * every cycle, so keying on the finding id would re-alert on the same story
 * indefinitely. An alert that repeats is an alert that gets muted.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  intelligenceFindings,
  narrativeMentions,
  narratives,
  mentions,
  pushSubscriptions,
  sentAlerts,
} from "@/db/schema";
import { markAlerted, pushConfigured, sendToAll } from "@/lib/push";

/**
 * Most alerts one cycle may send. The first device to subscribe would
 * otherwise receive every unfavourable narrative at once, and a phone that
 * buzzes nine times in a row gets its notifications turned off for good.
 */
const MAX_PER_CYCLE = 3;

/**
 * Events that interrupt regardless of how the coverage is written.
 *
 * Stance alone was never the right trigger for these. A farmers' dharna
 * outside a market yard is worth an officer's attention whether the reporting
 * condemns it, defends it, or states it flatly — and neutral reporting of a
 * protest was, until now, exactly the thing this system stayed silent about.
 */
const URGENT_EVENTS = ["protest", "rally", "disaster"] as const;

/** Share of critical stance above which a narrative reads as unfavourable. */
const CRITICAL_SHARE = 0.25;
/** Share of supportive stance that makes a narrative good news instead. */
const SUPPORTIVE_SHARE = 0.5;

export interface AlertStageResult {
  candidates: number;
  alerted: number;
  recipients: number;
  skipped: number;
}

export async function runAlertStage(
  db: Db,
  options: { log?: (m: string) => void; baseUrl?: string } = {},
): Promise<AlertStageResult> {
  const log = options.log ?? (() => {});
  const base =
    options.baseUrl ?? process.env.PUBLIC_SITE_URL ?? "https://agriculture.likhithlabs.com";
  const result: AlertStageResult = { candidates: 0, alerted: 0, recipients: 0, skipped: 0 };

  if (!pushConfigured()) {
    log("alerts: skipped — VAPID keys not configured");
    return result;
  }

  /*
   * With nobody subscribed there is nothing to dedup against, and marking
   * the backlog as alerted here would silently consume it: the first
   * officer to subscribe would then never hear about any story that already
   * existed. Do nothing at all instead.
   */
  const [{ count: subscriberCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pushSubscriptions);
  if (subscriberCount === 0) {
    log("alerts: no subscribers — nothing sent, backlog left intact");
    return result;
  }

  const rows = await db
    .select({ finding: intelligenceFindings, narrative: narratives })
    .from(intelligenceFindings)
    .innerJoin(narratives, eq(intelligenceFindings.narrativeId, narratives.id))
    .where(
      and(
        eq(intelligenceFindings.status, "active"),
        eq(intelligenceFindings.dataOrigin, "live"),
      ),
    )
    .orderBy(desc(intelligenceFindings.rank));

  /*
   * Narratives carrying a live protest, rally or disaster. Read once as a set
   * rather than per narrative inside the loop, which would be one query per
   * row for a value most rows do not have.
   */
  const urgentRows = await db
    .selectDistinct({
      narrativeId: narrativeMentions.narrativeId,
      eventType: mentions.eventType,
    })
    .from(narrativeMentions)
    .innerJoin(mentions, eq(mentions.id, narrativeMentions.mentionId))
    .where(
      and(
        inArray(mentions.eventType, [...URGENT_EVENTS]),
        eq(mentions.relevanceStatus, "accepted"),
      ),
    );
  const urgentEvents = new Map(
    urgentRows.filter((r) => r.eventType).map((r) => [r.narrativeId, r.eventType!]),
  );

  const already = new Set(
    (await db.select({ narrativeId: sentAlerts.narrativeId }).from(sentAlerts)).map(
      (r) => r.narrativeId,
    ),
  );

  for (const { finding, narrative } of rows) {
    const stance = narrative.stanceSummary;
    const total = Object.values(stance).reduce((a, b) => a + b, 0);
    const criticalShare = total === 0 ? 0 : (stance["critical"] ?? 0) / total;
    const supportiveShare = total === 0 ? 0 : (stance["supportive"] ?? 0) / total;

    // Same test as the command screen's brief: good news is not an alert.
    const unfavourable = !(supportiveShare >= SUPPORTIVE_SHARE && criticalShare < CRITICAL_SHARE);
    const urgent = urgentEvents.get(narrative.id);
    // An urgent event overrides the stance test entirely.
    if (!urgent && (!unfavourable || criticalShare === 0)) continue;

    result.candidates++;
    if (already.has(narrative.id)) {
      result.skipped++;
      continue;
    }

    const districts = Object.keys(narrative.districts ?? {});
    const where = districts.length > 0 ? ` · ${districts.slice(0, 2).join(", ")}` : "";
    /*
     * Severity goes in the TEXT, not in styling. No mobile OS lets a website
     * choose the colour of a push banner — it is rendered by the system — so
     * a red notification is not something this can deliver. What it can do is
     * put the word where the officer actually reads it, on the first line.
     */
    const prefix = urgent ? `🔴 ${urgent.toUpperCase()}${where} — ` : "";
    const delivery = await sendToAll(db, {
      title: `${prefix}${finding.headline}`.slice(0, 80),
      body: `${narrative.mentionCount} items, ${narrative.uniqueAuthorCount} independent voices${where}`,
      url: `${base}/findings/${finding.id}`,
      // One notification per narrative on the device, replaced not stacked.
      tag: `narrative-${narrative.id}`,
    }, { log });

    await markAlerted(db, finding.id, narrative.id, delivery.sent);
    result.alerted++;
    result.recipients += delivery.sent;
    log(
      `alert${urgent ? ` [${urgent}]` : ""}: "${finding.headline.slice(0, 50)}" → ${delivery.sent} device(s)`,
    );
    if (result.alerted >= MAX_PER_CYCLE) {
      log(`alerts: reached the ${MAX_PER_CYCLE}-per-cycle cap; the rest wait for the next run`);
      break;
    }
  }

  return result;
}
