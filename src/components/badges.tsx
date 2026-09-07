import { AUTHOR_TYPE_LABELS, PLATFORM_LABELS, percent } from "@/lib/format";

export function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className="kicker inline-flex items-center rounded-[3px] border border-border-strong px-1.5 py-0.5 text-ink-secondary">
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}

/**
 * Whether a video was airing when it was collected.
 *
 * "Was live" is shown rather than hidden: a finished telecast is the one
 * case where a missing transcript is temporary, since captions usually
 * appear after a stream stops. Ordinary uploads render nothing at all —
 * a badge on every card would carry no information.
 */
export function BroadcastChip({ status }: { status: string | null }) {
  if (status === "live") {
    return (
      <span className="kicker inline-flex items-center gap-1 rounded-[3px] border border-critical px-1.5 py-0.5 font-medium text-critical">
        <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-critical" />
        Live now
      </span>
    );
  }
  if (status === "upcoming") {
    return (
      <span className="kicker inline-flex items-center rounded-[3px] border border-border-strong px-1.5 py-0.5 text-ink-secondary">
        Scheduled
      </span>
    );
  }
  if (status === "ended") {
    return (
      <span className="kicker inline-flex items-center rounded-[3px] border border-border px-1.5 py-0.5 text-ink-faint">
        Was live
      </span>
    );
  }
  return null;
}

/**
 * What is physically happening, when something is.
 *
 * Only the three that warrant interrupting someone are coloured; a meeting or
 * a launch is shown plainly. Colouring every event would make the red mean
 * "an event" rather than "go and look at this".
 */
const URGENT_EVENTS = new Set(["protest", "rally", "disaster"]);

export function EventChip({ event }: { event: string | null }) {
  if (!event) return null;
  const urgent = URGENT_EVENTS.has(event);
  return (
    <span
      className={`kicker inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 ${
        urgent
          ? "border-critical bg-[var(--critical-soft)] font-semibold text-critical"
          : "border-border text-ink-faint"
      }`}
    >
      {urgent && <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-critical" />}
      {event}
    </span>
  );
}

export function CategoryKicker({ category }: { category: string }) {
  const styles: Record<string, { label: string; className: string }> = {
    emerging: { label: "Emerging signal", className: "text-emerging" },
    watch: { label: "Watch", className: "text-watch" },
    divergence: { label: "Narrative divergence", className: "text-critical" },
    influence: { label: "Influence", className: "text-ink-secondary" },
    geographic: { label: "Geographic", className: "text-ink-secondary" },
  };
  const s = styles[category] ?? { label: category, className: "text-ink-secondary" };
  return <span className={`kicker ${s.className}`}>{s.label}</span>;
}

export function AuthorTypeChip({
  authorType,
  confidence,
}: {
  authorType: string;
  confidence?: number | null;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[3px] bg-surface-3 px-1.5 py-0.5 text-[11.5px] font-medium text-ink-secondary">
      {AUTHOR_TYPE_LABELS[authorType] ?? authorType}
      {confidence != null && (
        <span className="text-ink-faint" title="Classification confidence">
          {percent(confidence)}
        </span>
      )}
    </span>
  );
}

export function StanceChip({ stance }: { stance: string | null }) {
  if (!stance) return null;
  const styles: Record<string, string> = {
    critical: "text-critical",
    supportive: "text-positive",
    neutral: "text-ink-muted",
    mixed: "text-ink-secondary",
  };
  return (
    <span className={`text-[11.5px] font-medium ${styles[stance] ?? "text-ink-muted"}`}>
      {stance}
    </span>
  );
}

export function ConfidenceMeter({ value, label }: { value: number; label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] text-ink-muted"
      title={`${label ?? "Confidence"}: ${percent(value)}`}
    >
      <span className="inline-block h-[5px] w-[44px] overflow-hidden rounded-full bg-surface-3">
        <span
          className="block h-full rounded-full bg-ink-muted"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </span>
      {percent(value)}
    </span>
  );
}
