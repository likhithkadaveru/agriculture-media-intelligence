"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/db/queries";
import {
  AUTHOR_TYPE_LABELS,
  LANGUAGE_LABELS,
  formatDateTime,
  formatNumber,
  percent,
} from "@/lib/format";

/**
 * Collected media strip — the public content the intelligence is built from,
 * shown as it actually appears: real thumbnails, original-language titles,
 * the channel that published it, and where it landed in the analysis.
 *
 * Scroll-snap carriage with keyboard, drag and arrow control. Each card
 * opens the original source, so the strip doubles as a way into the raw
 * evidence rather than being decoration.
 */
export function MediaCarousel({ items }: { items: MediaItem[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const page = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll("li"));
    if (cards.length === 0) return;

    /*
     * Scroll to a specific card rather than by a pixel delta: scroll
     * snapping pulls a `scrollBy` back toward the nearest snap point, so
     * paging by distance can land back where it started. Picking the target
     * card and scrolling its offset works with the snap instead of against it.
     */
    const step = cards[0].offsetWidth + 16;
    const perPage = Math.max(1, Math.floor(el.clientWidth / step));
    const current = Math.round(el.scrollLeft / step);
    const target = Math.min(
      cards.length - 1,
      Math.max(0, current + direction * perPage),
    );
    // Refresh the arrow state directly: scroll events are not guaranteed
    // to reach us for a programmatic scroll in every environment.
    glide(el, cards[target].offsetLeft - el.offsetLeft, sync);
  };

  if (items.length === 0) return null;

  return (
    <section aria-label="Collected media">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="kicker text-emerging">Collected media</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            The public content behind today&apos;s intelligence — {items.length} items, newest
            first. Every card opens its original source.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => page(-1)}
            disabled={atStart}
            aria-label="Scroll media left"
            className="h-8 w-9 rounded border border-border-strong bg-surface-2 text-ink-muted transition-colors hover:border-emerging hover:text-emerging disabled:opacity-30 disabled:hover:border-border-strong disabled:hover:text-ink-muted"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => page(1)}
            disabled={atEnd}
            aria-label="Scroll media right"
            className="h-8 w-9 rounded border border-border-strong bg-surface-2 text-ink-muted transition-colors hover:border-emerging hover:text-emerging disabled:opacity-30 disabled:hover:border-border-strong disabled:hover:text-ink-muted"
          >
            ›
          </button>
        </div>
      </div>

      <ul
        ref={trackRef}
        tabIndex={0}
        aria-label="Collected media items"
        className="media-track mt-4 flex snap-x snap-proximity gap-4 overflow-x-auto pb-2"
      >
        {items.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Animate horizontal scroll ourselves rather than relying on
 * `behavior: "smooth"`, which some engines silently ignore.
 *
 * Two guards, both from observed behaviour: requestAnimationFrame does not
 * fire while a document is considered hidden (embedded webviews report this
 * even when visible to the user), so the tween is backed by a timer that
 * puts the track at its destination regardless. A reduced-motion preference
 * skips the animation entirely.
 */
function glide(el: HTMLElement, to: number, onDone?: () => void) {
  const from = el.scrollLeft;
  const distance = to - from;
  if (distance === 0) return;

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animatable =
    !reduced && typeof requestAnimationFrame === "function" && !document.hidden;

  if (!animatable) {
    el.scrollLeft = to;
    onDone?.();
    return;
  }

  const duration = 420;
  const start = performance.now();
  let settled = false;

  const tick = (now: number) => {
    if (settled) return;
    const t = Math.min(1, (now - start) / duration);
    // easeOutCubic — quick departure, soft landing.
    el.scrollLeft = from + distance * (1 - Math.pow(1 - t, 3));
    if (t < 1) requestAnimationFrame(tick);
    else {
      settled = true;
      onDone?.();
    }
  };
  requestAnimationFrame(tick);

  // Backstop: if the tween never ran (throttled frames, backgrounded tab),
  // land on the destination so the control is never a no-op.
  window.setTimeout(() => {
    if (settled) return;
    settled = true;
    el.scrollLeft = to;
    onDone?.();
  }, duration + 90);
}

function MediaCard({ item }: { item: MediaItem }) {
  const isTelugu = item.language === "te" || item.language === "mixed";
  const views = item.engagement?.views;
  const likes = item.engagement?.likes;

  return (
    <li className="w-[290px] flex-none snap-start">
      <a
        href={item.url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-border-strong focus-visible:border-emerging focus-visible:outline-none"
      >
        <div className="relative aspect-video overflow-hidden bg-surface-3">
          {item.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}
          {/* Grounds the thumbnail in the page's palette rather than letting
              broadcast graphics dictate the strip's colour. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(13,18,16,0.86)] via-[rgba(13,18,16,0.12)] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-2.5">
            {item.district ? (
              <span className="rounded-[3px] bg-[rgba(13,18,16,0.78)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-emerging">
                {item.district}
                {item.locationConfidence != null && (
                  <span className="ml-1 font-normal tracking-normal text-ink-muted">
                    {percent(item.locationConfidence)}
                  </span>
                )}
              </span>
            ) : (
              <span className="rounded-[3px] bg-[rgba(13,18,16,0.78)] px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-faint">
                District not evidenced
              </span>
            )}
            {(views != null || likes != null) && (
              <span className="ml-auto rounded-[3px] bg-[rgba(13,18,16,0.78)] px-1.5 py-0.5 text-[10.5px] tabular-nums text-ink-muted">
                {views != null ? `${formatNumber(views)} views` : `${formatNumber(likes!)} likes`}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-3.5">
          <p
            className={`line-clamp-3 text-[13.5px] font-medium leading-snug text-ink ${
              isTelugu ? "telugu-text" : ""
            }`}
          >
            {item.title ?? "Untitled"}
          </p>

          {isTelugu && item.englishTranslation && (
            <p className="line-clamp-2 border-l border-border-strong pl-2 text-[11.5px] leading-snug text-ink-muted">
              {item.englishTranslation}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-muted">
            <span className="text-ink-secondary">{item.channel ?? "Unknown channel"}</span>
            <span className="text-ink-faint">·</span>
            <span>{AUTHOR_TYPE_LABELS[item.authorType] ?? item.authorType}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
            <span>{formatDateTime(item.publishedAt)}</span>
            {item.language && (
              <>
                <span>·</span>
                <span>{LANGUAGE_LABELS[item.language]}</span>
              </>
            )}
          </div>

          {item.narrativeTitle && (
            <p className="border-t border-border pt-2 text-[11px] leading-snug text-ink-muted">
              <span className="kicker text-ink-faint">In narrative</span>{" "}
              <span className="text-ink-secondary">{item.narrativeTitle}</span>
            </p>
          )}
        </div>
      </a>
    </li>
  );
}
