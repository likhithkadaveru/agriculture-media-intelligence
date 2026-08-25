import Link from "next/link";
import { getDb } from "@/db/client";
import { getEnvironmentInfo, getNarratives, type NarrativeListItem } from "@/db/queries";
import { SiteHeader } from "@/components/SiteHeader";
import { TrendBadge } from "@/components/TrendBadge";
import { ConfidenceMeter } from "@/components/badges";
import { MixBar } from "@/components/viz";
import {
  PLATFORM_LABELS,
  VOICE_CLASSES,
  formatDateTime,
  groupVoiceMix,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const TREND_ORDER: Record<string, number> = {
  emerging: 0,
  rising: 1,
  resurfacing: 2,
  stable: 3,
  falling: 4,
};

function NarrativeCard({ item }: { item: NarrativeListItem }) {
  const { narrative, evidenceCount, findingId } = item;
  const grouped = groupVoiceMix(narrative.voiceMix);
  const voiceSegments = VOICE_CLASSES.map((vc) => ({
    label: vc.label,
    value: grouped[vc.key],
    color: vc.cssVar,
  }));
  const districts = Object.entries(narrative.districts).sort((a, b) => b[1] - a[1]);
  const sources = Object.keys(narrative.sourceMix)
    .map((p) => PLATFORM_LABELS[p] ?? p)
    .join(" · ");
  const duplicates = evidenceCount - narrative.mentionCount;

  return (
    <article className="rounded-lg border border-border bg-surface p-6 transition-colors hover:border-border-strong">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <TrendBadge status={narrative.trendStatus} />
        <span className="ml-auto">
          {narrative.confidence != null && (
            <ConfidenceMeter value={narrative.confidence} label="Narrative confidence" />
          )}
        </span>
      </div>

      <h2 className="headline-serif mt-2.5 text-[21px] text-ink">
        <Link
          href={`/narratives/${narrative.id}`}
          className="decoration-ink-faint underline-offset-4 hover:underline"
        >
          {narrative.title}
        </Link>
      </h2>

      <p className="mt-2 max-w-[75ch] text-[14px] leading-relaxed text-ink-secondary">
        {narrative.explanation ?? narrative.executiveSummary}
      </p>

      <dl className="mt-4 flex flex-wrap gap-x-7 gap-y-3">
        <Stat label="Items" value={String(narrative.mentionCount)} />
        <Stat label="Independent voices" value={String(narrative.uniqueAuthorCount)} />
        <Stat
          label="Districts"
          value={String(districts.length)}
          detail={districts.length > 0 ? districts.map(([d]) => d).join(", ") : "none evidenced"}
        />
        {duplicates > 0 && <Stat label="Duplicates excluded" value={String(duplicates)} />}
      </dl>

      <div className="mt-4 max-w-[440px]">
        <MixBar segments={voiceSegments} ariaLabel="Voice composition" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-[12px] text-ink-faint">
        <span>
          {sources} · first seen {formatDateTime(narrative.firstDetectedAt)} · latest{" "}
          {formatDateTime(narrative.lastDetectedAt)} IST
        </span>
        <span className="flex gap-4">
          {findingId && (
            <Link href={`/findings/${findingId}`} className="font-medium text-ink-muted hover:text-emerging">
              In Now →
            </Link>
          )}
          <Link
            href={`/narratives/${narrative.id}`}
            className="font-medium text-ink hover:text-emerging"
          >
            Open narrative →
          </Link>
        </span>
      </div>
    </article>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <dt className="kicker text-ink-faint">{label}</dt>
      <dd className="metric-number mt-0.5 text-[19px] text-ink">
        {value}
        {detail && (
          <span className="ml-2 font-sans text-[11.5px] font-normal tracking-normal text-ink-muted">
            {detail}
          </span>
        )}
      </dd>
    </div>
  );
}

export default async function NarrativesPage() {
  const { db } = await getDb();
  const env = await getEnvironmentInfo(db);
  const narratives = await getNarratives(db, env.activeOrigin);

  const sorted = [...narratives].sort((a, b) => {
    const ta = TREND_ORDER[a.narrative.trendStatus ?? "stable"] ?? 3;
    const tb = TREND_ORDER[b.narrative.trendStatus ?? "stable"] ?? 3;
    if (ta !== tb) return ta - tb;
    return b.narrative.mentionCount - a.narrative.mentionCount;
  });

  return (
    <div className="min-h-screen">
      <SiteHeader
        activeOrigin={env.activeOrigin}
        lastGeneratedAt={env.lastGeneratedAt}
        current="/narratives"
      />

      <main className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border py-6">
          <div>
            <div className="kicker text-emerging">Narratives</div>
            <h1 className="headline-serif mt-1 text-[28px] text-ink">
              What conversations are shaping Telangana agriculture?
            </h1>
          </div>
          <p className="text-[13px] text-ink-muted">
            {narratives.length} tracked · ranked by movement, then volume
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className="mt-16 text-center text-ink-muted">
            <p className="headline-serif text-[22px]">No narratives yet.</p>
            <p className="mt-2 text-[14px]">
              Run <code>npm run pipeline</code> to collect and analyse public content.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {sorted.map((item) => (
              <NarrativeCard key={item.narrative.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
