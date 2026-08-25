/**
 * YouTube Data API v3 connector — the preferred discovery path when
 * YOUTUBE_API_KEY is configured. Dormant otherwise (the scheduler stores its
 * queries either way, so activation is purely a credential drop).
 *
 * Quota model (defaults, units/day: 10,000):
 * - search.list = 100 units per call → discovery is the expensive step.
 * - videos.list = 1 unit per call (50 ids per call).
 * The scheduler's tiers control how often search runs; this connector just
 * executes one query per collect() call.
 *
 * Raw payload = the API video resource (verbatim) + the search context.
 * Transcripts are never fetched or fabricated (transcript_status stays
 * "unavailable" in normalization).
 */
import type {
  CollectionQuery,
  NormalizedMention,
  RawSourceItem,
  SourceConnector,
} from "@/types/core";
import { normalizeRawItem } from "@/ingestion/normalization";

const API = "https://www.googleapis.com/youtube/v3";

interface SearchItem {
  id?: { videoId?: string };
}

export class YouTubeApiConnector implements SourceConnector {
  key = "youtube-api";
  platform = "youtube" as const;

  constructor(private apiKey = process.env.YOUTUBE_API_KEY) {}

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Injectable for tests. */
  fetchJson: (url: string) => Promise<unknown> = async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      throw new Error(`YouTube API error HTTP ${response.status}: ${await response.text()}`);
    }
    return response.json();
  };

  async collect(query: CollectionQuery): Promise<RawSourceItem[]> {
    if (!this.apiKey) throw new Error("YOUTUBE_API_KEY is not configured");
    if (!query.query) throw new Error("youtube-api requires a search query");

    const searchUrl =
      `${API}/search?part=snippet&type=video&maxResults=${query.limit ?? 25}` +
      `&order=date&regionCode=IN&q=${encodeURIComponent(query.query)}&key=${this.apiKey}`;
    const search = (await this.fetchJson(searchUrl)) as { items?: SearchItem[] };
    const videoIds = (search.items ?? [])
      .map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id));
    if (videoIds.length === 0) return [];

    const videosUrl =
      `${API}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(",")}` +
      `&key=${this.apiKey}`;
    const videos = (await this.fetchJson(videosUrl)) as {
      items?: Array<Record<string, unknown> & { id?: string }>;
    };

    const collectedAt = new Date();
    return (videos.items ?? []).flatMap((video) => {
      if (!video.id) return [];
      return [
        {
          platform: "youtube" as const,
          externalId: video.id,
          payload: { ...video, searchQuery: query.query },
          collectedAt,
          dataOrigin: "live" as const,
        },
      ];
    });
  }

  async normalize(item: RawSourceItem): Promise<NormalizedMention> {
    return normalizeRawItem(item);
  }
}
