import { getDb } from "@/db/client";
import {
  getCommandView,
  getCoverageByDistrict,
  getCoverageCounts,
  getCoverageFeed,
} from "@/db/queries";
import type { FindingComponents } from "@/intelligence/findings/stage";
import { SiteHeader } from "@/components/SiteHeader";
import { CommandBoard, type BoardData } from "@/components/CommandBoard";
import { AlertOptIn } from "@/components/AlertOptIn";
import { getSeasonContext } from "@/ontology/calendar";
import { DISTRICTS } from "@/ontology";
import { formatFullDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The command screen — the only operational surface.
 *
 * Data assembly only; everything interactive lives in CommandBoard so the
 * page stays a server component and the filter stays instant.
 */
export default async function CommandPage() {
  const { db } = await getDb();
  const view = await getCommandView(db);
  const { env, brief, findings, districts, media, voiceMix, sourceMix } = view;
  const [coverage, coverageFeed, coverageCounts] = await Promise.all([
    getCoverageByDistrict(db, env.activeOrigin),
    /*
     * The feed is a recent window for reading; the counts describe the whole
     * corpus. Keeping them separate is what stops the tabs contradicting the
     * totals panel beside them.
     */
    getCoverageFeed(db, env.activeOrigin, 60),
    getCoverageCounts(db, env.activeOrigin),
  ]);
  const season = getSeasonContext();

  const components: Record<string, FindingComponents> = {};
  for (const f of findings) {
    components[f.narrative.id] = f.finding.components as FindingComponents;
  }

  const board: BoardData = {
    concerns: brief.items,
    positives: brief.positives,
    components,
    coverage,
    media,
    coverage_feed: coverageFeed,
    coverageCounts,
    voiceMix,
    sourceMix,
    unlocatedCount: districts.unlocatedCount,
    quietDistrictCount: DISTRICTS.length - districts.districts.length,
    totalDistricts: DISTRICTS.length,
  };

  const hasAnything = brief.items.length > 0 || brief.positives.length > 0;
  /*
   * From the corpus counts, not the district map. Summing the map meant the
   * standing band said 52 unfavourable while the tab directly beneath it said
   * 109 — the map can only count items whose district was evidenced, which is
   * fewer than half. A headline figure has to describe the whole population
   * it sits above.
   */
  const unfavourable = coverageCounts.unfavourable;
  const favourable = coverageCounts.favourable;

  /*
   * The one sentence the page exists to deliver.
   *
   * An officer opening this on a phone should learn what needs doing before
   * scrolling. Previously the first screen was a banner, a sub-banner,
   * branding, the date and five aggregate counts — every one of them true,
   * none of them a reason to act — and the first actual signal began below
   * the fold. Volume is a property of the monitoring; it is not the brief.
   */
  const needsVerification = brief.items.length;
  const briefDistricts = new Set(brief.items.flatMap((i) => i.districts));

  return (
    <div className="min-h-screen">
      <SiteHeader activeOrigin={env.activeOrigin} lastGeneratedAt={env.lastGeneratedAt} />

      {/*
        Standing band. A briefing opens by establishing where things stand
        before it says anything — the date, the point in the crop cycle, and
        the volume behind everything below.
      */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-9">
          <div className="flex flex-wrap items-end justify-between gap-6 sm:gap-8">
            <div>
              <div className="kicker text-seal">Daily situation</div>
              <h1 className="headline-serif mt-2 text-[clamp(25px,6.4vw,46px)] leading-[1.05] text-ink">
                {formatFullDate(new Date())}
              </h1>
              <p className="mt-2.5 max-w-[52ch] text-[14px] leading-relaxed text-ink-secondary sm:text-[14.5px]">
                <span className="font-medium text-ink">
                  {season.active.length > 0
                    ? season.active.map((w) => w.label).join(" · ")
                    : "Between crop windows"}
                </span>
                {season.approaching.length > 0 && (
                  <>
                    {" — "}
                    {season.approaching[0].window.label} opens in{" "}
                    <span className="font-medium text-emerging">
                      {season.approaching[0].inDays} days
                    </span>
                  </>
                )}
              </p>
            </div>

            {/*
              Statistics have moved below the signals, into Coverage. They
              describe how much was collected, which is a question about the
              system rather than about the state of things — and it was
              occupying the screen an officer needs for what to do next.
            */}
          </div>

          {needsVerification > 0 && (
            <p className="mt-5 text-[15px] leading-snug text-ink sm:mt-6 sm:text-[16px]">
              <span className="font-semibold text-critical">
                {needsVerification} {needsVerification === 1 ? "issue" : "issues"} require
                {needsVerification === 1 ? "s" : ""} verification
              </span>
              {briefDistricts.size > 0 && (
                <span className="text-ink-secondary">
                  {" "}
                  across {briefDistricts.size}{" "}
                  {briefDistricts.size === 1 ? "district" : "districts"}
                </span>
              )}
            </p>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-[1180px] px-4 pb-16 sm:px-6 sm:pb-24">
        {hasAnything ? (
          <>
            <CommandBoard data={board} />

            {/*
              Monitoring volume, kept but demoted. It answers "how much is
              this system seeing", which matters for trusting the brief and
              not at all for acting on it — so it sits after the signals
              rather than in front of them.
            */}
            <section className="mt-12 border-t border-border pt-6 sm:mt-16">
              <h2 className="kicker text-ink-faint">Coverage collected</h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-4">
                <Stat label="Public items" value={formatNumber(env.relevantMentions)} />
                <Stat label="Conversations" value={String(env.narrativeCount)} />
                <Stat
                  label="Needs verification"
                  value={formatNumber(unfavourable)}
                  tone="critical"
                />
                <Stat label="Positive" value={formatNumber(favourable)} tone="positive" />
                <Stat
                  label="Districts"
                  value={`${districts.districts.length}`}
                  suffix={`/${DISTRICTS.length}`}
                  span
                />
              </dl>
            </section>
          </>
        ) : (
          <div className="mt-24 text-center text-ink-muted">
            <p className="headline-serif text-[22px]">Nothing has crossed a threshold.</p>
            <p className="mt-2 text-[14px]">
              Run <code>npm run pipeline</code> to collect and analyse public content.
            </p>
          </div>
        )}

        <div className="mt-12 border-t border-border pt-5 sm:mt-16">
          <AlertOptIn />
        </div>

        <p className="mt-6 max-w-[86ch] text-[12px] leading-relaxed text-ink-faint">
          Every figure traces to the public items behind it. Duplicates are shown but never
          counted, districts are assigned only where the text evidences them, and AI
          interpretation is labelled and separated from source content throughout. Open any item
          to see the reasoning and the original sources.
        </p>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  tone,
  span,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "critical" | "positive";
  /** Fill the mobile grid row; ignored once the row becomes a flex line. */
  span?: boolean;
}) {
  const ink =
    tone === "critical" ? "text-critical" : tone === "positive" ? "text-positive" : "text-ink";
  return (
    <div className={span ? "col-span-2 sm:col-span-1" : undefined}>
      <dt className="kicker text-ink-faint">{label}</dt>
      <dd className={`metric-number mt-1 text-[26px] leading-none sm:text-[30px] ${ink}`}>
        {value}
        {suffix && <span className="text-[18px] text-ink-faint">{suffix}</span>}
      </dd>
    </div>
  );
}
