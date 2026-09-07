"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BriefItem, CoverageCounts, CoverageItem, MediaItem } from "@/db/queries";
import type { FindingComponents } from "@/intelligence/findings/stage";
import type { CoverageDistrict } from "@/components/StateMap";
import { StateMap } from "@/components/StateMap";
import { MediaCarousel } from "@/components/MediaCarousel";
import { CoverageFeed } from "@/components/CoverageFeed";
import { MixBar } from "@/components/viz";
import { VOICE_CLASSES, PLATFORM_LABELS, formatNumber, groupVoiceMix } from "@/lib/format";

/**
 * The command board.
 *
 * One filter governs the whole screen: concerns, positives, or everything.
 * An officer with three minutes should be able to answer "what is going
 * wrong" and "what is going right" with a single click each, without
 * learning any part of the interface.
 *
 * Filtering is client-side and instant — a round trip to re-render the page
 * would make the control feel like navigation rather than a lens.
 */

/*
 * Renamed from concerns/positive to match the words the department uses, and
 * split "factual" out of what used to be lumped into Everything. Officers
 * work the unfavourable pile first, so that is the default view rather than
 * a filter they have to reach for — Everything is still one tap away.
 */
export type Lens = "unfavourable" | "factual" | "favourable" | "all";

/** Stances that belong to each lens. "mixed" carries criticism, so it sits
 *  with unfavourable: an officer scanning for problems should see it. */
const LENS_STANCES: Record<Exclude<Lens, "all">, string[]> = {
  unfavourable: ["critical", "mixed"],
  factual: ["neutral"],
  favourable: ["supportive"],
};

export interface BoardData {
  concerns: BriefItem[];
  positives: BriefItem[];
  components: Record<string, FindingComponents>;
  coverage: CoverageDistrict[];
  media: MediaItem[];
  coverage_feed: CoverageItem[];
  /** Corpus-wide counts, not the feed window. */
  coverageCounts: CoverageCounts;
  voiceMix: Record<string, number>;
  sourceMix: Record<string, number>;
  unlocatedCount: number;
  quietDistrictCount: number;
  totalDistricts: number;
}

const LENSES: { key: Lens; label: string; hint: string }[] = [
  { key: "unfavourable", label: "Unfavourable", hint: "Criticism and complaint — work this first" },
  { key: "factual", label: "Factual", hint: "Reported without praise or blame" },
  { key: "favourable", label: "Favourable", hint: "What is going well" },
  { key: "all", label: "Everything", hint: "All tracked conversations" },
];

export function CommandBoard({ data }: { data: BoardData }) {
  const [lens, setLens] = useState<Lens>("unfavourable");
  /*
   * Clicking a district narrows every panel to it. Held here rather than in
   * the map so the feed, the strip and the brief all answer the same
   * question — a map selection that only changed the map would be a legend.
   */
  const [district, setDistrict] = useState<string | null>(null);

  const items = useMemo(() => {
    if (lens === "unfavourable") return data.concerns;
    if (lens === "favourable") return data.positives;
    // Factual coverage is by definition neither a concern nor a positive, so
    // the brief has nothing to say about it; the feed below carries the view.
    if (lens === "factual") return [];
    return [...data.concerns, ...data.positives];
  }, [lens, data.concerns, data.positives]);

  /*
   * The map follows the lens too. Showing "positive" while the map still
   * shades unfavourable coverage would put two different answers on one
   * screen — the fastest way to lose a reader who is skimming.
   */
  const coverage = useMemo(() => {
    if (lens === "all") return data.coverage;
    if (lens === "factual") return data.coverage.map((c) => ({ ...c, total: c.neutral, unfavourable: 0, favourable: 0, balance: 0 }));
    return data.coverage.map((c) => {
      if (lens === "unfavourable") {
        const total = c.unfavourable;
        return { ...c, total, favourable: 0, neutral: 0, balance: total > 0 ? -1 : 0 };
      }
      const total = c.favourable;
      return { ...c, total, unfavourable: 0, neutral: 0, balance: total > 0 ? 1 : 0 };
    });
  }, [lens, data.coverage]);

  const media = useMemo(() => {
    if (lens === "all") return data.media;
    const wanted = LENS_STANCES[lens];
    const filtered = data.media.filter((m) => m.stance && wanted.includes(m.stance));
    // Never show an empty strip just because a lens is narrow — an officer
    // reads that as "broken", not as "nothing matched".
    return filtered.length > 0 ? filtered : data.media;
  }, [lens, data.media]);

  const coverageFeed = useMemo(() => {
    /*
     * No silent fallback to the full list here any more. When the lenses were
     * a vague "Concerns"/"Positive" pair, an empty result read as breakage;
     * now that they are named categories with counts on the tab, an empty
     * Factual list is information — and quietly showing unfavourable items
     * under a Favourable heading would be a lie.
     */
    const byLens =
      lens === "all"
        ? data.coverage_feed
        : data.coverage_feed.filter((c) => c.stance && LENS_STANCES[lens].includes(c.stance));
    return district ? byLens.filter((c) => c.district === district) : byLens;
  }, [lens, district, data.coverage_feed]);

  /*
   * Tab counts come from the corpus, never from the feed window. Counting the
   * window made the tab say 6 unfavourable while the totals panel beside it
   * said 52 — the same screen disagreeing with itself, which is the fastest
   * way to lose an official's trust in every other number on it.
   */
  const lensCounts = useMemo(() => {
    const c = district
      ? (data.coverageCounts.byDistrict[district] ?? {
          unfavourable: 0,
          factual: 0,
          favourable: 0,
          all: 0,
        })
      : data.coverageCounts;
    return {
      unfavourable: c.unfavourable,
      factual: c.factual,
      favourable: c.favourable,
      all: c.all,
    } as Record<Lens, number>;
  }, [district, data.coverageCounts]);

  const grouped = groupVoiceMix(data.voiceMix);
  const voiceSegments = VOICE_CLASSES.map((vc) => ({
    label: vc.label,
    value: grouped[vc.key],
    color: vc.cssVar,
  }));
  const sourceSegments = Object.entries(data.sourceMix).map(([platform, value], i) => ({
    label: PLATFORM_LABELS[platform] ?? platform,
    value,
    color: ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-other)"][i % 5],
  }));

  return (
    <>
      {/* ---- The one control on the page ---- */}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-b border-border pb-4 sm:mt-7 sm:gap-4 sm:pb-5">
        <div
          role="tablist"
          aria-label="Filter what is shown"
          className="flex w-full rounded-md border border-border-strong bg-surface p-0.5 sm:inline-flex sm:w-auto"
        >
          {LENSES.map((l) => {
            const active = lens === l.key;
            const count = lensCounts[l.key];
            return (
              <button
                key={l.key}
                role="tab"
                aria-selected={active}
                title={l.hint}
                onClick={() => setLens(l.key)}
                className={`min-h-[44px] flex-1 rounded px-4 py-2.5 text-[13.5px] font-medium transition-colors sm:min-h-0 sm:flex-none sm:py-1.5 ${
                  active
                    ? l.key === "unfavourable"
                      ? "bg-[var(--critical-soft)] text-critical"
                      : l.key === "favourable"
                        ? "bg-[var(--positive-soft)] text-positive"
                        : "bg-surface-3 text-ink"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {l.label}
                <span className="ml-1.5 tabular-nums opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[12.5px] text-ink-muted">
          {lens === "unfavourable"
            ? "Where public reporting is critical or mixed."
            : lens === "favourable"
              ? "Where public reception is favourable."
              : lens === "factual"
                ? "Reported without praise or blame — no action implied."
                : "Everything currently tracked."}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-10 text-[14px] text-ink-muted">
          {/*
            Factual coverage never produces a finding — a finding is by
            definition a concern or something going well. Saying "nothing
            right now" here reads as a data problem or a broken page, every
            single time, while the feed below plainly has items.
          */}
          {lens === "factual"
            ? "Factual coverage raises no findings — it is reported without praise or blame. The items themselves are below."
            : "Nothing in this view right now."}
        </p>
      ) : (
        <section className="mt-6 sm:mt-8">
          {/* The first item carries the weight. A briefing that gives every
              item equal size forces the reader to do the ranking. */}
          <LeadItem item={items[0]} components={data.components[items[0].narrativeId]} />
          {items.length > 1 && (
            <ol className="mt-4 space-y-2.5">
              {items.slice(1).map((item, i) => (
                <ItemRow
                  key={item.narrativeId}
                  item={item}
                  index={i + 2}
                  components={data.components[item.narrativeId]}
                />
              ))}
            </ol>
          )}
        </section>
      )}

      {/* ---- Where ---- */}
      <section className="mt-10 sm:mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="headline-serif text-[20px] text-ink">Across the state</h2>
          <p className="text-[12.5px] text-ink-muted">
            {district
              ? `Showing ${district} only — tap it again to clear.`
              : lens === "unfavourable"
                ? "Districts with unfavourable coverage. Tap one to see its articles."
                : lens === "favourable"
                  ? "Districts with favourable coverage. Tap one to see its articles."
                  : "Tap a district to see its articles."}
          </p>
        </div>
        <div className="mt-5">
          <StateMap
            coverage={coverage}
            totalsCoverage={data.coverage}
            selected={district}
            onSelect={setDistrict}
          />
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
          {formatNumber(data.unlocatedCount)} items carried no location evidence and are left
          unassigned rather than spread across districts to fill the map. {data.quietDistrictCount}{" "}
          of {data.totalDistricts} districts have no evidence in this window — silence means
          nothing collected named them, not that nothing is happening.
        </p>
      </section>

      {/* ---- Who, and from where ---- */}
      <section className="mt-9 grid gap-7 sm:mt-11 sm:grid-cols-2 sm:gap-8">
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
      </section>

      {/*
        Rendered unconditionally now. The guard made sense when the feed was
        never filtered — an empty coverage section meant no data at all. Under
        a lens or a district selection, emptiness is a real answer, and the
        feed says so itself rather than vanishing and leaving the officer with
        a cleared map and no explanation.
      */}
      <div className="mt-10 sm:mt-12">
        {(
          <CoverageFeed
            items={coverageFeed}
            total={lensCounts[lens]}
            district={district}
            onClearDistrict={() => setDistrict(null)}
          />
        )}
      </div>

      {media.length > 0 && (
        <div className="mt-10 border-t border-border pt-7 sm:mt-12 sm:pt-8">
          <MediaCarousel items={media} />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function detailHref(item: BriefItem): string {
  return item.findingId ? `/findings/${item.findingId}` : `/narratives/${item.narrativeId}`;
}

const TONE: Record<BriefItem["kind"], { label: string; className: string; bar: string }> = {
  attention: { label: "Needs attention", className: "text-critical", bar: "bg-[var(--critical)]" },
  escalating: { label: "Escalating", className: "text-emerging", bar: "bg-[var(--attention)]" },
  watch: { label: "Watch", className: "text-ink-muted", bar: "bg-[var(--rule-strong)]" },
  positive: { label: "Going well", className: "text-positive", bar: "bg-[var(--positive)]" },
};

/**
 * The lead item. Large display type, generous space, and the metrics spelled
 * out — this is the thing an officer should read even if they read nothing
 * else on the page.
 */
function LeadItem({
  item,
  components,
}: {
  item: BriefItem;
  components?: FindingComponents;
}) {
  const tone = TONE[item.kind];
  return (
    <Link
      href={detailHref(item)}
      className="group block rounded-lg border border-border bg-surface p-5 transition-colors hover:border-[var(--rule-strong)] sm:p-8"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={`kicker ${tone.className}`}>{tone.label}</span>
        {components?.divergenceObserved && (
          <span className="kicker text-critical">Official ↔ public divergence</span>
        )}
        {item.trendStatus && (
          <span className="kicker text-ink-faint">{item.trendStatus}</span>
        )}
      </div>

      <h3 className="headline-serif mt-3 max-w-[24ch] text-[clamp(22px,5.6vw,38px)] leading-[1.12] text-ink group-hover:underline decoration-[var(--rule-strong)] underline-offset-[6px]">
        {item.headline}
      </h3>

      <p className="mt-3 max-w-[70ch] text-[14.5px] leading-relaxed text-ink-secondary sm:mt-4 sm:text-[15.5px]">
        {item.line}
      </p>

      {item.seasonalReason && (
        <p className="mt-3 max-w-[70ch] border-l-2 border-[var(--attention)] bg-[var(--attention-soft)] py-2 pl-3 text-[13px] leading-relaxed text-ink-secondary sm:mt-4 sm:pl-4 sm:text-[13.5px]">
          <span className="kicker mr-2 text-emerging">Season</span>
          {item.seasonalReason}
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4 sm:mt-6 sm:flex sm:flex-wrap sm:gap-x-10 sm:pt-5">
        <LeadStat label="Independent voices" value={String(item.voices)} />
        {components && (
          <LeadStat label="Source types" value={String(components.sourceTypeCount)} />
        )}
        {item.districts.length > 0 && (
          <LeadStat
            label={item.districts.length === 1 ? "District" : "Districts"}
            value={String(item.districts.length)}
            detail={item.districts.join(", ")}
          />
        )}
        {components && components.duplicatesExcluded > 0 && (
          <LeadStat label="Duplicates excluded" value={String(components.duplicatesExcluded)} />
        )}
        {/* `ml-auto` has nothing to push against in a grid, so the call to
            action takes its own full-width row on mobile. */}
        <span className="col-span-2 text-[13px] font-medium text-seal sm:col-span-1 sm:ml-auto sm:self-end">
          See the evidence →
        </span>
      </dl>
    </Link>
  );
}

function LeadStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      {/* These labels are long enough that some wrap to two lines and some do
          not, which in a grid leaves the figures sitting at different
          heights. Reserving two lines on mobile puts them back on one line. */}
      <dt className="kicker min-h-[2.9em] text-ink-faint sm:min-h-0">{label}</dt>
      <dd className="metric-number mt-1 text-[26px] leading-none text-ink">
        {value}
        {detail && (
          <span className="ml-2 font-sans text-[12px] font-normal tracking-normal text-ink-muted">
            {detail}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * One row per item. Deliberately a row, not a card: a busy reader scans a
 * left edge down the page, and cards of varying height break that line.
 */
function ItemRow({
  item,
  index,
  components,
}: {
  item: BriefItem;
  index: number;
  components?: FindingComponents;
}) {
  const tone = TONE[item.kind];
  return (
    <li>
      <Link
        href={detailHref(item)}
        className="group flex gap-2.5 rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong sm:gap-4 sm:p-5"
      >
        {/* Severity stripe — state readable without reading the label. */}
        <span aria-hidden className={`w-[3px] shrink-0 rounded-full ${tone.bar}`} />
        {/* The rank keeps the scannable left edge, but a full-width gutter
            costs a phone column more than the ordering is worth. */}
        <span className="metric-number mt-0.5 w-3.5 shrink-0 text-[14px] text-ink-faint sm:w-5 sm:text-[16px]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <span className={`kicker ${tone.className}`}>{tone.label}</span>
          <h3 className="headline-serif mt-1 text-[17px] text-ink group-hover:underline decoration-ink-faint underline-offset-4 sm:text-[19px]">
            {item.headline}
          </h3>
          <p className="clamp-mobile-2 mt-1.5 max-w-[76ch] text-[13px] leading-relaxed text-ink-secondary sm:text-[13.5px]">
            {item.line}
          </p>
          {item.seasonalReason && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-emerging">
              {item.seasonalReason}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-faint sm:gap-x-5">
            <span>
              {item.voices} independent {item.voices === 1 ? "voice" : "voices"}
            </span>
            {components && <span>{components.sourceTypeCount} source types</span>}
            {item.districts.length > 0 && <span>{item.districts.join(", ")}</span>}
            {components && components.duplicatesExcluded > 0 && (
              <span>{components.duplicatesExcluded} duplicates excluded</span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}
