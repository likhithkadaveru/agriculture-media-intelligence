import { getDb } from "@/db/client";
import { getCommandView, getCoverageByDistrict, getCoverageFeed } from "@/db/queries";
import type { FindingComponents } from "@/intelligence/findings/stage";
import { SiteHeader } from "@/components/SiteHeader";
import { CommandBoard, type BoardData } from "@/components/CommandBoard";
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
  const [coverage, coverageFeed] = await Promise.all([
    getCoverageByDistrict(db, env.activeOrigin),
    getCoverageFeed(db, env.activeOrigin, 30),
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
    voiceMix,
    sourceMix,
    unlocatedCount: districts.unlocatedCount,
    quietDistrictCount: DISTRICTS.length - districts.districts.length,
    totalDistricts: DISTRICTS.length,
  };

  const hasAnything = brief.items.length > 0 || brief.positives.length > 0;
  const unfavourable = coverage.reduce((s, c) => s + c.unfavourable, 0);
  const favourable = coverage.reduce((s, c) => s + c.favourable, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader activeOrigin={env.activeOrigin} lastGeneratedAt={env.lastGeneratedAt} />

      {/*
        Standing band. A briefing opens by establishing where things stand
        before it says anything — the date, the point in the crop cycle, and
        the volume behind everything below.
      */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1180px] px-6 py-9">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="kicker text-seal">Daily situation</div>
              <h1 className="headline-serif mt-2 text-[clamp(30px,4vw,46px)] leading-[1.05] text-ink">
                {formatFullDate(new Date())}
              </h1>
              <p className="mt-2.5 max-w-[52ch] text-[14.5px] leading-relaxed text-ink-secondary">
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

            <dl className="flex flex-wrap gap-x-10 gap-y-4">
              <Stat label="Public items" value={formatNumber(env.relevantMentions)} />
              <Stat label="Conversations" value={String(env.narrativeCount)} />
              <Stat
                label="Unfavourable"
                value={formatNumber(unfavourable)}
                tone="critical"
              />
              <Stat label="Favourable" value={formatNumber(favourable)} tone="positive" />
              <Stat
                label="Districts"
                value={`${districts.districts.length}`}
                suffix={`/${DISTRICTS.length}`}
              />
            </dl>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1180px] px-6 pb-24">
        {hasAnything ? (
          <CommandBoard data={board} />
        ) : (
          <div className="mt-24 text-center text-ink-muted">
            <p className="headline-serif text-[22px]">Nothing has crossed a threshold.</p>
            <p className="mt-2 text-[14px]">
              Run <code>npm run pipeline</code> to collect and analyse public content.
            </p>
          </div>
        )}

        <p className="mt-16 max-w-[86ch] border-t border-border pt-5 text-[12px] leading-relaxed text-ink-faint">
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
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "critical" | "positive";
}) {
  const ink =
    tone === "critical" ? "text-critical" : tone === "positive" ? "text-positive" : "text-ink";
  return (
    <div>
      <dt className="kicker text-ink-faint">{label}</dt>
      <dd className={`metric-number mt-1 text-[30px] leading-none ${ink}`}>
        {value}
        {suffix && <span className="text-[18px] text-ink-faint">{suffix}</span>}
      </dd>
    </div>
  );
}
