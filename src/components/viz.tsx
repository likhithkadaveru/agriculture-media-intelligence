/**
 * Composition bar — stacked single-row categorical bar with 2px surface gaps
 * and an always-present legend (identity is never color-alone).
 */

export interface MixSegment {
  label: string;
  value: number;
  color: string;
}

export function MixBar({
  segments,
  ariaLabel,
}: {
  segments: MixSegment[];
  ariaLabel: string;
}) {
  const present = segments.filter((s) => s.value > 0);
  const total = present.reduce((a, s) => a + s.value, 0);
  if (total === 0) return null;
  return (
    <div>
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex h-[10px] w-full overflow-hidden rounded-[3px]"
        style={{ gap: "2px" }}
      >
        {present.map((s) => (
          <div
            key={s.label}
            style={{
              width: `${(s.value / total) * 100}%`,
              background: s.color,
              minWidth: "4px",
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {present.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <span
              aria-hidden
              className="inline-block h-[8px] w-[8px] rounded-[2px]"
              style={{ background: s.color }}
            />
            {s.label}
            <span className="text-ink-faint">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
