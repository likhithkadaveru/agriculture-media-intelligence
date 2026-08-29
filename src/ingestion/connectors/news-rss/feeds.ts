/**
 * News feed registry — public RSS/Atom feeds from Telugu and English
 * publications covering Telangana.
 *
 * Every feed URL here was fetched and verified to return items before being
 * added. No credential is required for any of them, which is why news
 * collection works alongside YouTube from day one.
 *
 * `kind` seeds a classification prior only; enrichment still classifies each
 * item on its own evidence with a confidence score.
 */

export interface NewsFeed {
  key: string;
  name: string;
  url: string;
  language: "te" | "en";
  /** Editorial scope, used to set expected noise in the scheduler. */
  scope: "telangana" | "telugu-general" | "national";
  kind: "media_organisation";
  enabled: boolean;
  note?: string;
}

export const NEWS_FEEDS: NewsFeed[] = [
  /* ---- Telugu-language publications ---- */
  {
    key: "v6velugu",
    name: "V6 Velugu",
    url: "https://www.v6velugu.com/feed",
    language: "te",
    scope: "telangana",
    kind: "media_organisation",
    enabled: true,
    note: "Telangana-focused Telugu daily",
  },
  {
    key: "ntv-telugu",
    name: "NTV Telugu",
    url: "https://ntvtelugu.com/feed",
    language: "te",
    scope: "telugu-general",
    kind: "media_organisation",
    enabled: true,
  },
  {
    key: "sakshi",
    name: "Sakshi",
    url: "https://www.sakshi.com/rss.xml",
    language: "te",
    scope: "telugu-general",
    kind: "media_organisation",
    enabled: true,
  },
  {
    key: "oneindia-telugu",
    name: "OneIndia Telugu",
    url: "https://telugu.oneindia.com/rss/telugu-news-fb.xml",
    language: "te",
    scope: "telugu-general",
    kind: "media_organisation",
    enabled: true,
  },

  /* ---- English publications with Telangana desks ---- */
  {
    key: "telangana-today",
    name: "Telangana Today",
    url: "https://telanganatoday.com/feed",
    language: "en",
    scope: "telangana",
    kind: "media_organisation",
    enabled: true,
    note: "Highest-volume Telangana English feed",
  },
  {
    key: "hans-india-telangana",
    name: "The Hans India — Telangana",
    url: "https://www.thehansindia.com/rss/telangana",
    language: "en",
    scope: "telangana",
    kind: "media_organisation",
    enabled: true,
  },
  {
    key: "the-hindu-telangana",
    name: "The Hindu — Telangana",
    url: "https://www.thehindu.com/news/national/telangana/feeder/default.rss",
    language: "en",
    scope: "telangana",
    kind: "media_organisation",
    enabled: true,
  },
  {
    key: "deccan-chronicle",
    name: "Deccan Chronicle",
    url: "https://www.deccanchronicle.com/google_feeds.xml",
    language: "en",
    scope: "telugu-general",
    kind: "media_organisation",
    enabled: true,
  },
  {
    key: "ndtv-south",
    name: "NDTV South",
    url: "https://feeds.feedburner.com/ndtvnews-south",
    language: "en",
    scope: "national",
    kind: "media_organisation",
    enabled: true,
    note: "National desk — high noise, kept for escalation detection",
  },
];

export function enabledNewsFeeds(): NewsFeed[] {
  return NEWS_FEEDS.filter((f) => f.enabled);
}
