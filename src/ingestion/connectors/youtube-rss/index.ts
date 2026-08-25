/**
 * YouTube RSS connector — live public collection with zero credentials.
 *
 * Uses the official, key-free feed endpoint
 * https://www.youtube.com/feeds/videos.xml?channel_id=… which returns the
 * channel's recent uploads with title, description, published/updated
 * timestamps, thumbnail, view count and like count.
 *
 * `collect({query})` treats the query as a channel id (the query scheduler
 * stores one row per channel). The raw payload stored in raw_items is the
 * parsed Atom entry plus channel context — the connector-native shape.
 */
import { XMLParser } from "fast-xml-parser";
import type {
  CollectionQuery,
  NormalizedMention,
  RawSourceItem,
  SourceConnector,
} from "@/types/core";
import { normalizeRawItem } from "@/ingestion/normalization";
import { YOUTUBE_CHANNELS } from "./channels";

const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=";

export interface YouTubeRssPayload {
  payloadKind: "youtube-rss-entry";
  videoId: string;
  title: string;
  description: string | null;
  channelId: string;
  channelTitle: string;
  channelKind: string | null;
  publishedAt: string;
  updatedAt: string | null;
  url: string;
  thumbnailUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
}

type XmlEntry = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null && "#text" in value) {
    return text((value as Record<string, unknown>)["#text"]);
  }
  return null;
}

export function parseFeed(
  xml: string,
  channelKind: string | null,
): YouTubeRssPayload[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const doc = parser.parse(xml);
  const feed = doc.feed ?? {};
  const channelTitle = text(feed.title) ?? "Unknown channel";
  const channelId = text(feed["yt:channelId"]) ?? "";
  const entries = asArray<XmlEntry>(feed.entry);

  return entries.flatMap((entry) => {
    const videoId = text(entry["yt:videoId"]);
    const title = text(entry.title);
    const publishedAt = text(entry.published);
    if (!videoId || !title || !publishedAt) return [];
    const media = (entry["media:group"] ?? {}) as Record<string, unknown>;
    const community = (media["media:community"] ?? {}) as Record<string, unknown>;
    const statistics = (community["media:statistics"] ?? {}) as Record<string, unknown>;
    const starRating = (community["media:starRating"] ?? {}) as Record<string, unknown>;
    const thumbnail = (media["media:thumbnail"] ?? {}) as Record<string, unknown>;
    const views = Number(statistics["@_views"]);
    const likes = Number(starRating["@_count"]);
    return [
      {
        payloadKind: "youtube-rss-entry" as const,
        videoId,
        title,
        description: text(media["media:description"]),
        channelId: channelId.startsWith("UC") ? channelId : `UC${channelId}`,
        channelTitle,
        channelKind,
        publishedAt,
        updatedAt: text(entry.updated),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: text((thumbnail as Record<string, unknown>)["@_url"]) ?? null,
        viewCount: Number.isFinite(views) ? views : null,
        likeCount: Number.isFinite(likes) ? likes : null,
      },
    ];
  });
}

export class YouTubeRssConnector implements SourceConnector {
  key = "youtube-rss";
  platform = "youtube" as const;

  /**
   * Injectable for tests. Retries with backoff: YouTube intermittently
   * answers 404/500 to rapid sequential feed requests even for valid
   * channels (observed across live runs), so a single failure is not
   * treated as a dead channel.
   */
  fetchXml: (channelId: string) => Promise<string> = async (channelId) => {
    const delays = [0, 1500, 4000];
    let lastError: unknown;
    for (const delay of delays) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        const response = await fetch(`${FEED_URL}${channelId}`, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            accept: "application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.text();
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(
      `Feed fetch failed for ${channelId} after ${delays.length} attempts: ${
        lastError instanceof Error ? lastError.message : lastError
      }`,
    );
  };

  async collect(query: CollectionQuery): Promise<RawSourceItem[]> {
    const channelId = query.query;
    if (!channelId) throw new Error("youtube-rss requires a channel id query");
    const channel = YOUTUBE_CHANNELS.find((c) => c.channelId === channelId);
    const xml = await this.fetchXml(channelId);
    const entries = parseFeed(xml, channel?.kind ?? null);
    const collectedAt = new Date();
    return entries.map((entry) => ({
      platform: "youtube" as const,
      externalId: entry.videoId,
      payload: entry,
      collectedAt,
      dataOrigin: "live" as const,
    }));
  }

  async normalize(item: RawSourceItem): Promise<NormalizedMention> {
    return normalizeRawItem(item);
  }
}
