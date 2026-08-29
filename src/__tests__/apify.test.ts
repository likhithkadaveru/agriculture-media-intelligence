import { describe, expect, it, vi } from "vitest";
import { ApifyConnectorAdapter } from "@/ingestion/connectors/apify";
import { X_SEARCH } from "@/ingestion/connectors/apify/sources";

// Shaped after apidojo/tweet-scraper output. Field names come from the
// actor's published schema, with the alternates it also emits.
const TWEET = {
  id: "1829384756",
  text: "ఖమ్మం జిల్లాలో యూరియా దొరకడం లేదు. సొసైటీ దగ్గర రైతులు ఎదురు చూస్తున్నారు.",
  url: "https://x.com/demo_farmer/status/1829384756",
  createdAt: "2026-08-28T04:30:00.000Z",
  lang: "te",
  author: {
    name: "Rythu Voice",
    userName: "demo_farmer",
    description: "రైతు, ఖమ్మం",
    followers: 1240,
    isVerified: false,
  },
  likeCount: 42,
  retweetCount: 11,
  replyCount: 5,
  viewCount: 3100,
};

describe("apify X source", () => {
  it("builds actor input matching the published schema", () => {
    const input = X_SEARCH.buildInput({ query: "డీఏపీ తెలంగాణ", limit: 25 });
    expect(input.searchTerms).toEqual(["డీఏపీ తెలంగాణ"]);
    expect(input.maxItems).toBe(25);
    // Latest, not Top — an emerging complaint has no engagement yet, so
    // engagement ranking would hide exactly the signal we want.
    expect(input.sort).toBe("Latest");
  });

  it("refuses to run without a search term", () => {
    expect(() => X_SEARCH.buildInput({ query: null })).toThrow(/search term/);
  });

  it("parses a tweet into a raw item", () => {
    const parsed = X_SEARCH.parseItem(TWEET);
    expect(parsed).not.toBeNull();
    expect(parsed!.externalId).toBe("1829384756");
    const p = parsed!.payload as Record<string, unknown>;
    expect(p.text).toContain("ఖమ్మం");
    expect((p.author as Record<string, unknown>).handle).toBe("demo_farmer");
    expect((p.metrics as Record<string, number>).reposts).toBe(11);
  });

  it("accepts the actor's alternate field names", () => {
    const parsed = X_SEARCH.parseItem({
      id_str: "99",
      full_text: "urea shortage in Nalgonda",
      author: { screen_name: "x", name: "X" },
      favorite_count: 3,
      retweet_count: 1,
    });
    expect(parsed!.externalId).toBe("99");
    expect((parsed!.payload as Record<string, unknown>).text).toContain("Nalgonda");
  });

  it("skips malformed rows instead of importing junk", () => {
    expect(X_SEARCH.parseItem({ id: "1" })).toBeNull();
    expect(X_SEARCH.parseItem({ text: "no id" })).toBeNull();
    expect(X_SEARCH.parseItem(null)).toBeNull();
  });

  it("normalizes into a canonical mention with a real published date", async () => {
    const adapter = new ApifyConnectorAdapter(X_SEARCH, "test-token");
    adapter.runActor = vi.fn().mockResolvedValue([TWEET]);

    const raw = await adapter.collect({ query: "యూరియా తెలంగాణ" });
    expect(raw).toHaveLength(1);
    expect(raw[0].dataOrigin).toBe("live");

    const mention = await adapter.normalize(raw[0]);
    expect(mention.platform).toBe("x");
    expect(mention.author?.handle).toBe("demo_farmer");
    expect(mention.originalText).toContain("యూరియా");
    expect(mention.engagement?.reposts).toBe(11);
    expect(mention.publishedAt?.toISOString()).toBe("2026-08-28T04:30:00.000Z");
  });

  it("refuses to collect without a token rather than failing silently", async () => {
    const adapter = new ApifyConnectorAdapter(X_SEARCH, undefined);
    await expect(adapter.collect({ query: "x" })).rejects.toThrow(/APIFY_API_TOKEN/);
  });
});

describe("official account recognition", () => {
  it("flags an institutional government handle as official voice", async () => {
    const parsed = X_SEARCH.parseItem({
      id: "5",
      text: "ఎరువుల నిల్వలు సరిపడా ఉన్నాయి",
      author: { name: "IPRDepartment", userName: "IPRTelangana" },
    })!;
    const { normalizeRawItem } = await import("@/ingestion/normalization");
    const m = normalizeRawItem({
      platform: "x",
      externalId: parsed.externalId,
      payload: parsed.payload,
      collectedAt: new Date(),
      dataOrigin: "live",
    });
    expect(m.author?.isOfficialAccount).toBe(true);
  });

  it("does not flag an ordinary account as official", async () => {
    const parsed = X_SEARCH.parseItem({
      id: "6",
      text: "మా ఊర్లో యూరియా లేదు",
      author: { name: "Rythu", userName: "some_farmer" },
    })!;
    const { normalizeRawItem } = await import("@/ingestion/normalization");
    const m = normalizeRawItem({
      platform: "x",
      externalId: parsed.externalId,
      payload: parsed.payload,
      collectedAt: new Date(),
      dataOrigin: "live",
    });
    expect(m.author?.isOfficialAccount).toBe(false);
  });
});

describe("historical window", () => {
  it("passes a date window to the actor when one is requested", () => {
    const since = new Date("2026-08-15T00:00:00Z");
    const input = X_SEARCH.buildInput({ query: "DAP Telangana", limit: 50, since });
    expect(input.start).toBe("2026-08-15");
    expect(input.maxItems).toBe(50);
  });

  it("omits the window when none is requested, rather than inventing one", () => {
    const input = X_SEARCH.buildInput({ query: "DAP Telangana" });
    expect(input.start).toBeUndefined();
    expect(input.end).toBeUndefined();
  });
});

describe("silent-failure protection", () => {
  it("treats an empty dataset as an error, not as 'no results'", async () => {
    // apidojo/tweet-scraper hits its own free-tier RUN cap and exits
    // SUCCEEDED with zero items, putting the quota message only in the log.
    // Swallowing that produced empty collection cycles that looked normal.
    const adapter = new ApifyConnectorAdapter(X_SEARCH, "token");
    adapter.runActor = vi.fn().mockResolvedValue([]);
    await expect(adapter.collect({ query: "Telangana farmers" })).rejects.toThrow(
      /quota or plan limit/,
    );
  });

  it("still collects normally when the actor returns items", async () => {
    const adapter = new ApifyConnectorAdapter(X_SEARCH, "token");
    adapter.runActor = vi.fn().mockResolvedValue([TWEET]);
    const raw = await adapter.collect({ query: "x" });
    expect(raw).toHaveLength(1);
  });
});
