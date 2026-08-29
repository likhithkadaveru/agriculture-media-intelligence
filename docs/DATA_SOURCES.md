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

**Rate limiting is the main operational constraint.** YouTube throttles
repeated feed polling from one address, answering 404/500 for channels that
are perfectly valid and served correctly minutes earlier. Observed in live
operation: running several full cycles within an hour caused most channels to
fail. The connector retries five times with jittered backoff (0s, ~2s, ~6s,
~15s, ~25s) before reporting a channel as failed, so a transient throttle is
not mistaken for a dead channel.

Failed queries are **not** marked as run, so their `next_run_at` stays null and
the next cycle retries them immediately, while successful ones wait out their
6-hour interval. Re-running the pipeline therefore tops up missing channels
without re-collecting or re-enriching what already landed.

At the intended production cadence (one cycle every 6 hours) this throttling
is not expected to bite; it is a development-time hazard from running cycles
back to back.

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

## Active: news RSS (`news-rss`)

Fifteen publisher feeds, every one probed through the real parser before
being added, all credential-free. Five publish in Telugu, ten in English.

| Publication | Language | Scope |
|---|---|---|
| V6 Velugu | Telugu | Telangana |
| NTV Telugu | Telugu | Telugu-general |
| Sakshi | Telugu | Telugu-general |
| OneIndia Telugu | Telugu | Telugu-general |
| Telangana Today | English | Telangana |
| The Hans India — Telangana | English | Telangana |
| The Hindu — Telangana | English | Telangana |
| Deccan Chronicle | English | Telugu-general |
| NDTV South | English | National — kept for escalation detection |
| Mana Telangana | Telugu | Telangana — 125 items per poll |
| Telangana Today — Telangana desk | English | Telangana — district desk, richest source of district-named stories |
| The Hindu — Agriculture | English | National agriculture desk — low noise |
| BusinessLine — Agri Business | English | Procurement, MSP, market prices |
| Agriculture Post | English | National agriculture trade press |
| Times of India — Hyderabad | English | Headline-only; contributes titles, not bodies |

### Feeds tested and rejected

Candidates are probed through the parser, not assumed. Rejected so far:
Namasthe Telangana (malformed XML — nesting exceeds the parser's limit),
Prajasakti and Down To Earth (feeds return zero items), Krishi Jagran
(timeout / 404), and **Reddit**, whose public JSON API now returns 403
without OAuth. A source that cannot be collected reliably is worse than no
source, because it makes coverage look broader than it is.

Feeds vary far more than YouTube's uniform Atom output: RSS 2.0 and Atom,
`description` vs `content:encoded` vs `summary`, HTML-laden bodies,
inconsistent date formats, and images in enclosures, `media:content` or inline
markup. The connector absorbs all of it so the pipeline sees one shape, and
strips HTML to plain text while preserving line structure for the boilerplate
stage. Polled every 4 hours — a Telangana desk turns over faster than a
channel's upload schedule.

## Transcription — what is and is not possible

**Third-party YouTube videos cannot be legitimately transcribed.** Both public
caption endpoints (`video.google.com/timedtext` and
`youtube.com/api/timedtext`) now return empty responses; the Data API's
`captions.download` requires OAuth as the video's owner. Downloading audio for
speech recognition would breach YouTube's terms.

So video mentions record `transcript_status = "unavailable"` and are analysed
from title, description and metadata — which the interface states on every
affected card rather than implying fuller analysis than occurred.

What *is* available, and worth having:

- **Telugu text is already fully processed** — detected, translated and
  analysed end to end. The language barrier is solved for text.
- **YouTube comments** (Data API, needs `YOUTUBE_API_KEY`) are often a better
  source of farmer voice than a broadcast transcript, since they carry the
  audience rather than the presenter.
- **Government-owned video** can be transcribed legitimately, because the
  department owns the asset and can authorise it.

## Active when configured: Apify (`apify-x-search`)

X / Twitter search through the Apify adapter. This is the source that brings
**individual farmer voices** in — YouTube and news supply broadcasters and
publishers; X supplies people.

| | |
|---|---|
| Actor | `apidojo/tweet-scraper` (Tweet Scraper V2) |
| Verified | actor id and input schema checked against Apify's public actor API |
| Input | `searchTerms`, `maxItems`, `sort: "Latest"`, `onlyVerifiedUsers: false` |
| Terms | the ten Tier A core terms, English and Telugu |
| Cadence | every 12 hours, capped at 6 actor runs per cycle |

**Sorted by Latest, never Top.** An emerging complaint has no engagement yet,
so ranking by engagement would systematically hide exactly the early signal
this system exists to find.

**Cost control is deliberate.** Apify bills per result, so the scheduler seeds
only core terms at a slow cadence — roughly 20 runs a day, against hundreds of
free feed polls. Query rows are seeded whether or not a token is present, so
the plan is visible in `npm run quality` before anything is paid for; the job
layer skips the connector when `APIFY_API_TOKEN` is unset.

Raise the limits deliberately in two places: `frequencyHours` in the scheduler
seed, and the per-cycle cap in `src/ingestion/jobs`.

### Registered but not scheduled: Instagram

`apify/instagram-hashtag-scraper`, public hashtag content only — never private
accounts, followers or direct messages. Registered so it can be enabled with
one line, but left out of the schedule: Instagram agriculture content skews
heavily promotional and should demonstrate yield before it competes with X for
budget.

### Setup

The token goes in `.env.local`, which is git-ignored:

```
APIFY_API_TOKEN=apify_api_xxxxxxxx
```

Nothing else changes — the connector registers itself and the scheduler
already holds its queries.
