import Link from "next/link";
import { getDb } from "@/db/client";
import { getEnvironmentInfo, getMorningBrief, type BriefItem } from "@/db/queries";
import { SiteHeader } from "@/components/SiteHeader";
import { getSeasonContext } from "@/ontology/calendar";
import { formatDateTime, formatFullDate, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const KIND = {
  attention: { label: "Needs attention", className: "text-critical" },
  escalating: { label: "Escalating", className: "text-emerging" },
  watch: { label: "Watch", className: "text-ink-muted" },
  positive: { label: "Going well", className: "text-positive" },
} as const;

function BriefLine({ item, index }: { item: BriefItem; index: number }) {
  const kind = KIND[item.kind];
  const href = item.findingId
    ? `/findings/${item.findingId}`
    : `/narratives/${item.narrativeId}`;
  return (
    <li className="border-t border-border py-5 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-4">
        <span className="metric-number mt-0.5 w-6 shrink-0 text-[19px] text-ink-faint">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <span className={`kicker ${kind.className}`}>{kind.label}</span>
          <h2 className="headline-serif mt-1.5 text-[21px] text-ink">
            <Link href={href} className="decoration-ink-faint underline-offset-4 hover:underline">
              {item.headline}
            </Link>
          </h2>
          <p className="mt-1.5 max-w-[70ch] text-[14px] leading-relaxed text-ink-secondary">
            {item.line}
          </p>
          {item.seasonalReason && (
            <p className="mt-2 border-l-2 border-emerging pl-3 text-[13px] leading-relaxed text-ink-secondary">
              <span className="kicker mr-2 text-emerging">Season</span>
              {item.seasonalReason}
            </p>
          )}
          <p className="mt-2 text-[12px] text-ink-faint">
            {item.voices} independent {item.voices === 1 ? "voice" : "voices"}
            {item.districts.length > 0 && ` · ${item.districts.join(", ")}`}
          </p>
        </div>
      </div>
    </li>
  );
}

export default async function BriefPage() {
  const { db } = await getDb();
  const env = await getEnvironmentInfo(db);
  const brief = await getMorningBrief(db, env.activeOrigin);
  const season = getSeasonContext();

  return (
    <div className="min-h-screen">
      <SiteHeader
        activeOrigin={env.activeOrigin}
        lastGeneratedAt={brief.generatedAt}
        current="/brief"
      />

      {/* Narrow measure: this page is written to be read on a phone, in a car,
          in under two minutes. */}
      <main className="mx-auto max-w-[760px] px-6 pb-24">
        <header className="border-b border-border py-7">
          <div className="kicker text-emerging">Morning brief</div>
          <h1 className="headline-serif mt-1.5 text-[30px] text-ink">
            {formatFullDate(new Date())}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
            {brief.items.length === 0 && brief.positives.length === 0
              ? "Nothing has crossed a reporting threshold since the last collection."
              : `${brief.items.length} ${brief.items.length === 1 ? "item" : "items"} for attention today, drawn from ${formatNumber(brief.totals.items)} public items across ${brief.totals.narratives} tracked ${brief.totals.narratives === 1 ? "conversation" : "conversations"}.`}
          </p>

          {(season.active.length > 0 || season.approaching.length > 0) && (
            <div className="mt-4 rounded-md border border-border bg-surface-2 px-4 py-3">
              <div className="kicker text-ink-faint">Where the season stands</div>
              <p className="mt-1 text-[13.5px] text-ink-secondary">
                {season.active.length > 0
                  ? season.active.map((w) => w.label).join(" · ")
                  : "Between windows"}
                {season.approaching.length > 0 && (
                  <span className="text-ink-muted">
                    {" — "}
                    {season.approaching[0].window.label} opens in{" "}
                    {season.approaching[0].inDays} days
                  </span>
                )}
              </p>
            </div>
          )}
        </header>

        {brief.items.length > 0 && (
          <ol className="mt-7">
            {brief.items.map((item, i) => (
              <BriefLine key={item.narrativeId} item={item} index={i} />
            ))}
          </ol>
        )}

        {brief.positives.length > 0 && (
          <section className="mt-10 rounded-lg border border-[rgba(111,191,142,0.28)] bg-[rgba(111,191,142,0.05)] p-6">
            <h2 className="kicker text-positive">Going well</h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Positive public reception, with the same evidence standard as everything else.
            </p>
            <ul className="mt-4 space-y-4">
              {brief.positives.map((item) => (
                <li key={item.narrativeId}>
                  <h3 className="headline-serif text-[17px] text-ink">
                    <Link
                      href={
                        item.findingId
                          ? `/findings/${item.findingId}`
                          : `/narratives/${item.narrativeId}`
                      }
                      className="decoration-ink-faint underline-offset-4 hover:underline"
                    >
                      {item.headline}
                    </Link>
                  </h3>
                  <p className="mt-1 text-[13.5px] text-ink-secondary">{item.line}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {brief.items.length === 0 && brief.positives.length === 0 && (
          <div className="mt-14 text-center text-ink-muted">
            <p className="headline-serif text-[20px]">No items today.</p>
            <p className="mt-2 text-[13.5px]">
              Run <code>npm run pipeline</code> to collect and analyse the latest public content.
            </p>
          </div>
        )}

        <p className="mt-12 border-t border-border pt-5 text-[12px] leading-relaxed text-ink-faint">
          Assembled from findings already computed by the pipeline — nothing here is generated
          fresh for the brief. Every line opens the full evidence behind it. Prepared{" "}
          {formatDateTime(brief.generatedAt)} IST.
        </p>
      </main>
    </div>
  );
}
