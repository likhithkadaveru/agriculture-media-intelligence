# Data sources

_Phase 2. Documents what is implemented and actually collecting._

## Active: YouTube RSS (`youtube-rss`)

The primary live source. Uses YouTube's official, key-free feed endpoint:

```
https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>
```

Each feed returns the channel's ~15 most recent uploads with video id, title,
description, published/updated timestamps, thumbnail URL, view count and like
count. No credential is required, which is why live collection works today.

**Retries.** YouTube intermittently answers 404/500 to rapid sequential feed
requests even for valid channels. The connector retries three times with
backoff (0s, 1.5s, 4s) before reporting a channel as failed, so a transient
error is not mistaken for a dead channel.

**Channel registry** (`src/ingestion/connectors/youtube-rss/channels.ts`) —
every channel id was resolved from its public page and its feed verified live.
Registry kinds seed classification priors only; enrichment still classifies
each item with confidence.

| Kind | Channels |
|---|---|
| Telugu news | V6 News Telugu, TV9 Telugu Live, 10TV News Telugu, ABN Telugu, Sakshi TV, NTV Live, hmtv |
| Agriculture programme | ETV Annadata, Raithu Nestham |
| Agriculture creators | Agri Telugu, VYAVASAYAM వ్యవసాయం, Karshaka Mitra, hmr TELUGU AGRICULTURE, Saraswathi Agriculture Telugu |
| Government | Telangana CMO |

Creator channels cover both Telangana and Andhra Pradesh, so the Telangana
relevance gate does real work on their output; they contribute creator and
expert voices that news channels do not.

**Transcripts are never fetched or fabricated.** Every YouTube mention records
`transcript_status = "unavailable"`, and the UI states that the item was
analysed from title, description and metadata.

## Wired, dormant: YouTube Data API v3 (`youtube-api`)

Activates the moment `YOUTUBE_API_KEY` is set — no code change. It is the
preferred *discovery* path (RSS only sees channels we already know; search
finds farmer and district voices we do not).

Quota model at the default 10,000 units/day:

| Call | Cost | Use |
|---|---|---|
| `search.list` | 100 units | discovery — the expensive step |
| `videos.list` | 1 unit (50 ids) | hydration — cheap |

The scheduler caps API queries at 8 per cycle, so a full cycle costs ~800
units and can run roughly twelve times a day inside the free quota.

## Wired, dormant: Apify adapter (`ApifyConnectorAdapter`)

The generic seam for Phase 3 sources (X, Instagram, additional news). An
Apify-backed source is declared, not coded:

```ts
interface ApifySourceSpec {
  key: string;                 // connector registry key
  platform: Platform;          // routes to an existing normalizer
  actorId: string;             // e.g. "apidojo/tweet-scraper"
  buildInput(query): object;   // scheduler query → actor input
  parseItem(item): { externalId, payload } | null;
}
```

The adapter runs the actor, maps dataset items to `RawSourceItem`s, and hands
them to the same platform normalizers. Nothing downstream ever sees an Apify
response shape, and no UI change is required to add one. Dormant without
`APIFY_API_TOKEN`; no actors are registered in Phase 2.

## Query scheduler

`collection_queries` holds all planned collection work, with tiers that keep
quota bounded:

| Tier | Content | Frequency |
|---|---|---|
| A | 15 channel polls + 10 core terms (English + Telugu) | every 6h |
| B | 17 crop/issue × Telangana queries | every 24h |
| C | 264 issue × district combinations (4 issues × 33 districts × 2 languages) | weekly rotation |

306 queries are planned in total; the scheduler executes only those whose
`next_run_at` has passed, ordered by tier then priority. Per-query yield
(`items_returned`, `relevant_items`, `duplicate_items`) accumulates after each
intelligence pass so unproductive queries can be deprioritized — see
`npm run quality`.

## Not built (deliberately)

X/Twitter, Instagram, Facebook, news RSS, and GDELT are all out of scope for
Phase 2. The connector interface and the Apify seam are what make them
additive rather than structural.

## Compliance

Only public endpoints are used: YouTube's own published feeds, and (when
configured) the official Data API under its terms. No private groups, no
direct messages, no restricted accounts, no logged-in scraping, no attempt to
bypass access controls. Collection is of public discourse in aggregate, not
surveillance of individuals.
