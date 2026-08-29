import type { CoverageItem } from "@/db/queries";
import { LANGUAGE_LABELS, PLATFORM_LABELS, formatDateTime } from "@/lib/format";

/**
 * The clippings digest.
 *
 * Written coverage is scanned, not looked at, so it gets a dense list rather
 * than the picture strip. The reading order is what an officer actually asks:
 * who published it, what it says, where, and how it reads — in that order,
 * down a fixed left edge.
 */

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
  if (items.length === 0) return null;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="headline-serif text-[20px] text-ink">Coverage</h2>
        <p className="text-[12.5px] text-ink-muted">
          {items.length} most recent items across press, broadcast and public posts
        </p>
      </div>

      <ul className="mt-4 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
        {items.map((item) => {
          const tone = STANCE[item.stance ?? "neutral"] ?? STANCE.neutral;
          const isTelugu = item.language === "te" || item.language === "mixed";
          return (
            <li key={item.id}>
              <a
                href={item.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-4 py-3.5 transition-colors hover:bg-surface"
              >
                {/* Stance reads as position on a fixed edge before it reads as colour. */}
                <span aria-hidden className={`mt-1 w-[3px] shrink-0 rounded-full ${tone.rule}`} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-[12px] font-semibold text-ink-secondary">
                      {item.outlet ?? "Unknown source"}
                    </span>
                    <span className="kicker text-ink-faint">
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
                    className={`mt-1 text-[14.5px] leading-snug text-ink group-hover:underline decoration-[var(--rule-strong)] underline-offset-[3px] ${
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
                      <span>{item.topics.slice(0, 2).map((t) => t.replace(/-/g, " ")).join(" · ")}</span>
                    )}
                    {item.narrativeTitle && (
                      <span className="truncate text-ink-muted">↳ {item.narrativeTitle}</span>
                    )}
                  </div>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
