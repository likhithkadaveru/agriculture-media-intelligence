# Telangana Agriculture Intelligence Command Centre

A public-intelligence platform for the Telangana agriculture ecosystem: it
collects public content (news, YouTube, X-style posts, official statements,
public web), normalizes it into a canonical evidence model, runs an
explainable intelligence pipeline (relevance → enrichment → deduplication →
narratives → findings), and presents ranked, fully-traceable intelligence to
Agriculture Department leadership.

**Status: Phase 1 — foundation + one complete vertical slice.**
The chain `source item → raw item → mention → enrichment → narrative →
finding → NOW UI → evidence detail` works end to end on a clearly-marked
development corpus (`data_origin = demo_seed`). No external credentials are
required to run it.

## Quick start

```bash
npm install
npm run pipeline   # ingest demo corpus + run the intelligence pipeline
npm run dev        # open http://localhost:3000
```

The pipeline is idempotent — run it as often as you like. Without a
`DATABASE_URL` it uses an embedded PGlite database in `.data/` (delete that
directory to reset). See `.env.example` for optional credentials.

Other commands:

```bash
npm test                       # fast test suite (in-memory database)
npm run trace -- seed-x-001    # print the full provenance chain for one record
npm run db:generate            # regenerate SQL migrations after schema changes
npm run typecheck
```

## What you will see

- **NOW** (`/`) — ranked intelligence findings: what changed, why it matters,
  where, who is talking, with explainable component metrics (independent
  voices, districts, source types, farmer-originated share, duplicates
  excluded). No opaque scores.
- **Evidence detail** (`/findings/[id]`) — the trust surface: every underlying
  item with original Telugu, labelled English translation, author/voice
  classification with confidence, district with confidence, stance,
  engagement, source link, a collapsible AI-interpretation block, the full
  processing-event trail, and duplicates shown but never counted.

A permanent ribbon marks the environment as **development data** whenever
`demo_seed` content is present. Nothing in the seed corpus is a real post,
person, outlet or claim.

## Architecture (short version)

```
connectors (SourceConnector) → raw_items (immutable) → mentions (canonical)
  → relevance gate (deterministic, ontology) → enrichment (Zod-validated;
    heuristic today, LLM behind the same interface) → dedup (exact + near)
  → narratives (rule-assigned Phase 1, aggregates + snapshots)
  → intelligence findings (explainable components) → evidence links
```

- Jobs are plain functions behind an application-level job layer
  (`src/ingestion/jobs`) — no scheduler coupling; any backend that can call
  `runJob()` can drive ingestion.
- Every pipeline transition writes a `processing_events` row; every UI
  conclusion traces to raw evidence.
- Full details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
  [docs/INTELLIGENCE_MODEL.md](docs/INTELLIGENCE_MODEL.md),
  [docs/TRUST_AND_PROVENANCE.md](docs/TRUST_AND_PROVENANCE.md).

## Repository layout

```
src/
  app/            NOW + finding/evidence pages (Next.js App Router)
  components/     UI building blocks (evidence card, mix bars, badges)
  db/             Drizzle schema, migrations, client, read-model queries
  ingestion/      connectors, normalization, router, job layer
  intelligence/   relevance, enrichment, dedup, narratives, findings
  ontology/       bilingual (English/Telugu) listening ontology
  types/          shared domain types
scripts/          pipeline runner, migration runner, provenance trace
docs/             architecture & trust documentation
```
