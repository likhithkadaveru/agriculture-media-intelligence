/**
 * Platform normalizers: connector-native payload → canonical NormalizedMention.
 *
 * These are keyed by platform, not by connector — a future live YouTube
 * connector (official API) produces the same payload family the demo corpus
 * mimics, so these code paths are the production ones.
 *
 * Unknown values remain null. Nothing is invented.
 */
import type { NormalizedMention, Platform, RawSourceItem } from "@/types/core";

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
  const snippet = obj(p.snippet);
  const stats = obj(p.statistics);
  const title = str(snippet.title);
  const description = str(snippet.description) ?? "";
  const channel = str(snippet.channelTitle);
  return {
    platform: "youtube",
    externalId: item.externalId,
    url: str(p.url),
    publishedAt,
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
    dataOrigin: item.dataOrigin,
  };
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
          isOfficialAccount: false,
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
