import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getEnvironmentInfo, getFindingDetail } from "@/db/queries";
import type { FindingComponents } from "@/intelligence/findings/stage";
import { SiteHeader } from "@/components/SiteHeader";
import { CategoryKicker, ConfidenceMeter } from "@/components/badges";
import { EvidenceCard } from "@/components/EvidenceCard";
import { MixBar } from "@/components/viz";
import {
  PLATFORM_LABELS,
  VOICE_CLASSES,
  formatDateTime,
  groupVoiceMix,
  percent,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FindingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { db } = await getDb();
  const [env, detail] = await Promise.all([getEnvironmentInfo(db), getFindingDetail(db, id)]);
  if (!detail) notFound();

  const { finding, narrative, evidence } = detail;
  const c = finding.components as FindingComponents;
  const grouped = groupVoiceMix(narrative.voiceMix);
  const voiceSegments = VOICE_CLASSES.map((vc) => ({
    label: vc.label,
    value: grouped[vc.key],
    color: vc.cssVar,
  }));
  const sourceSegments = Object.entries(narrative.sourceMix).map(([platform, value], i) => ({
    label: PLATFORM_LABELS[platform] ?? platform,
    value,
    color: [`var(--viz-1)`, `var(--viz-2)`, `var(--viz-3)`, `var(--viz-4)`, `var(--viz-other)`][
      i % 5
    ],
  }));

  const officialStances = narrative.stanceByVoice["official"] ?? {};
  const publicStances = narrative.stanceByVoice["public"] ?? {};
  const mediaStances = narrative.stanceByVoice["media"] ?? {};

  return (
    <div className="min-h-screen">
      <SiteHeader activeOrigin={env.activeOrigin} lastGeneratedAt={finding.generatedAt} />

      <main className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6 sm:pb-24">
        <nav className="sm:py-5">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center text-[13px] text-ink-muted hover:text-ink sm:min-h-0"
          >
            ← Now
          </Link>
        </nav>

        {/* Finding header */}
        <header className="border-b border-border pb-6 sm:pb-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <CategoryKicker category={finding.category} />
            {c.divergenceObserved && (
              <span className="kicker text-critical">Official ↔ public divergence</span>
            )}
            <span className="w-full sm:ml-auto sm:w-auto">
              <ConfidenceMeter value={finding.confidence} label="Finding confidence" />
            </span>
          </div>
          <h1 className="headline-serif mt-3 max-w-[26ch] text-[clamp(24px,6.6vw,38px)] text-ink">
            {finding.headline}
          </h1>
          <p className="mt-3 max-w-[75ch] text-[15px] text-ink-secondary sm:mt-4 sm:text-[16px]">{finding.summary}</p>
          {finding.whyItMatters && (
            <p className="mt-4 max-w-[75ch] border-l-2 border-emerging pl-3 text-[14px] text-ink-secondary sm:pl-4 sm:text-[14.5px]">
              <span className="kicker mr-2 text-emerging">Why it matters</span>
              {finding.whyItMatters}
            </p>
          )}
        </header>

        <div className="mt-7 grid gap-8 sm:mt-8 lg:grid-cols-[1fr_360px] lg:gap-10">
          {/* MAIN column: evidence */}
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="headline-serif text-[20px] text-ink sm:text-[22px]">Evidence</h2>
              <span className="text-[12.5px] text-ink-muted">
                {evidence.length} canonical items
                {c.duplicatesExcluded > 0 &&
                  ` · ${c.duplicatesExcluded} duplicates shown but not counted`}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-ink-muted">
              Every conclusion above traces to the items below. Source content is shown verbatim;
              AI interpretation is labelled and collapsible.
            </p>
            <div className="mt-5 space-y-4">
              {evidence.map((item) => (
                <EvidenceCard key={item.mention.id} item={item} />
              ))}
            </div>
          </section>

          {/* SIDE column: narrative intelligence */}
          <aside className="space-y-6 lg:border-l lg:border-border lg:pl-8">
            <div>
              <h3 className="kicker text-ink-faint">Narrative</h3>
              <p className="headline-serif mt-1 text-[19px] text-ink">{narrative.title}</p>
              {narrative.executiveSummary && (
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
                  {narrative.executiveSummary}
                </p>
              )}
              <dl className="mt-3 space-y-1 text-[12.5px] text-ink-muted">
                <div className="flex justify-between">
                  <dt>First detected</dt>
                  <dd>{formatDateTime(narrative.firstDetectedAt)} IST</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Most recent evidence</dt>
                  <dd>{formatDateTime(narrative.lastDetectedAt)} IST</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Narrative confidence</dt>
                  <dd>{narrative.confidence != null ? percent(narrative.confidence) : "—"}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="kicker text-ink-faint">Voice composition</h3>
              <div className="mt-2">
                <MixBar segments={voiceSegments} ariaLabel="Voice composition" />
              </div>
            </div>

            <div>
              <h3 className="kicker text-ink-faint">Source composition</h3>
              <div className="mt-2">
                <MixBar segments={sourceSegments} ariaLabel="Source composition" />
              </div>
            </div>

            <div>
              <h3 className="kicker text-ink-faint">Districts with evidence</h3>
              <ul className="mt-2 space-y-1 text-[13px] text-ink-secondary">
                {Object.entries(narrative.districts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([district, count]) => (
                    <li key={district} className="flex justify-between">
                      <span>{district}</span>
                      <span className="text-ink-faint">{count} items</span>
                    </li>
                  ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-ink-faint">
                Only items with in-text location evidence are assigned a district.
              </p>
            </div>

            {c.divergenceObserved && (
              <div className="rounded-lg border border-[rgba(224,120,86,0.35)] bg-[rgba(224,120,86,0.06)] p-4">
                <h3 className="kicker text-critical">Stance by voice</h3>
                <dl className="mt-2 space-y-2 text-[12.5px]">
                  <StanceRow label="Official" stances={officialStances} />
                  <StanceRow label="Media" stances={mediaStances} />
                  <StanceRow label="Public / farmers" stances={publicStances} />
                </dl>
                <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">
                  Divergence is computed from these counts — official voices lean supportive of the
                  government position while a majority of public voices are critical. No opaque
                  score is involved.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-border bg-surface-2 p-4">
              <h3 className="kicker text-ink-faint">Why this finding exists</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{finding.reason}</p>
              <p className="mt-2 text-[11.5px] text-ink-faint">
                Generated {formatDateTime(finding.generatedAt)} IST · data origin:{" "}
                <span className={finding.dataOrigin === "demo_seed" ? "text-emerging" : ""}>
                  {finding.dataOrigin}
                </span>
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function StanceRow({ label, stances }: { label: string; stances: Record<string, number> }) {
  const entries = Object.entries(stances);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="text-right text-ink-muted">
        {entries.length === 0
          ? "no stance-carrying items"
          : entries.map(([stance, count]) => `${stance} ${count}`).join(" · ")}
      </dd>
    </div>
  );
}
