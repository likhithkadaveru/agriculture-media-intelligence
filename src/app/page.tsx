import Link from "next/link";
import { getDb } from "@/db/client";
import {
  getCommandView,
  getCoverageByDistrict,
  type BriefItem,
} from "@/db/queries";
import type { FindingComponents } from "@/intelligence/findings/stage";
import { SiteHeader } from "@/components/SiteHeader";
import { MediaCarousel } from "@/components/MediaCarousel";
import { MixBar } from "@/components/viz";
import { StateMap } from "@/components/StateMap";
import { ConfidenceMeter } from "@/components/badges";
import { getSeasonContext } from "@/ontology/calendar";
import { DISTRICTS } from "@/ontology";
import {
  PLATFORM_LABELS,
  VOICE_CLASSES,
  formatDateTime,
  formatFullDate,
  formatNumber,
  groupVoiceMix,
} from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * The command screen.
 *
 * One page carries the whole operational picture — what needs attention,
 * where in the state, who is saying it, and the material behind it — because
 * the intended reader has a few minutes between meetings and will not browse
 * a product. Everything drills into the evidence surface; nothing else needs
 * to be visited.
 */
export default async function CommandPage() {
  const { db } = await getDb();
  const view = await getCommandView(db);
  const { env, brief, findings, districts, media, voiceMix, sourceMix } = view;
  const coverageRows = await getCoverageByDistrict(db, env.activeOrigin);
  const coverage = coverageRows.map((c) => ({ ...c }));
  const season = getSeasonContext();

  const [lead, ...rest] = brief.items;
  const activeDistricts = districts.districts;
  const quietCount = DISTRICTS.length - activeDistricts.length;

  const grouped = groupVoiceMix(voiceMix);
  const voiceSegments = VOICE_CLASSES.map((vc) => ({
    label: vc.label,
    value: grouped[vc.key],
    color: vc.cssVar,
  }));
  const sourceSegments = Object.entries(sourceMix).map(([platform, value], i) => ({
    label: PLATFORM_LABELS[platform] ?? platform,
    value,
    color: ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-other)"][i % 5],
  }));

  const findingById = new Map(findings.map((f) => [f.narrative.id, f]));

  return (
    <div className="min-h-screen">
      <SiteHeader activeOrigin={env.activeOrigin} lastGeneratedAt={env.lastGeneratedAt} />

      <main className="mx-auto max-w-[1240px] px-6 pb-24">
        {/* ---- Standing context: the date, the season, the volume ---- */}
        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-border py-6">
          <div>
            <div className="kicker text-emerging">Today</div>
            <h1 className="headline-serif mt-1 text-[30px] text-ink">
              {formatFullDate(new Date())}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-ink-secondary">
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
          <dl className="flex flex-wrap gap-x-9 gap-y-3">
            <HeaderStat label="Public items" value={formatNumber(env.relevantMentions)} />
            <HeaderStat label="Conversations" value={String(env.narrativeCount)} />
            <HeaderStat label="For attention" value={String(brief.items.length)} />
            <HeaderStat
              label="Districts with evidence"
              value={`${activeDistricts.length}/${DISTRICTS.length}`}
            />
          </dl>
        </header>

        {findings.length === 0 ? (
          <div className="mt-20 text-center text-ink-muted">
            <p className="headline-serif text-[22px]">Nothing has crossed a threshold.</p>
            <p className="mt-2 text-[14px]">
              Run <code>npm run pipeline</code> to collect and analyse public content.
            </p>
          </div>
        ) : (
          <>
            {/* ---- What needs attention ---- */}
            <section className="mt-9">
              <SectionHead
                title="What needs attention"
                note="Ranked by independent voices, geographic spread, source diversity and where the crop cycle stands."
              />
              {lead && <LeadItem item={lead} finding={findingById.get(lead.narrativeId)} />}
              {rest.length > 0 && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {rest.map((item) => (
                    <SecondaryItem
                      key={item.narrativeId}
                      item={item}
                      finding={findingById.get(item.narrativeId)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ---- Going well ---- */}
            {brief.positives.length > 0 && (
              <section className="mt-10 rounded-lg border border-[rgba(26,107,69,0.28)] bg-[var(--positive-soft)] p-6">
                <h2 className="kicker text-positive">Going well</h2>
                <div className="mt-3 grid gap-5 md:grid-cols-3">
                  {brief.positives.map((item) => (
                    <div key={item.narrativeId}>
                      <h3 className="headline-serif text-[17px] text-ink">
                        <Link
                          href={detailHref(item)}
                          className="decoration-ink-faint underline-offset-4 hover:underline"
                        >
                          {item.headline}
                        </Link>
                      </h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
                        {item.line}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ---- Where, and who ---- */}
            <section className="mt-11 grid gap-9 lg:grid-cols-[1fr_300px]">
              <div>
                <SectionHead
                  title="Across the state"
                  note="Districts shaded by the balance of favourable and unfavourable coverage. Districts with no collected evidence are left unshaded."
                />
                <div className="mt-5">
                  <StateMap coverage={coverage} />
                </div>
                <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
                  {formatNumber(districts.unlocatedCount)} items carried no location evidence and
                  are left unassigned rather than distributed to fill the map.{" "}
                  {quietCount} of {DISTRICTS.length} districts have no evidence in this window —
                  silence here means nothing collected named them, not that nothing is happening.
                </p>
              </div>

              <aside className="space-y-7 lg:border-l lg:border-border lg:pl-8">
                <div>
                  <h2 className="kicker text-ink-faint">Who is talking</h2>
                  <div className="mt-2.5">
                    <MixBar segments={voiceSegments} ariaLabel="Voice composition" />
                  </div>
                </div>
                <div>
                  <h2 className="kicker text-ink-faint">Where it came from</h2>
                  <div className="mt-2.5">
                    <MixBar segments={sourceSegments} ariaLabel="Source composition" />
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-surface-2 p-4">
                  <h2 className="kicker text-ink-faint">Collection</h2>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
                    Public YouTube channels and news publications in Telugu and English.
                    Telugu content is translated and analysed in full; video is analysed from
                    title, description and metadata, never from a transcript the system does
                    not have.
                  </p>
                  <p className="mt-2 text-[11.5px] text-ink-faint">
                    Updated {formatDateTime(env.lastGeneratedAt)} IST
                  </p>
                </div>
              </aside>
            </section>

            {/* ---- The material itself ---- */}
            {media.length > 0 && (
              <div className="mt-12 border-t border-border pt-8">
                <MediaCarousel items={media} />
              </div>
            )}
          </>
        )}

        <p className="mt-14 max-w-[86ch] text-[12px] leading-relaxed text-ink-faint">
          Every figure traces to the public items behind it. Duplicates are shown but never
          counted, districts are assigned only where the text evidences them, and AI
          interpretation is labelled and separated from source content throughout. Open any
          item to see the reasoning and the original sources.
        </p>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function detailHref(item: BriefItem): string {
  return item.findingId ? `/findings/${item.findingId}` : `/narratives/${item.narrativeId}`;
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="kicker text-ink-faint">{label}</dt>
      <dd className="metric-number mt-0.5 text-[24px] text-ink">{value}</dd>
    </div>
  );
}

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="headline-serif text-[21px] text-ink">{title}</h2>
      {note && <p className="max-w-[62ch] text-[12.5px] text-ink-muted">{note}</p>}
    </div>
  );
}

const KIND_LABEL: Record<BriefItem["kind"], { label: string; className: string }> = {
  attention: { label: "Needs attention", className: "text-critical" },
  escalating: { label: "Escalating", className: "text-emerging" },
  watch: { label: "Watch", className: "text-ink-muted" },
  positive: { label: "Going well", className: "text-positive" },
};

function LeadItem({
  item,
  finding,
}: {
  item: BriefItem;
  finding?: { finding: { components: unknown; confidence: number } };
}) {
  const c = finding?.finding.components as FindingComponents | undefined;
  const kind = KIND_LABEL[item.kind];
  return (
    <article className="mt-4 rounded-lg border border-border bg-surface p-7">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={`kicker ${kind.className}`}>{kind.label}</span>
        {c?.divergenceObserved && (
          <span className="kicker text-critical">Official ↔ public divergence</span>
        )}
        {finding && (
          <span className="ml-auto">
            <ConfidenceMeter value={finding.finding.confidence} label="Confidence" />
          </span>
        )}
      </div>
      <h3 className="headline-serif mt-3 max-w-[30ch] text-[30px] text-ink">
        <Link href={detailHref(item)} className="decoration-ink-faint underline-offset-4 hover:underline">
          {item.headline}
        </Link>
      </h3>
      <p className="mt-3 max-w-[74ch] text-[15px] leading-relaxed text-ink-secondary">
        {item.line}
      </p>
      {item.seasonalReason && (
        <p className="mt-3 max-w-[74ch] border-l-2 border-emerging pl-4 text-[13.5px] leading-relaxed text-ink-secondary">
          <span className="kicker mr-2 text-emerging">Season</span>
          {item.seasonalReason}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-2 text-[12.5px] text-ink-muted">
        <span>
          <span className="metric-number text-[17px] text-ink">{item.voices}</span> independent
          {item.voices === 1 ? " voice" : " voices"}
        </span>
        {c && (
          <span>
            <span className="metric-number text-[17px] text-ink">{c.sourceTypeCount}</span> source
            {c.sourceTypeCount === 1 ? " type" : " types"}
          </span>
        )}
        {item.districts.length > 0 && <span>{item.districts.join(", ")}</span>}
        {c && c.duplicatesExcluded > 0 && (
          <span className="text-ink-faint">{c.duplicatesExcluded} duplicates excluded</span>
        )}
        <Link
          href={detailHref(item)}
          className="ml-auto font-medium text-ink hover:text-emerging"
        >
          See the evidence →
        </Link>
      </div>
    </article>
  );
}

function SecondaryItem({
  item,
  finding,
}: {
  item: BriefItem;
  finding?: { finding: { components: unknown } };
}) {
  const c = finding?.finding.components as FindingComponents | undefined;
  const kind = KIND_LABEL[item.kind];
  return (
    <article className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-border-strong">
      <span className={`kicker ${kind.className}`}>{kind.label}</span>
      <h3 className="headline-serif mt-2 text-[18px] text-ink">
        <Link href={detailHref(item)} className="decoration-ink-faint underline-offset-4 hover:underline">
          {item.headline}
        </Link>
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{item.line}</p>
      {item.seasonalReason && (
        <p className="mt-2 text-[12px] leading-relaxed text-emerging">{item.seasonalReason}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2.5 text-[11.5px] text-ink-faint">
        <span>{item.voices} voices</span>
        {c && <span>{c.sourceTypeCount} source types</span>}
        {item.districts.length > 0 && <span>{item.districts.join(", ")}</span>}
        <Link href={detailHref(item)} className="ml-auto text-ink-muted hover:text-emerging">
          Evidence →
        </Link>
      </div>
    </article>
  );
}
