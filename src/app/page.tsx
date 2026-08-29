import Link from "next/link";
import { getDb } from "@/db/client";
import {
  getActiveFindings,
  getEnvironmentInfo,
  getMediaItems,
  type FindingWithNarrative,
} from "@/db/queries";
import type { FindingComponents } from "@/intelligence/findings/stage";
import { SiteHeader } from "@/components/SiteHeader";
import { CategoryKicker, ConfidenceMeter } from "@/components/badges";
import { MixBar } from "@/components/viz";
import { MediaCarousel } from "@/components/MediaCarousel";
import {
  VOICE_CLASSES,
  formatFullDate,
  formatNumber,
  groupVoiceMix,
  percent,
} from "@/lib/format";

export const dynamic = "force-dynamic";

function voiceSegments(voiceMix: Record<string, number>) {
  const grouped = groupVoiceMix(voiceMix);
  return VOICE_CLASSES.map((vc) => ({
    label: vc.label,
    value: grouped[vc.key],
    color: vc.cssVar,
  }));
}

function FindingCard({ item, hero }: { item: FindingWithNarrative; hero: boolean }) {
  const { finding, narrative, evidenceCount } = item;
  const c = finding.components as FindingComponents;
  return (
    <article
      className={`rounded-lg border border-border bg-surface ${
        hero ? "p-8" : "p-6"
      } transition-colors hover:border-border-strong`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <CategoryKicker category={finding.category} />
        {c.divergenceObserved && (
          <span className="kicker text-critical">Official ↔ public divergence</span>
        )}
        <span className="ml-auto">
          <ConfidenceMeter value={finding.confidence} label="Finding confidence" />
        </span>
      </div>

      <h2
        className={`headline-serif mt-3 text-ink ${hero ? "text-[34px]" : "text-[22px]"}`}
      >
        <Link href={`/findings/${finding.id}`} className="hover:underline decoration-ink-faint underline-offset-4">
          {finding.headline}
        </Link>
      </h2>

      <p className={`mt-3 max-w-[70ch] text-ink-secondary ${hero ? "text-[16px]" : "text-[14.5px]"}`}>
        {finding.summary}
      </p>

      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        <Metric label="Independent voices" value={String(c.independentVoices)} />
        <Metric
          label="Districts"
          value={String(c.districtCount)}
          detail={c.districts.join(", ") || undefined}
        />
        <Metric label="Source types" value={String(c.sourceTypeCount)} />
        {c.farmerOriginatedShare > 0 && (
          <Metric label="Farmer-originated" value={percent(c.farmerOriginatedShare)} />
        )}
        {c.duplicatesExcluded > 0 && (
          <Metric label="Duplicates excluded" value={String(c.duplicatesExcluded)} />
        )}
      </dl>

      <div className="mt-5 max-w-[520px]">
        <MixBar
          segments={voiceSegments(narrative.voiceMix)}
          ariaLabel="Voice composition of this narrative"
        />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <Link
          href={`/findings/${finding.id}`}
          className="text-[13.5px] font-medium text-ink hover:text-emerging"
        >
          View evidence · {evidenceCount} items →
        </Link>
      </div>
    </article>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <dt className="kicker text-ink-faint">{label}</dt>
      <dd className="metric-number mt-0.5 text-[22px] text-ink">
        {value}
        {detail && (
          <span className="ml-2 font-sans text-[12px] font-normal tracking-normal text-ink-muted">
            {detail}
          </span>
        )}
      </dd>
    </div>
  );
}

export default async function NowPage() {
  const { db } = await getDb();
  const env = await getEnvironmentInfo(db);
  const [findings, media] = await Promise.all([
    getActiveFindings(db, env.activeOrigin),
    getMediaItems(db, env.activeOrigin),
  ]);
  const [hero, ...rest] = findings;

  return (
    <div className="min-h-screen">
      <SiteHeader activeOrigin={env.activeOrigin} lastGeneratedAt={env.lastGeneratedAt} current="/" />

      <main className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border py-6">
          <div>
            <div className="kicker text-emerging">Now</div>
            <h1 className="headline-serif mt-1 text-[28px] text-ink">
              {formatFullDate(new Date())}
            </h1>
          </div>
          <p className="text-[13px] text-ink-muted">
            {formatNumber(env.relevantMentions)} relevant public items ·{" "}
            {formatNumber(env.narrativeCount)} narratives tracked ·{" "}
            {formatNumber(env.activeFindingCount)} findings for attention
          </p>
        </div>

        {findings.length === 0 ? (
          <div className="mt-16 text-center text-ink-muted">
            <p className="headline-serif text-[22px]">No active findings.</p>
            <p className="mt-2 text-[14px]">
              Run the pipeline to generate intelligence: <code>npm run pipeline</code>
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {hero && <FindingCard item={hero} hero />}
            {rest.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2">
                {rest.map((item) => (
                  <FindingCard key={item.finding.id} item={item} hero={false} />
                ))}
              </div>
            )}
          </div>
        )}

        {media.length > 0 && (
          <div className="mt-14 border-t border-border pt-8">
            <MediaCarousel items={media} />
          </div>
        )}

        <p className="mt-14 max-w-[80ch] text-[12.5px] leading-relaxed text-ink-faint">
          Findings are generated from public evidence by explainable rules: every number above
          traces to underlying items, duplicates are excluded from counts, and each finding page
          shows the exact reason it exists. AI-assisted interpretation is always labelled and
          separated from source content.
        </p>
      </main>
    </div>
  );
}
