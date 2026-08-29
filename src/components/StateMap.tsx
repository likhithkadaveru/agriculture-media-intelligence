import Link from "next/link";

import { DISTRICT_SHAPES, MAP_HEIGHT, MAP_WIDTH } from "@/ontology/geo";
import { DISTRICTS } from "@/ontology";
import { formatNumber, percent } from "@/lib/format";

/**
 * Telangana coverage map — real district boundaries, shaded by the balance of
 * coverage rather than by volume.
 *
 * The scale is diverging because the question is directional: is what is
 * being said about this district favourable or unfavourable? A sequential
 * ramp would answer "how loud", which is a different and less useful
 * question for an officer scanning the state.
 *
 * A district with no collected evidence is drawn in the neutral paper tone
 * and reported as such. It is never shaded to imply a reading the data does
 * not support.
 */

export interface CoverageDistrict {
  id: string;
  name: string;
  nameTe: string | null;
  total: number;
  favourable: number;
  unfavourable: number;
  neutral: number;
  /** −1 (entirely unfavourable) … +1 (entirely favourable). */
  balance: number;
  topTopic: string | null;
  narrativeId: string | null;
}

/** Diverging scale: unfavourable red ← neutral paper → favourable green. */
function shadeFor(d: CoverageDistrict | undefined): string {
  if (!d || d.total === 0) return "var(--surface-2)";
  const t = Math.min(1, Math.abs(d.balance));
  // Step rather than interpolate, so the legend and the map agree exactly.
  const step = t < 0.34 ? 0 : t < 0.67 ? 1 : 2;
  if (step === 0) return "#e8e6df";
  if (d.balance < 0) return ["#e8e6df", "#e5a8a4", "#c2534d"][step];
  return ["#e8e6df", "#9dc9b3", "#2f8158"][step];
}

function labelInk(d: CoverageDistrict | undefined): string {
  if (!d || d.total === 0) return "var(--ink-faint)";
  return Math.abs(d.balance) >= 0.67 ? "#ffffff" : "var(--ink)";
}

export function StateMap({
  coverage,
}: {
  coverage: CoverageDistrict[];
}) {
  const byId = new Map(coverage.map((c) => [c.id, c]));
  const nameById = new Map(DISTRICTS.map((d) => [d.id, d.en]));
  const withEvidence = coverage.filter((c) => c.total > 0);

  const totals = withEvidence.reduce(
    (acc, c) => ({
      favourable: acc.favourable + c.favourable,
      unfavourable: acc.unfavourable + c.unfavourable,
      neutral: acc.neutral + c.neutral,
    }),
    { favourable: 0, unfavourable: 0, neutral: 0 },
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
      <figure className="m-0">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          role="img"
          aria-label="Telangana districts shaded by the balance of favourable and unfavourable coverage"
          className="h-auto w-full"
        >
          <title>Coverage balance by district</title>
          {DISTRICT_SHAPES.map((shape) => {
            const c = byId.get(shape.id);
            const name = nameById.get(shape.id) ?? shape.id;
            const summary =
              c && c.total > 0
                ? `${name}: ${c.total} item${c.total === 1 ? "" : "s"}, ${c.unfavourable} unfavourable, ${c.favourable} favourable`
                : `${name}: no evidence collected`;
            return (
              <path
                key={shape.id}
                d={shape.d}
                className="district-shape"
                fill={shadeFor(c)}
                stroke="var(--rule-strong)"
                strokeWidth={0.8}
                strokeLinejoin="round"
              >
                <title>{summary}</title>
              </path>
            );
          })}
          {/* Only label districts carrying evidence — labelling all 33 at this
              scale produces an unreadable thicket. */}
          {DISTRICT_SHAPES.filter((s) => (byId.get(s.id)?.total ?? 0) > 0).map((shape) => {
            const c = byId.get(shape.id)!;
            return (
              <g key={`l-${shape.id}`} pointerEvents="none">
                <text
                  x={shape.cx}
                  y={shape.cy}
                  textAnchor="middle"
                  className="map-label"
                  fill={labelInk(c)}
                >
                  {nameById.get(shape.id)}
                </text>
                <text
                  x={shape.cx}
                  y={shape.cy + 34}
                  textAnchor="middle"
                  className="map-label-count"
                  fill={labelInk(c)}
                  opacity={0.85}
                >
                  {c.total}
                </text>
              </g>
            );
          })}
        </svg>
      </figure>

      <div className="space-y-6">
        {/* Legend — steps match the shading exactly. */}
        <div>
          <h3 className="kicker text-ink-faint">Coverage balance</h3>
          <div className="mt-2.5 flex items-center gap-1">
            {["#c2534d", "#e5a8a4", "#e8e6df", "#9dc9b3", "#2f8158"].map((c) => (
              <span key={c} className="h-3 flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-ink-muted">
            <span>Unfavourable</span>
            <span>Mixed</span>
            <span>Favourable</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11.5px] text-ink-faint">
            <span
              className="inline-block h-3 w-3 border"
              style={{ background: "var(--surface-2)", borderColor: "var(--rule-strong)" }}
            />
            No evidence collected
          </div>
        </div>

        <dl className="space-y-2 border-t border-border pt-4 text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-muted">Unfavourable items</dt>
            <dd className="metric-number text-[17px] text-critical">
              {formatNumber(totals.unfavourable)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-muted">Favourable items</dt>
            <dd className="metric-number text-[17px] text-positive">
              {formatNumber(totals.favourable)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-muted">Neutral / factual</dt>
            <dd className="metric-number text-[17px] text-ink-secondary">
              {formatNumber(totals.neutral)}
            </dd>
          </div>
        </dl>

        {withEvidence.length > 0 && (
          <div className="border-t border-border pt-4">
            <h3 className="kicker text-ink-faint">Districts with evidence</h3>
            <ul className="mt-2 sm:space-y-1.5">
              {withEvidence
                .slice()
                .sort((a, b) => a.balance - b.balance)
                .map((c) => (
                  <li
                    key={c.id}
                    className="flex min-h-[44px] items-center gap-2 text-[13px] sm:min-h-0 sm:items-baseline sm:text-[12.5px]"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 border sm:mt-[3px]"
                      style={{ background: shadeFor(c), borderColor: "var(--rule-strong)" }}
                    />
                    {c.narrativeId ? (
                      <Link
                        href={`/narratives/${c.narrativeId}`}
                        className="flex items-center self-stretch text-ink-secondary hover:text-seal hover:underline"
                      >
                        {c.name}
                      </Link>
                    ) : (
                      <span className="text-ink-secondary">{c.name}</span>
                    )}
                    <span className="ml-auto tabular-nums text-ink-faint">
                      {c.unfavourable > 0 && (
                        <span className="text-critical">{c.unfavourable}−</span>
                      )}
                      {c.unfavourable > 0 && c.favourable > 0 && " / "}
                      {c.favourable > 0 && <span className="text-positive">{c.favourable}+</span>}
                      {c.unfavourable === 0 && c.favourable === 0 && (
                        <span>{c.total} neutral</span>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** Share of items that are unfavourable, for the summary line. */
export function unfavourableShare(coverage: CoverageDistrict[]): string {
  const total = coverage.reduce((s, c) => s + c.total, 0);
  const bad = coverage.reduce((s, c) => s + c.unfavourable, 0);
  return total === 0 ? "—" : percent(bad / total);
}
