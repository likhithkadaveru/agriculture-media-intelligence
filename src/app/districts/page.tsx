import Link from "next/link";
import { getDb } from "@/db/client";
import { getDistrictOverview, getEnvironmentInfo, type DistrictSignal } from "@/db/queries";
import { SiteHeader } from "@/components/SiteHeader";
import { DISTRICTS } from "@/ontology";
import { formatNumber, percent } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * District intelligence.
 *
 * Phase 3 renders this as a ranked grid of all 33 districts rather than a
 * choropleth: with the current corpus most districts have no evidence, and a
 * map shaded mostly in "no data" communicates less than a list that states
 * it plainly. The geographic surface arrives when the corpus supports it.
 */
export default async function DistrictsPage() {
  const { db } = await getDb();
  const env = await getEnvironmentInfo(db);
  const overview = await getDistrictOverview(db, env.activeOrigin);

  const signalByKey = new Map(overview.districts.map((d) => [d.key, d]));
  const maxCount = Math.max(1, ...overview.districts.map((d) => d.mentionCount));

  const withSignal = DISTRICTS.map((d) => ({
    ontology: d,
    signal: signalByKey.get(d.id) ?? null,
  }));
  const active = withSignal.filter((d) => d.signal !== null);
  const quiet = withSignal.filter((d) => d.signal === null);

  return (
    <div className="min-h-screen">
      <SiteHeader
        activeOrigin={env.activeOrigin}
        lastGeneratedAt={env.lastGeneratedAt}
        current="/districts"
      />

      <main className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border py-6">
          <div>
            <div className="kicker text-emerging">Districts</div>
            <h1 className="headline-serif mt-1 text-[28px] text-ink">
              Where in the state is the conversation?
            </h1>
          </div>
          <p className="text-[13px] text-ink-muted">
            {active.length} of {DISTRICTS.length} districts with evidence ·{" "}
            {formatNumber(overview.locatedCount)} located items
          </p>
        </div>

        {active.length > 0 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {active.map(({ ontology, signal }) => (
              <DistrictCard
                key={ontology.id}
                name={ontology.en}
                nameTe={ontology.te ?? null}
                signal={signal!}
                max={maxCount}
              />
            ))}
          </div>
        ) : (
          <p className="mt-14 text-center text-[14px] text-ink-muted">
            No district-level evidence in the current corpus.
          </p>
        )}

        {/* Honesty about coverage is part of the product, not a caveat. */}
        <section className="mt-12 rounded-lg border border-border bg-surface-2 p-6">
          <h2 className="kicker text-ink-faint">Coverage, stated plainly</h2>
          <div className="mt-3 grid gap-6 sm:grid-cols-3">
            <div>
              <div className="metric-number text-[26px] text-ink">
                {formatNumber(overview.unlocatedCount)}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                items whose location could not be evidenced — left unassigned rather than
                distributed across districts to fill the map
              </p>
            </div>
            <div>
              <div className="metric-number text-[26px] text-ink">{quiet.length}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                districts with no evidence in this collection window. Silence here means no
                collected item named them, not that nothing is happening
              </p>
            </div>
            <div>
              <div className="metric-number text-[26px] text-ink">{DISTRICTS.length}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                districts in the ontology, each with Telugu name, spelling variants and
                disambiguation rules
              </p>
            </div>
          </div>
          {quiet.length > 0 && (
            <p className="mt-4 border-t border-border pt-3 text-[12px] leading-relaxed text-ink-faint">
              No evidence yet:{" "}
              {quiet.map((d) => d.ontology.en).join(", ")}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function DistrictCard({
  name,
  nameTe,
  signal,
  max,
}: {
  name: string;
  nameTe: string | null;
  signal: DistrictSignal;
  max: number;
}) {
  const share = signal.mentionCount / max;
  const topTopic = signal.topics[0];

  return (
    <article className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-border-strong">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="headline-serif text-[19px] text-ink">{name}</h2>
          {nameTe && <p className="telugu-text text-[13px] text-ink-muted">{nameTe}</p>}
        </div>
        <div className="text-right">
          <div className="metric-number text-[22px] text-ink">{signal.mentionCount}</div>
          <div className="kicker text-ink-faint">items</div>
        </div>
      </div>

      {/* Volume relative to the busiest district, as a bar rather than a rank. */}
      <div className="mt-3 h-[6px] overflow-hidden rounded-[3px] bg-surface-3">
        <div
          className="h-full rounded-[3px] bg-[var(--viz-1)]"
          style={{ width: `${Math.max(6, share * 100)}%` }}
        />
      </div>

      <dl className="mt-4 space-y-1.5 text-[12.5px]">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Independent voices</dt>
          <dd className="text-ink-secondary">{signal.voices}</dd>
        </div>
        {topTopic && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Leading issue</dt>
            <dd className="text-ink-secondary">{topTopic.topic.replace(/-/g, " ")}</dd>
          </div>
        )}
        {signal.criticalShare > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Critical stance</dt>
            <dd className="text-critical">{percent(signal.criticalShare)}</dd>
          </div>
        )}
      </dl>

      {signal.narratives.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="kicker text-ink-faint">Narratives here</div>
          <ul className="mt-1.5 space-y-1">
            {signal.narratives.slice(0, 3).map((n) => (
              <li key={n.id}>
                <Link
                  href={`/narratives/${n.id}`}
                  className="text-[12.5px] text-ink-secondary hover:text-emerging"
                >
                  {n.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
