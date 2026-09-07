import type { EvidenceItem } from "@/db/queries";
import { AuthorTypeChip, BroadcastChip, PlatformBadge, StanceChip } from "@/components/badges";
import {
  LANGUAGE_LABELS,
  formatDateTime,
  formatNumber,
  percent,
} from "@/lib/format";

function EngagementLine({
  engagement,
}: {
  engagement: { views?: number | null; likes?: number | null; comments?: number | null; reposts?: number | null } | null;
}) {
  if (!engagement) return null;
  const parts = [
    engagement.views != null ? `${formatNumber(engagement.views)} views` : null,
    engagement.likes != null ? `${formatNumber(engagement.likes)} likes` : null,
    engagement.reposts != null ? `${formatNumber(engagement.reposts)} reposts` : null,
    engagement.comments != null ? `${formatNumber(engagement.comments)} comments` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <span className="text-[12px] text-ink-faint">{parts.join(" · ")}</span>;
}

/**
 * A single evidence item. Source content (original + translation) is visually
 * separated from AI interpretation, which lives in a labelled, collapsible
 * provenance block along with the full processing-event trail.
 */
export function EvidenceCard({ item }: { item: EvidenceItem }) {
  const { mention, author, events, duplicates } = item;
  const isTelugu = mention.language === "te" || mention.language === "mixed";

  /*
   * Reading view uses the boilerplate-stripped text; the title is already
   * displayed above, so it is not repeated in the body.
   */
  const displayText = mention.contentText ?? mention.originalText;
  const sourceBody =
    mention.title && displayText.startsWith(mention.title)
      ? displayText.slice(mention.title.length).trim() || displayText
      : displayText;
  const hasStrippedContent =
    mention.contentText !== null && mention.originalText.length > mention.contentText.length + 40;

  return (
    <article className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      {/* Source header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <PlatformBadge platform={mention.platform} />
        <span className="text-[13.5px] font-medium text-ink">{author?.name ?? "Unknown author"}</span>
        {author?.handle && <span className="text-[12px] text-ink-faint">@{author.handle}</span>}
        <AuthorTypeChip
          authorType={author?.authorType ?? "unknown"}
          confidence={author?.authorTypeConfidence}
        />
        <span className="ml-auto text-[12px] text-ink-muted">
          {formatDateTime(mention.publishedAt)} IST
        </span>
      </div>

      {/* Location + language + stance strip */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted">
        {mention.district ? (
          <span>
            {mention.district}
            {mention.mandal ? ` · ${mention.mandal}` : ""}
            {mention.locationConfidence != null && (
              <span className="text-ink-faint" title="Location confidence">
                {" "}
                ({percent(mention.locationConfidence)} conf.)
              </span>
            )}
          </span>
        ) : (
          <span className="text-ink-faint">District not evidenced</span>
        )}
        {mention.language && <span>{LANGUAGE_LABELS[mention.language]}</span>}
        {mention.stance && (
          <span>
            stance: <StanceChip stance={mention.stance} />
          </span>
        )}
        <EngagementLine engagement={mention.engagement} />
      </div>

      {/* SOURCE CONTENT */}
      <div className="mt-4 space-y-3">
        <div className={mention.thumbnailUrl ? "flex flex-col gap-4 sm:flex-row" : ""}>
          {mention.thumbnailUrl && (
            <a
              href={mention.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="block shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mention.thumbnailUrl}
                alt=""
                loading="lazy"
                className="aspect-video w-full rounded-md border border-border object-cover sm:w-[240px]"
              />
            </a>
          )}
          {mention.title && mention.platform !== "x" && (
            <div>
              {mention.broadcastStatus && (
                <div className="mb-1.5">
                  <BroadcastChip status={mention.broadcastStatus} />
                </div>
              )}
              <p className={`text-[15px] font-medium text-ink ${isTelugu ? "telugu-text" : ""}`}>
                {mention.title}
              </p>
            </div>
          )}
        </div>
        <div className="border-l-2 border-border-strong pl-4">
          <div className="kicker text-ink-faint">
            Original{mention.language ? ` — ${LANGUAGE_LABELS[mention.language]}` : ""}
          </div>
          <p
            className={`mt-1.5 whitespace-pre-line text-[14.5px] text-ink-secondary ${
              isTelugu ? "telugu-text" : ""
            }`}
          >
            {sourceBody}
          </p>
          {/*
            Channel boilerplate (subscribe CTAs, link lists, hashtag walls)
            is removed from the reading view but never destroyed — the full
            text as the platform returned it stays one click away.
          */}
          {hasStrippedContent && (
            <details className="provenance mt-2">
              <summary className="text-[11.5px] text-ink-faint hover:text-ink-muted">
                <span className="disclosure" /> Show full source text as published
              </summary>
              <p
                className={`mt-2 whitespace-pre-line text-[12.5px] text-ink-faint ${
                  isTelugu ? "telugu-text" : ""
                }`}
              >
                {mention.originalText}
              </p>
            </details>
          )}
        </div>

        {mention.englishTranslation && (
          <div className="border-l-2 border-border pl-4">
            <div className="kicker text-ink-faint">
              English ·{" "}
              {mention.translationProvenance === "seed_authored"
                ? "development translation (authored with demo corpus)"
                : "AI translation"}
            </div>
            <p className="mt-1.5 text-[14px] text-ink-muted">{mention.englishTranslation}</p>
          </div>
        )}
      </div>

      {/* Topic chips */}
      {(mention.topics.length > 0 || mention.crops.length > 0 || mention.schemes.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[...mention.topics, ...mention.subtopics, ...mention.crops, ...mention.schemes].map(
            (t) => (
              <span
                key={t}
                className="rounded-full border border-border px-2 py-0.5 text-[11.5px] text-ink-muted"
              >
                {t}
              </span>
            ),
          )}
        </div>
      )}

      {/* Source link */}
      <div className="mt-2 flex flex-wrap items-center gap-4 sm:mt-4">
        {mention.url && (
          <a
            href={mention.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center text-[12.5px] font-medium text-ink-muted hover:text-ink sm:min-h-0"
          >
            Open original source ↗
          </a>
        )}
        {mention.transcriptStatus === "unavailable" && (
          <span className="text-[11.5px] text-ink-faint">
            {mention.broadcastStatus === "live" || mention.broadcastStatus === "upcoming"
              ? /*
                 * Not a failure worth flagging as one: YouTube does not
                 * publish captions until a stream ends, so nothing was lost
                 * and nothing needs chasing.
                 */
                "Still broadcasting — captions are published once the stream ends"
              : "Transcript not available — analysed from title, description and metadata"}
          </span>
        )}
      </div>

      {/* AI INTERPRETATION + PROVENANCE — clearly separated from source content */}
      <details className="provenance mt-4 rounded-md border border-border bg-surface-2">
        <summary className="px-4 py-2.5 text-[12.5px] font-medium text-ink-muted hover:text-ink">
          <span className="disclosure" /> AI interpretation & provenance
        </summary>
        <div className="space-y-3 border-t border-border px-4 py-3 text-[12.5px] text-ink-muted">
          {mention.claim && (
            <div>
              <span className="kicker text-ink-faint">Extracted claim</span>
              <p className="mt-0.5 text-ink-secondary">
                “{mention.claim}”
                {mention.claimConfidence != null && (
                  <span className="text-ink-faint"> · confidence {percent(mention.claimConfidence)}</span>
                )}
              </p>
            </div>
          )}
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <span>Sentiment: {mention.sentiment ?? "—"}</span>
            <span>Stance toward government: {mention.stance ?? "—"}</span>
            <span>
              Telangana relevance:{" "}
              {mention.telanganaRelevance != null ? percent(mention.telanganaRelevance) : "—"}
            </span>
            <span>
              Agriculture relevance:{" "}
              {mention.agricultureRelevance != null ? percent(mention.agricultureRelevance) : "—"}
            </span>
            <span>
              Classification confidence:{" "}
              {mention.classificationConfidence != null
                ? percent(mention.classificationConfidence)
                : "—"}
            </span>
            <span>
              Voice: {mention.isOfficialVoice ? "official" : "third-party"}
            </span>
          </div>
          {mention.enrichmentMeta && (
            <p className="text-ink-faint">
              Enriched by {mention.enrichmentMeta.provider}/{mention.enrichmentMeta.model} (prompt{" "}
              {mention.enrichmentMeta.promptVersion}, {mention.enrichmentMeta.durationMs}ms)
            </p>
          )}
          <div>
            <span className="kicker text-ink-faint">Processing trail</span>
            <ol className="mt-1 space-y-0.5">
              {events.map((event) => (
                <li key={event.id} className="text-ink-faint">
                  <span className="text-ink-muted">{event.eventType}</span>
                  {" · "}
                  {formatDateTime(event.createdAt)}
                </li>
              ))}
            </ol>
          </div>
          <p className="text-ink-faint">
            mention {mention.id.slice(0, 8)} · raw item {mention.rawItemId.slice(0, 8)} · origin{" "}
            <span className={mention.dataOrigin === "demo_seed" ? "text-emerging" : ""}>
              {mention.dataOrigin}
            </span>
          </p>
        </div>
      </details>

      {/* Duplicates — retained as evidence, excluded from counts */}
      {duplicates.length > 0 && (
        <div className="mt-3 space-y-2">
          {duplicates.map((dup) => (
            <div
              key={dup.mention.id}
              className="rounded-md border border-dashed border-border px-4 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                <span className="kicker text-ink-faint">
                  {dup.mention.duplicateType === "exact" ? "Syndicated copy" : "Near-duplicate"}
                </span>
                <PlatformBadge platform={dup.mention.platform} />
                <span className="text-ink-muted">{dup.author?.name ?? "Unknown"}</span>
                <span className="text-ink-faint">
                  {formatDateTime(dup.mention.publishedAt)} IST
                </span>
                <span className="ml-auto text-ink-faint">not counted toward volume</span>
              </div>
              {dup.mention.title && (
                <p className="mt-1 text-[13px] text-ink-muted">{dup.mention.title}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
