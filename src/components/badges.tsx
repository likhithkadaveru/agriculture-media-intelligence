import { AUTHOR_TYPE_LABELS, PLATFORM_LABELS, percent } from "@/lib/format";

export function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className="kicker inline-flex items-center rounded-[3px] border border-border-strong px-1.5 py-0.5 text-ink-secondary">
      {PLATFORM_LABELS[platform] ?? platform}
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
