"use client";

import { useState } from "react";
import type { CoverageItem } from "@/db/queries";
import { LANGUAGE_LABELS, PLATFORM_LABELS, formatDateTime } from "@/lib/format";

/**
 * The clippings digest.
 *
 * Written coverage is scanned, not looked at, so it gets a dense list rather
 * than the picture strip. The reading order is what an officer actually asks:
 * who published it, what it says, where, and how it reads — in that order,
 * down a fixed left edge.
 *
 * The full digest is thirty items, which is a column on a desktop screen and
 * most of the page on a phone. On small screens the tail is folded away
 * behind a count rather than dropped: the reader still knows exactly how much
 * is there, and one tap is a smaller cost than a thousand pixels of scroll.
 * Desktop is unaffected — the fold is CSS, so the wide layout always shows
 * every item whatever the toggle says.
 */

/** Items kept above the fold on small screens. */
const MOBILE_VISIBLE = 10;

const STANCE: Record<string, { label: string; className: string; rule: string }> = {
  critical: {
    label: "Unfavourable",
    className: "text-critical",
    rule: "bg-[var(--critical)]",
  },
  supportive: {
    label: "Favourable",
    className: "text-positive",
    rule: "bg-[var(--positive)]",
  },
  mixed: { label: "Mixed", className: "text-emerging", rule: "bg-[var(--attention)]" },
  neutral: { label: "Factual", className: "text-ink-muted", rule: "bg-[var(--rule-strong)]" },
};

export function CoverageFeed({ items }: { items: CoverageItem[] }) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const foldable = items.length > MOBILE_VISIBLE;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="headline-serif text-[19px] text-ink sm:text-[20px]">Coverage</h2>
        <p className="text-[12.5px] text-ink-muted">
          {items.length} most recent items across press, broadcast and public posts
        </p>
      </div>

      <ul className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
        {items.map((item, i) => {
          const tone = STANCE[item.stance ?? "neutral"] ?? STANCE.neutral;
          const isTelugu = item.language === "te" || item.language === "mixed";
          const folded = foldable && !expanded && i >= MOBILE_VISIBLE;
          return (
            <li key={item.id} className={folded ? "hidden sm:list-item" : undefined}>
              <a
                href={item.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 py-3 transition-colors hover:bg-surface sm:gap-4 sm:py-3.5"
              >
                {/* Stance reads as position on a fixed edge before it reads as colour. */}
                <span aria-hidden className={`mt-1 w-[3px] shrink-0 rounded-full ${tone.rule}`} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-[12px] font-semibold text-ink-secondary">
                      {item.outlet ?? "Unknown source"}
                    </span>
                    <span className="hidden kicker text-ink-faint sm:inline">
                      {PLATFORM_LABELS[item.platform] ?? item.platform}
                    </span>
                    <span className="text-[11.5px] text-ink-faint">
                      {formatDateTime(item.publishedAt)}
                    </span>
                    <span className={`ml-auto text-[11.5px] font-medium ${tone.className}`}>
                      {tone.label}
                    </span>
                  </div>

                  <p
                    className={`mt-1 text-[14px] leading-snug text-ink group-hover:underline decoration-[var(--rule-strong)] underline-offset-[3px] sm:text-[14.5px] ${
                      isTelugu ? "telugu-text" : ""
                    }`}
                  >
                    {item.headline}
                  </p>

                  {/* Telugu headlines carry their translation inline — an
                      officer should never have to open an item to find out
                      what it says. */}
                  {isTelugu && item.translation && (
                    <p className="mt-1 line-clamp-1 text-[12.5px] text-ink-muted">
                      {item.translation}
                    </p>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-faint">
                    {item.district ? (
                      <span className="font-medium text-ink-muted">{item.district}</span>
                    ) : (
                      <span>No district evidenced</span>
                    )}
                    {item.language && <span>{LANGUAGE_LABELS[item.language]}</span>}
                    {item.topics.length > 0 && (
                      <span className="hidden sm:inline">
                        {item.topics.slice(0, 2).map((t) => t.replace(/-/g, " ")).join(" · ")}
                      </span>
                    )}
                    {item.narrativeTitle && (
                      <span className="hidden truncate text-ink-muted sm:inline">
                        ↳ {item.narrativeTitle}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            </li>
          );
        })}
      </ul>

      {foldable && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 min-h-[44px] w-full rounded-md border border-border-strong bg-surface text-[13.5px] font-medium text-ink-secondary transition-colors hover:text-ink sm:hidden"
        >
          Show all {items.length} items
        </button>
      )}
    </section>
  );
}
