/**
 * Platform normalizers: connector-native payload → canonical NormalizedMention.
 *
 * These are keyed by platform, not by connector — a future live YouTube
 * connector (official API) produces the same payload family the demo corpus
 * mimics, so these code paths are the production ones.
 *
 * Unknown values remain null. Nothing is invented.
 */
import type { BroadcastStatus, NormalizedMention, Platform, RawSourceItem } from "@/types/core";
import { isOfficialXHandle } from "@/ingestion/connectors/apify/official-accounts";

type PayloadRecord = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function obj(v: unknown): PayloadRecord {
  return typeof v === "object" && v !== null ? (v as PayloadRecord) : {};
}

function normalizeYouTube(item: RawSourceItem, publishedAt: Date | null): NormalizedMention {
  const p = obj(item.payload);

  // RSS-feed entry shape (YouTubeRssConnector).
  if (p.payloadKind === "youtube-rss-entry") {
    const title = str(p.title);
    const description = str(p.description) ?? "";
    const channel = str(p.channelTitle);
    const channelKind = str(p.channelKind);
    return {
      platform: "youtube",
      externalId: item.externalId,
      url: str(p.url),
      publishedAt: publishedAt ?? (str(p.publishedAt) ? new Date(str(p.publishedAt)!) : null),
      author: channel
        ? {
            name: channel,
            handle: null,
            bio: channelKind ? `channel-kind:${channelKind}` : null,
            isOfficialAccount: channelKind === "government",
          }
        : null,
      title,
      originalText: [title, description].filter(Boolean).join("\n\n"),
      engagement: {
        views: num(p.viewCount),
        likes: num(p.likeCount),
        comments: null,
        reposts: null,
      },
      thumbnailUrl: str(p.thumbnailUrl),
      transcriptStatus: "unavailable",
      dataOrigin: item.dataOrigin,
    };
  }

  // YouTube Data API v3 video-resource shape.
  const snippet = obj(p.snippet);
  const stats = obj(p.statistics);
  const thumbnails = obj(snippet.thumbnails);
  const bestThumb =
    str(obj(thumbnails.high).url) ?? str(obj(thumbnails.medium).url) ?? str(obj(thumbnails.default).url);
  const title = str(snippet.title);
  const description = str(snippet.description) ?? "";
  const channel = str(snippet.channelTitle);
  return {
    platform: "youtube",
    externalId: item.externalId,
    url: str(p.url) ?? `https://www.youtube.com/watch?v=${item.externalId}`,
    publishedAt: publishedAt ?? (str(snippet.publishedAt) ? new Date(str(snippet.publishedAt)!) : null),
    author: channel
      ? {
          name: channel,
          handle: null,
          bio: str(snippet.channelDescription),
          isOfficialAccount: false,
        }
      : null,
    title,
    originalText: [title, description].filter(Boolean).join("\n\n"),
    engagement: {
      views: num(stats.viewCount),
      likes: num(stats.likeCount),
      comments: num(stats.commentCount),
      reposts: null,
    },
    thumbnailUrl: bestThumb,
    transcriptStatus: "unavailable",
    broadcastStatus: broadcastStateOf(snippet, obj(p.liveStreamingDetails)),
    dataOrigin: item.dataOrigin,
  };
}

/**
 * live | upcoming | ended | null, from the two fields the API splits it over.
 *
 * liveBroadcastContent goes back to "none" the moment a stream stops, so a
 * finished telecast is indistinguishable from an ordinary upload by that
 * field alone. liveStreamingDetails is what survives: it is present only for
 * videos that were ever broadcasts.
 */
function broadcastStateOf(
  snippet: Record<string, unknown>,
  liveDetails: Record<string, unknown>,
): BroadcastStatus | null {
  const flag = str(snippet.liveBroadcastContent);
  if (flag === "live") return "live";
  if (flag === "upcoming") return "upcoming";
  return liveDetails.actualStartTime || liveDetails.actualEndTime ? "ended" : null;
}

function normalizeX(item: RawSourceItem, publishedAt: Date | null): NormalizedMention {
  const p = obj(item.payload);
  const author = obj(p.author);
  const metrics = obj(p.metrics);
  return {
    platform: "x",
    externalId: item.externalId,
    url: str(p.url),
    publishedAt,
    author: str(author.name)
      ? {
          name: str(author.name)!,
          handle: str(author.handle),
          bio: str(author.bio),
          // Institutional government accounts must be recognised, or a
          // department statement would count as one more public voice and
          // understate any official-versus-public divergence.
          isOfficialAccount: isOfficialXHandle(str(author.handle)),
        }
      : null,
    title: null,
    originalText: str(p.text) ?? "",
    engagement: {
      views: num(metrics.views),
      likes: num(metrics.likes),
      comments: num(metrics.replies),
      reposts: num(metrics.reposts),
    },
    dataOrigin: item.dataOrigin,
  };
}

function normalizeNews(item: RawSourceItem, publishedAt: Date | null): NormalizedMention {
  const p = obj(item.payload);
  const headline = str(p.headline);
  const body = str(p.body) ?? "";
  const outlet = str(p.outlet);
  return {
    platform: "news",
    externalId: item.externalId,
    url: str(p.url),
    publishedAt,
    author: outlet
      ? { name: outlet, handle: null, bio: str(p.section), isOfficialAccount: false }
      : null,
    title: headline,
    originalText: [headline, body].filter(Boolean).join("\n\n"),
    engagement: null,
    thumbnailUrl: str(p.imageUrl),
    // Articles carry their text inline; a transcript is not a concept here.
    transcriptStatus: "not_applicable",
    dataOrigin: item.dataOrigin,
  };
}

function normalizeOfficial(item: RawSourceItem, publishedAt: Date | null): NormalizedMention {
  const p = obj(item.payload);
  const title = str(p.title);
  const body = str(p.body) ?? "";
  const organisation = str(p.organisation);
  return {
    platform: "official",
    externalId: item.externalId,
    url: str(p.url),
    publishedAt,
    author: organisation
      ? { name: organisation, handle: null, bio: null, isOfficialAccount: true }
      : null,
    title,
    originalText: [title, body].filter(Boolean).join("\n\n"),
    engagement: null,
    dataOrigin: item.dataOrigin,
  };
}

function normalizeWeb(item: RawSourceItem, publishedAt: Date | null): NormalizedMention {
  const p = obj(item.payload);
  const title = str(p.title);
  const body = str(p.body) ?? "";
  const siteName = str(p.siteName);
  return {
    platform: "web",
    externalId: item.externalId,
    url: str(p.url),
    publishedAt,
    author: siteName
      ? { name: siteName, handle: null, bio: null, isOfficialAccount: false }
      : null,
    title,
    originalText: [title, body].filter(Boolean).join("\n\n"),
    engagement: null,
    dataOrigin: item.dataOrigin,
  };
}

const NORMALIZERS: Record<
  Platform,
  (item: RawSourceItem, publishedAt: Date | null) => NormalizedMention
> = {
  youtube: normalizeYouTube,
  x: normalizeX,
  news: normalizeNews,
  official: normalizeOfficial,
  web: normalizeWeb,
};

export function normalizeRawItem(
  item: RawSourceItem,
  opts?: { publishedAt?: Date | null },
): NormalizedMention {
  const normalizer = NORMALIZERS[item.platform];
  if (!normalizer) {
    throw new Error(`No normalizer for platform: ${item.platform}`);
  }
  return normalizer(item, opts?.publishedAt ?? null);
}
