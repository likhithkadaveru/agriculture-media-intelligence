import { describe, expect, it } from "vitest";
import { YouTubeApiConnector } from "@/ingestion/connectors/youtube-api";
import { normalizeRawItem } from "@/ingestion/normalization";
import type { RawSourceItem } from "@/types/core";

/** Shaped after the YouTube Data API v3 videos.list resource. */
function video(id: string, liveBroadcastContent: string, liveStreamingDetails?: object) {
  return {
    id,
    snippet: {
      title: `${id} title`,
      description: "",
      channelTitle: "NTV Live",
      publishedAt: "2026-09-07T10:00:00Z",
      liveBroadcastContent,
      thumbnails: { high: { url: `https://i.ytimg.com/${id}.jpg` } },
    },
    statistics: { viewCount: "1000" },
    ...(liveStreamingDetails ? { liveStreamingDetails } : {}),
  };
}

function connectorReturning(videos: object[], seen: string[]) {
  const connector = new YouTubeApiConnector("test-key", "live");
  connector.fetchJson = async (url: string) => {
    seen.push(url);
    return url.includes("/search")
      ? { items: videos.map((v) => ({ id: { videoId: (v as { id: string }).id } })) }
      : { items: videos };
  };
  return connector;
}

describe("youtube live connector", () => {
  it("registers under its own key so runs are attributed separately", () => {
    expect(new YouTubeApiConnector("k", "live").key).toBe("youtube-live");
    expect(new YouTubeApiConnector("k").key).toBe("youtube-api");
  });

  it("asks the API only for what is airing, and for the live details", async () => {
    const seen: string[] = [];
    await connectorReturning([video("abc", "live")], seen).collect({ query: "Telangana rythu" });

    const [searchUrl, videosUrl] = seen;
    expect(searchUrl).toContain("eventType=live");
    expect(searchUrl).toContain("type=video");
    // Without this part an ended broadcast is indistinguishable from an upload.
    expect(videosUrl).toContain("liveStreamingDetails");
  });

  it("does not restrict by event type on the plain api connector", async () => {
    const seen: string[] = [];
    const connector = new YouTubeApiConnector("test-key");
    connector.fetchJson = async (url: string) => {
      seen.push(url);
      return url.includes("/search") ? { items: [{ id: { videoId: "x" } }] } : { items: [] };
    };
    await connector.collect({ query: "anything" });
    expect(seen[0]).not.toContain("eventType");
  });
});

describe("broadcast status normalization", () => {
  const raw = (payload: object): RawSourceItem => ({
    platform: "youtube",
    externalId: "abc",
    payload,
    collectedAt: new Date("2026-09-07T10:05:00Z"),
    dataOrigin: "live",
  });

  it("marks a stream that is airing", async () => {
    expect((await normalizeRawItem(raw(video("abc", "live")))).broadcastStatus).toBe("live");
  });

  it("marks one that has not started", async () => {
    expect((await normalizeRawItem(raw(video("abc", "upcoming")))).broadcastStatus).toBe("upcoming");
  });

  it("still recognises a finished telecast, which the API reports as 'none'", async () => {
    // The whole reason liveStreamingDetails is requested: the flag resets the
    // moment a stream stops, so only this distinguishes it from an upload.
    const ended = video("abc", "none", { actualStartTime: "2026-09-07T08:00:00Z", actualEndTime: "2026-09-07T09:00:00Z" });
    expect((await normalizeRawItem(raw(ended))).broadcastStatus).toBe("ended");
  });

  it("leaves an ordinary upload null rather than guessing", async () => {
    expect((await normalizeRawItem(raw(video("abc", "none")))).broadcastStatus).toBeNull();
  });
});
