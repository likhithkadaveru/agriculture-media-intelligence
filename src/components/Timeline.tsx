/**
 * Daily evidence timeline — a small column chart with 4px rounded data-ends
 * anchored to the baseline, a single series (so no legend; the heading names
 * it), recessive baseline, and per-bar hover titles.
 */

export function Timeline({ points }: { points: { date: string; count: number }[] }) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.count));

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-end gap-1.5" style={{ height: 96 }}>
        {points.map((point) => {
          const height = Math.max(4, Math.round((point.count / max) * 80));
          const label = new Date(`${point.date}T00:00:00Z`).toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "numeric",
            month: "short",
          });
          return (
            <div key={point.date} className="flex w-[38px] flex-col items-center gap-1.5">
              <span className="metric-number text-[11px] text-ink-muted">{point.count}</span>
              <div
                className="w-full rounded-t-[4px] bg-[var(--viz-1)]"
                style={{ height }}
                title={`${label}: ${point.count} item${point.count === 1 ? "" : "s"}`}
              />
              <span className="text-[10px] whitespace-nowrap text-ink-faint">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
