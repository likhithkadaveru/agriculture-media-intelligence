"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BriefItem, MediaItem } from "@/db/queries";
import type { FindingComponents } from "@/intelligence/findings/stage";
import type { CoverageDistrict } from "@/components/StateMap";
import { StateMap } from "@/components/StateMap";
import { MediaCarousel } from "@/components/MediaCarousel";
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

export type Lens = "all" | "concerns" | "positive";

export interface BoardData {
  concerns: BriefItem[];
  positives: BriefItem[];
  components: Record<string, FindingComponents>;
  coverage: CoverageDistrict[];
  media: MediaItem[];
  voiceMix: Record<string, number>;
  sourceMix: Record<string, number>;
  unlocatedCount: number;
  quietDistrictCount: number;
  totalDistricts: number;
}

const LENSES: { key: Lens; label: string; hint: string }[] = [
  { key: "all", label: "Everything", hint: "All tracked conversations" },
  { key: "concerns", label: "Concerns", hint: "Issues needing attention" },
  { key: "positive", label: "Positive", hint: "What is going well" },
];

export function CommandBoard({ data }: { data: BoardData }) {
  const [lens, setLens] = useState<Lens>("all");

  const items = useMemo(() => {
    if (lens === "concerns") return data.concerns;
    if (lens === "positive") return data.positives;
    return [...data.concerns, ...data.positives];
  }, [lens, data.concerns, data.positives]);

  /*
   * The map follows the lens too. Showing "positive" while the map still
   * shades unfavourable coverage would put two different answers on one
   * screen — the fastest way to lose a reader who is skimming.
   */
  const coverage = useMemo(() => {
    if (lens === "all") return data.coverage;
    return data.coverage.map((c) => {
      if (lens === "concerns") {
        const total = c.unfavourable;
        return { ...c, total, favourable: 0, neutral: 0, balance: total > 0 ? -1 : 0 };
      }
      const total = c.favourable;
      return { ...c, total, unfavourable: 0, neutral: 0, balance: total > 0 ? 1 : 0 };
    });
  }, [lens, data.coverage]);

  const media = useMemo(() => {
    if (lens === "all") return data.media;
    const wanted = lens === "concerns" ? "critical" : "supportive";
    const filtered = data.media.filter((m) => m.stance === wanted);
    // Never show an empty strip just because a lens is narrow — an officer
    // reads that as "broken", not as "nothing matched".
    return filtered.length > 0 ? filtered : data.media;
  }, [lens, data.media]);

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
      <div className="mt-7 flex flex-wrap items-center gap-4 border-b border-border pb-5">
        <div
          role="tablist"
          aria-label="Filter what is shown"
          className="inline-flex rounded-md border border-border-strong bg-surface p-0.5"
        >
          {LENSES.map((l) => {
            const active = lens === l.key;
            const count =
              l.key === "concerns"
                ? data.concerns.length
                : l.key === "positive"
                  ? data.positives.length
                  : data.concerns.length + data.positives.length;
            return (
              <button
                key={l.key}
                role="tab"
                aria-selected={active}
                title={l.hint}
                onClick={() => setLens(l.key)}
                className={`rounded px-4 py-1.5 text-[13.5px] font-medium transition-colors ${
                  active
                    ? l.key === "concerns"
                      ? "bg-[var(--critical-soft)] text-critical"
                      : l.key === "positive"
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
          {lens === "concerns"
            ? "Issues where public reporting is critical."
            : lens === "positive"
              ? "Where public reception is favourable."
              : "Everything currently tracked."}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-10 text-[14px] text-ink-muted">
          Nothing in this view right now.
        </p>
      ) : (
        <section className="mt-7">
          <ol className="space-y-3">
            {items.map((item, i) => (
              <ItemRow
                key={item.narrativeId}
                item={item}
                index={i}
                components={data.components[item.narrativeId]}
              />
            ))}
          </ol>
        </section>
      )}

      {/* ---- Where ---- */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="headline-serif text-[20px] text-ink">Across the state</h2>
          <p className="text-[12.5px] text-ink-muted">
            {lens === "concerns"
              ? "Districts with unfavourable coverage."
              : lens === "positive"
                ? "Districts with favourable coverage."
                : "Balance of favourable and unfavourable coverage."}
          </p>
        </div>
        <div className="mt-5">
          <StateMap coverage={coverage} />
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
          {formatNumber(data.unlocatedCount)} items carried no location evidence and are left
          unassigned rather than spread across districts to fill the map. {data.quietDistrictCount}{" "}
          of {data.totalDistricts} districts have no evidence in this window — silence means
          nothing collected named them, not that nothing is happening.
        </p>
      </section>

      {/* ---- Who, and from where ---- */}
      <section className="mt-11 grid gap-8 sm:grid-cols-2">
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

      {media.length > 0 && (
        <div className="mt-12 border-t border-border pt-8">
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
        className="group flex gap-4 rounded-md border border-border bg-surface p-5 transition-colors hover:border-border-strong"
      >
        {/* Severity stripe — state readable without reading the label. */}
        <span aria-hidden className={`w-[3px] shrink-0 rounded-full ${tone.bar}`} />
        <span className="metric-number mt-0.5 w-5 shrink-0 text-[16px] text-ink-faint">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <span className={`kicker ${tone.className}`}>{tone.label}</span>
          <h3 className="headline-serif mt-1 text-[19px] text-ink group-hover:underline decoration-ink-faint underline-offset-4">
            {item.headline}
          </h3>
          <p className="mt-1.5 max-w-[76ch] text-[13.5px] leading-relaxed text-ink-secondary">
            {item.line}
          </p>
          {item.seasonalReason && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-emerging">
              {item.seasonalReason}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-ink-faint">
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
