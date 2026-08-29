/**
 * News RSS connector — live public collection with zero credentials.
 *
 * Reads publisher RSS/Atom feeds directly. `collect({query})` treats the
 * query as a feed key (the scheduler stores one row per publication), which
 * mirrors how the YouTube connector treats a channel id.
 *
 * Feeds vary far more than YouTube's uniform Atom output: RSS 2.0 and Atom,
 * `description` vs `content:encoded` vs `summary`, HTML-laden bodies,
 * inconsistent date formats, and images hidden in enclosures, media:content
 * or inline markup. All of that variation is absorbed here so the rest of
 * the pipeline sees one canonical shape.
 */
import { XMLParser } from "fast-xml-parser";
import type {
  CollectionQuery,
  NormalizedMention,
  RawSourceItem,
  SourceConnector,
} from "@/types/core";
import { normalizeRawItem } from "@/ingestion/normalization";
import { NEWS_FEEDS, type NewsFeed } from "./feeds";

export interface NewsRssPayload {
  payloadKind: "news-rss-item";
  articleId: string;
  headline: string;
  body: string | null;
  outlet: string;
  feedKey: string;
  section: string | null;
  language: string;
  publishedAt: string | null;
  url: string;
  imageUrl: string | null;
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if ("#text" in record) return text(record["#text"]);
    if ("@_url" in record) return text(record["@_url"]);
    if ("@_href" in record) return text(record["@_href"]);
  }
  return null;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Publisher feeds routinely ship HTML in the description. Strip it to plain
 * text before it reaches the intelligence layer, keeping paragraph breaks so
 * the boilerplate stripper still has line structure to work with.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&#8217;/gi, "'")
    .replace(/&#8216;/gi, "'")
    .replace(/&#82(2|1)0;/gi, '"')
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/** Pull an image from the several places feeds hide one. */
function extractImage(item: Record<string, unknown>): string | null {
  const enclosure = item["enclosure"];
  const enclosureUrl = text(enclosure);
  if (enclosureUrl && /^https?:\/\//.test(enclosureUrl)) return enclosureUrl;

  for (const key of ["media:content", "media:thumbnail"]) {
    const media = asArray(item[key] as unknown)[0];
    const url = text(media);
    if (url && /^https?:\/\//.test(url)) return url;
  }

  const bodyish = [item["content:encoded"], item["description"], item["summary"]]
    .map((v) => (typeof v === "string" ? v : text(v)))
    .find((v) => typeof v === "string" && v.includes("<img"));
  if (typeof bodyish === "string") {
    const match = bodyish.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) return match[1];
  }
  return null;
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseNewsFeed(xml: string, feed: NewsFeed): NewsRssPayload[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });
  const parsed = parser.parse(xml) as Record<string, unknown>;

  // RSS 2.0: rss > channel > item. Atom: feed > entry.
  const rss = parsed["rss"] as Record<string, unknown> | undefined;
  const channel = rss?.["channel"] as Record<string, unknown> | undefined;
  const atom = parsed["feed"] as Record<string, unknown> | undefined;
  const rawItems = channel ? asArray(channel["item"]) : asArray(atom?.["entry"]);

  const out: NewsRssPayload[] = [];
  for (const raw of rawItems) {
    const item = raw as Record<string, unknown>;

    const headline = text(item["title"]);
    if (!headline) continue;

    let url = text(item["link"]);
    if (!url) {
      // Atom puts the URL in a link element's href attribute.
      const links = asArray(item["link"] as unknown);
      url = links.map((l) => text(l)).find((u) => u && /^https?:\/\//.test(u)) ?? null;
    }
    if (!url) continue;

    const bodyRaw =
      text(item["content:encoded"]) ?? text(item["description"]) ?? text(item["summary"]);
    const body = bodyRaw ? htmlToText(bodyRaw) : null;

    const publishedAt =
      parseDate(text(item["pubDate"])) ??
      parseDate(text(item["published"])) ??
      parseDate(text(item["updated"])) ??
      parseDate(text(item["dc:date"]));

    // Stable id: prefer the feed's own guid, else the canonical URL.
    const guid = text(item["guid"]) ?? text(item["id"]) ?? url;

    out.push({
      payloadKind: "news-rss-item",
      articleId: guid,
      headline: htmlToText(headline),
      body,
      outlet: feed.name,
      feedKey: feed.key,
      section: text(item["category"]),
      language: feed.language,
      publishedAt,
      url,
      imageUrl: extractImage(item),
    });
  }
  return out;
}

export class NewsRssConnector implements SourceConnector {
  key = "news-rss";
  platform = "news" as const;

  /** Injectable for tests. Retries transient publisher errors. */
  fetchXml: (url: string) => Promise<string> = async (url) => {
    const delays = [0, 2000, 6000];
    let lastError: unknown;
    for (const delay of delays) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        const response = await fetch(url, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            accept: "application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(
      `News feed fetch failed for ${url}: ${
        lastError instanceof Error ? lastError.message : lastError
      }`,
    );
  };

  async collect(query: CollectionQuery): Promise<RawSourceItem[]> {
    const feedKey = query.query;
    const feed = NEWS_FEEDS.find((f) => f.key === feedKey);
    if (!feed) throw new Error(`Unknown news feed: ${feedKey}`);

    const xml = await this.fetchXml(feed.url);
    const items = parseNewsFeed(xml, feed);
    const collectedAt = new Date();

    return items.slice(0, query.limit ?? 40).map((payload) => ({
      platform: "news" as const,
      externalId: payload.articleId,
      payload,
      collectedAt,
      dataOrigin: "live" as const,
    }));
  }

  async normalize(item: RawSourceItem): Promise<NormalizedMention> {
    const payload = item.payload as NewsRssPayload;
    const mention = normalizeRawItem(item, {
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
    });
    mention.thumbnailUrl = payload.imageUrl;
    // Articles carry their text in the feed; there is no separate transcript
    // concept, so the field is explicitly not applicable rather than unknown.
    mention.transcriptStatus = "not_applicable";
    return mention;
  }
}
