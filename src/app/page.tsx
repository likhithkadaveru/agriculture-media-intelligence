import { getDb } from "@/db/client";
import { getCommandView, getCoverageByDistrict } from "@/db/queries";
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
 * This component does data assembly only; everything interactive lives in
 * CommandBoard, so the page stays a server component and the filter stays
 * instant.
 */
export default async function CommandPage() {
  const { db } = await getDb();
  const view = await getCommandView(db);
  const { env, brief, findings, districts, media, voiceMix, sourceMix } = view;
  const coverage = await getCoverageByDistrict(db, env.activeOrigin);
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
    voiceMix,
    sourceMix,
    unlocatedCount: districts.unlocatedCount,
    quietDistrictCount: DISTRICTS.length - districts.districts.length,
    totalDistricts: DISTRICTS.length,
  };

  const hasAnything = brief.items.length > 0 || brief.positives.length > 0;

  return (
    <div className="min-h-screen">
      <SiteHeader activeOrigin={env.activeOrigin} lastGeneratedAt={env.lastGeneratedAt} />

      <main className="mx-auto max-w-[1180px] px-6 pb-24">
        <header className="flex flex-wrap items-end justify-between gap-6 py-7">
          <div>
            <h1 className="headline-serif text-[30px] text-ink">{formatFullDate(new Date())}</h1>
            <p className="mt-1 text-[13.5px] text-ink-secondary">
              {season.active.length > 0
                ? season.active.map((w) => w.label).join(" · ")
                : "Between crop windows"}
              {season.approaching.length > 0 && (
                <span className="text-ink-muted">
                  {" — "}
                  {season.approaching[0].window.label} opens in {season.approaching[0].inDays} days
                </span>
              )}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Public items" value={formatNumber(env.relevantMentions)} />
            <Stat label="Conversations" value={String(env.narrativeCount)} />
            <Stat
              label="Districts with evidence"
              value={`${districts.districts.length}/${DISTRICTS.length}`}
            />
          </dl>
        </header>

        {hasAnything ? (
          <CommandBoard data={board} />
        ) : (
          <div className="mt-20 text-center text-ink-muted">
            <p className="headline-serif text-[21px]">Nothing has crossed a threshold.</p>
            <p className="mt-2 text-[14px]">
              Run <code>npm run pipeline</code> to collect and analyse public content.
            </p>
          </div>
        )}

        <p className="mt-14 max-w-[86ch] text-[12px] leading-relaxed text-ink-faint">
          Every figure traces to the public items behind it. Duplicates are shown but never
          counted, districts are assigned only where the text evidences them, and AI
          interpretation is labelled and separated from source content throughout. Open any item
          to see the reasoning and the original sources.
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="kicker text-ink-faint">{label}</dt>
      <dd className="metric-number mt-0.5 text-[23px] text-ink">{value}</dd>
    </div>
  );
}
