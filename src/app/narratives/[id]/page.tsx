import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getEnvironmentInfo, getNarrativeDetail } from "@/db/queries";
import { SiteHeader } from "@/components/SiteHeader";
import { TrendBadge } from "@/components/TrendBadge";
import { AuthorTypeChip, ConfidenceMeter } from "@/components/badges";
import { EvidenceCard } from "@/components/EvidenceCard";
import { MixBar } from "@/components/viz";
import { Timeline } from "@/components/Timeline";
import {
  PLATFORM_LABELS,
  VOICE_CLASSES,
  formatDateTime,
  groupVoiceMix,
  percent,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const STANCE_LABELS: Record<string, string> = {
  critical: "Critical",
  supportive: "Supportive",
  neutral: "Neutral",
  mixed: "Mixed",
};

export default async function NarrativePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db } = await getDb();
  const [env, detail] = await Promise.all([getEnvironmentInfo(db), getNarrativeDetail(db, id)]);
  if (!detail) notFound();

  const { narrative, evidence, claims, timeline, findingId } = detail;
  const grouped = groupVoiceMix(narrative.voiceMix);
  const voiceSegments = VOICE_CLASSES.map((vc) => ({
    label: vc.label,
    value: grouped[vc.key],
    color: vc.cssVar,
  }));
  const sourceSegments = Object.entries(narrative.sourceMix).map(([platform, value], i) => ({
    label: PLATFORM_LABELS[platform] ?? platform,
    value,
    color: ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-other)"][i % 5],
  }));
  const districts = Object.entries(narrative.districts).sort((a, b) => b[1] - a[1]);
  const stanceTotal = Object.values(narrative.stanceSummary).reduce((a, b) => a + b, 0);
  const duplicates = evidence.reduce((sum, item) => sum + item.duplicates.length, 0);
  const unlocated = narrative.mentionCount - districts.reduce((sum, [, c]) => sum + c, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader
        activeOrigin={env.activeOrigin}
        lastGeneratedAt={narrative.updatedAt}
        current="/narratives"
      />

      <main className="mx-auto max-w-[1200px] px-6 pb-24">
        <nav className="flex gap-4 py-5 text-[13px]">
          <Link href="/narratives" className="text-ink-muted hover:text-ink">
            ← Narratives
          </Link>
          {findingId && (
            <Link href={`/findings/${findingId}`} className="text-ink-muted hover:text-ink">
              View as Now finding →
            </Link>
          )}
        </nav>

        <header className="border-b border-border pb-7">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <TrendBadge status={narrative.trendStatus} />
            <span className="kicker text-ink-faint">{narrative.key}</span>
            <span className="ml-auto">
              {narrative.confidence != null && (
                <ConfidenceMeter value={narrative.confidence} label="Narrative confidence" />
              )}
            </span>
          </div>
          <h1 className="headline-serif mt-3 max-w-[26ch] text-[36px] text-ink">
            {narrative.title}
          </h1>

          {/* What is happening — executive synthesis */}
          <div className="mt-5 max-w-[78ch] space-y-3">
            {narrative.explanation && (
              <p className="text-[16px] leading-relaxed text-ink-secondary">
                {narrative.explanation}
                <span className="ml-2 align-middle text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
                  AI synthesis
                </span>
              </p>
            )}
            <p className="text-[14px] leading-relaxed text-ink-muted">
              {narrative.executiveSummary}
            </p>
          </div>
        </header>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
          <section>
            {/* Timeline — how discussion developed */}
            {timeline.length > 1 && (
              <div className="mb-9">
                <h2 className="kicker text-ink-faint">How the discussion developed</h2>
                <div className="mt-3">
                  <Timeline points={timeline} />
                </div>
              </div>
            )}

            {/* Claims */}
            {claims.length > 0 && (
              <div className="mb-9">
                <h2 className="headline-serif text-[20px] text-ink">Claims inside this narrative</h2>
                <p className="mt-1 text-[12.5px] text-ink-muted">
                  Model-extracted assertions from individual items. Each links to the evidence that
                  contains it; none are verified statements of fact.
                </p>
                <ul className="mt-3 space-y-2">
                  {claims.map((claim, i) => (
                    <li
                      key={`${claim.mentionId}-${i}`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-border bg-surface-2 px-4 py-2.5"
                    >
                      <span className="text-[13.5px] text-ink-secondary">“{claim.claim}”</span>
                      <span className="ml-auto flex items-center gap-2">
                        <AuthorTypeChip authorType={claim.authorType} />
                        {claim.confidence != null && (
                          <span className="text-[11.5px] text-ink-faint">
                            {percent(claim.confidence)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Evidence */}
            <div className="flex items-baseline justify-between">
              <h2 className="headline-serif text-[20px] text-ink">Evidence</h2>
              <span className="text-[12.5px] text-ink-muted">
                {narrative.mentionCount} canonical items
                {duplicates > 0 && ` · ${duplicates} duplicates shown, not counted`}
              </span>
            </div>
            <div className="mt-4 space-y-4">
              {evidence.map((item) => (
                <EvidenceCard key={item.mention.id} item={item} />
              ))}
            </div>
          </section>

          <aside className="space-y-6 lg:border-l lg:border-border lg:pl-8">
            <div>
              <h3 className="kicker text-ink-faint">Who is talking</h3>
              <div className="mt-2">
                <MixBar segments={voiceSegments} ariaLabel="Voice composition" />
              </div>
              <p className="mt-2 text-[11.5px] text-ink-faint">
                {narrative.uniqueAuthorCount} independent authors
              </p>
            </div>

            <div>
              <h3 className="kicker text-ink-faint">Sources</h3>
              <div className="mt-2">
                <MixBar segments={sourceSegments} ariaLabel="Source composition" />
              </div>
            </div>

            <div>
              <h3 className="kicker text-ink-faint">Where</h3>
              {districts.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[13px] text-ink-secondary">
                  {districts.map(([district, count]) => (
                    <li key={district} className="flex justify-between">
                      <span>{district}</span>
                      <span className="text-ink-faint">{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] text-ink-muted">No district evidenced.</p>
              )}
              {unlocated > 0 && (
                <p className="mt-2 text-[11.5px] text-ink-faint">
                  {unlocated} item{unlocated > 1 ? "s" : ""} with no location evidence — left
                  unassigned rather than guessed.
                </p>
              )}
            </div>

            <div>
              <h3 className="kicker text-ink-faint">How it is framed</h3>
              {stanceTotal > 0 ? (
                <ul className="mt-2 space-y-1 text-[13px] text-ink-secondary">
                  {Object.entries(narrative.stanceSummary)
                    .sort((a, b) => b[1] - a[1])
                    .map(([stance, count]) => (
                      <li key={stance} className="flex justify-between">
                        <span>{STANCE_LABELS[stance] ?? stance}</span>
                        <span className="text-ink-faint">
                          {count} · {percent(count / stanceTotal)}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] text-ink-muted">No stance recorded.</p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface-2 p-4">
              <h3 className="kicker text-ink-faint">Observation window</h3>
              <dl className="mt-2 space-y-1 text-[12.5px] text-ink-muted">
                <div className="flex justify-between gap-3">
                  <dt>First seen</dt>
                  <dd>{formatDateTime(narrative.firstDetectedAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Latest evidence</dt>
                  <dd>{formatDateTime(narrative.lastDetectedAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Snapshots recorded</dt>
                  <dd>{detail.snapshots.length}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
                Trend status is computed from the observation window only. Historical baselines
                accumulate with each pipeline run.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
