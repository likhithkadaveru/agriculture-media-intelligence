/**
 * Registered Apify sources.
 *
 * Each entry is a declaration, not code: actor id, how to build its input
 * from a scheduler query, and how to turn one dataset row into a raw item.
 * The platform normalizers do the rest, so nothing downstream ever sees an
 * Apify response shape.
 *
 * Actor ids and input fields below were verified against Apify's public
 * actor API rather than assumed.
 */
import type { ApifySourceSpec } from "./index";

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function obj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

/**
 * X / Twitter search.
 *
 * Actor: apidojo/tweet-scraper (Tweet Scraper V2).
 * Input fields confirmed from the actor's published input schema:
 * searchTerms, maxItems, sort, tweetLanguage.
 *
 * This is the source that finally brings individual farmer voices in —
 * YouTube and news give us broadcasters and publishers; X gives us people.
 */
/**
 * Results requested per search term.
 *
 * The actor bills $0.0004 per tweet. At the default 15 results across the ten
 * Tier A terms once a day that is ~4,500 tweets a month, about $1.80 — inside
 * Apify's $5 free monthly credit with room to spare. Raise deliberately via
 * APIFY_X_MAX_ITEMS and recompute: terms x items x runs/day x 30 x $0.0004.
 */
const X_MAX_ITEMS = Number(process.env.APIFY_X_MAX_ITEMS ?? 15);

export const X_SEARCH: ApifySourceSpec = {
  key: "apify-x-search",
  platform: "x",
  actorId: "apidojo/tweet-scraper",

  buildInput(query) {
    if (!query.query) throw new Error("apify-x-search requires a search term");
    // The actor accepts `start`/`end` (confirmed from its input schema), so a
    // historical window is a real capability here rather than a filter we
    // apply after paying for everything.
    const window = query.since
      ? { start: query.since.toISOString().slice(0, 10) }
      : {};
    return {
      ...window,
      searchTerms: [query.query],
      maxItems: query.limit ?? X_MAX_ITEMS,
      // "Latest" rather than "Top": an emerging complaint has no engagement
      // yet, and engagement-ranked results would systematically hide exactly
      // the early signal this system exists to find.
      sort: "Latest",
      onlyVerifiedUsers: false,
    };
  },

  parseItem(item) {
    const t = obj(item);
    // The actor returns an id plus either `text` or `fullText`.
    const id = str(t.id) ?? str(t.id_str) ?? str(t.conversationId);
    const text = str(t.text) ?? str(t.fullText) ?? str(t.full_text);
    if (!id || !text) return null;

    const author = obj(t.author);
    const handle = str(author.userName) ?? str(author.screen_name) ?? str(t.username);

    return {
      externalId: id,
      payload: {
        payloadKind: "apify-x-tweet",
        id,
        text,
        url:
          str(t.url) ??
          str(t.twitterUrl) ??
          (handle ? `https://x.com/${handle}/status/${id}` : null),
        publishedAt: str(t.createdAt) ?? str(t.created_at),
        author: {
          name: str(author.name) ?? handle,
          handle,
          bio: str(author.description),
          followers: num(author.followers) ?? num(author.followersCount),
          isVerified: Boolean(author.isVerified ?? author.verified),
        },
        metrics: {
          likes: num(t.likeCount) ?? num(t.favorite_count),
          reposts: num(t.retweetCount) ?? num(t.retweet_count),
          replies: num(t.replyCount) ?? num(t.reply_count),
          views: num(t.viewCount),
        },
        lang: str(t.lang),
      },
    };
  },
};

/**
 * Instagram hashtag search.
 *
 * Actor: apify/instagram-hashtag-scraper. Public hashtag content only —
 * never private accounts, never followers, never direct messages.
 *
 * Costs $0.0026 per result, roughly 6.5x X, so volumes are kept
 * deliberately smaller and the hashtag list stays short and specific.
 */
/**
 * Instagram results cost $0.0026 each — 6.5x an X result — so this defaults
 * low and the hashtag list is short. Raise via APIFY_IG_MAX_ITEMS.
 */
const IG_MAX_ITEMS = Number(process.env.APIFY_IG_MAX_ITEMS ?? 12);

/** Hashtags polled for Instagram. Specific beats broad: #agriculture alone
 *  returns global stock content that the relevance gate then pays to reject. */
export const INSTAGRAM_HASHTAGS = [
  "telanganafarmers",
  "rythubharosa",
  "telanganaagriculture",
  "telanganarythu",
];

export const INSTAGRAM_HASHTAG: ApifySourceSpec = {
  key: "apify-instagram-hashtag",
  platform: "web",
  actorId: "apify/instagram-hashtag-scraper",

  buildInput(query) {
    if (!query.query) throw new Error("apify-instagram-hashtag requires a hashtag");
    return {
      hashtags: [query.query.replace(/^#/, "")],
      resultsLimit: query.limit ?? IG_MAX_ITEMS,
    };
  },

  parseItem(item) {
    const p = obj(item);
    const id = str(p.id) ?? str(p.shortCode);
    const caption = str(p.caption);
    if (!id || !caption) return null;
    return {
      externalId: id,
      payload: {
        payloadKind: "apify-instagram-post",
        pageId: id,
        title: caption.split("\n")[0].slice(0, 140),
        body: caption,
        siteName: str(p.ownerFullName) ?? str(p.ownerUsername) ?? "Instagram",
        url: str(p.url),
        publishedAt: str(p.timestamp),
        imageUrl: str(p.displayUrl),
        metrics: { likes: num(p.likesCount), comments: num(p.commentsCount) },
      },
    };
  },
};


/**
 * X / Twitter search — alternate actor.
 *
 * Actor: kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest.
 * Verified from its published input schema: searchTerms, maxItems (required),
 * queryType (Latest/Top), since_time/until_time. Note the field names differ
 * from apidojo's — this is exactly why each source declares its own input
 * builder rather than sharing one.
 *
 * Exists because apidojo/tweet-scraper enforces a free-tier monthly RUN cap
 * independent of Apify account credit, and exits SUCCEEDED with zero items
 * once hit. This actor is also cheaper ($0.00025 vs $0.0004 per result).
 *
 * The output shape is Twitter-standard and the parser already tolerates both
 * naming conventions, so it is reused unchanged.
 */
export const X_SEARCH_ALT: ApifySourceSpec = {
  key: "apify-x-search",
  platform: "x",
  actorId: "kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest",

  buildInput(query) {
    if (!query.query) throw new Error("apify-x-search requires a search term");
    return {
      searchTerms: [query.query],
      maxItems: query.limit ?? X_MAX_ITEMS,
      // Latest, not Top — an emerging complaint has no engagement yet.
      queryType: "Latest",
      ...(query.since
        ? { since_time: query.since.toISOString().slice(0, 19).replace("T", "_") + "_UTC" }
        : {}),
    };
  },

  parseItem: X_SEARCH.parseItem,
};

/**
 * The X source actually used. Swappable by env so a quota wall on one actor
 * does not require a code change — both were verified against Apify's public
 * actor API.
 */
export const ACTIVE_X_SOURCE: ApifySourceSpec =
  process.env.APIFY_X_ACTOR === "apidojo" ? X_SEARCH : X_SEARCH_ALT;

/** Sources registered with the connector registry. */
export const APIFY_SOURCES: ApifySourceSpec[] = [ACTIVE_X_SOURCE, INSTAGRAM_HASHTAG];

/** Sources the scheduler seeds queries for. */
export const SCHEDULED_APIFY_SOURCES = [ACTIVE_X_SOURCE, INSTAGRAM_HASHTAG];
