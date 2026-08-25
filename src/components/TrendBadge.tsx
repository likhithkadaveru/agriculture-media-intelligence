const TRENDS = {
  emerging: { label: "Emerging", className: "text-emerging", glyph: "▲" },
  rising: { label: "Rising", className: "text-emerging", glyph: "↑" },
  stable: { label: "Stable", className: "text-ink-muted", glyph: "→" },
  falling: { label: "Falling", className: "text-ink-faint", glyph: "↓" },
  resurfacing: { label: "Resurfacing", className: "text-[#7fb2f0]", glyph: "↻" },
} as const;

export function TrendBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const trend = TRENDS[status as keyof typeof TRENDS];
  if (!trend) return null;
  return (
    <span className={`kicker inline-flex items-center gap-1.5 ${trend.className}`}>
      <span aria-hidden>{trend.glyph}</span>
      {trend.label}
    </span>
  );
}
