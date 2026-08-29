# Telangana Agriculture Intelligence Command Centre

A public-intelligence platform for the Telangana agriculture ecosystem. It
collects public discourse (currently YouTube: Telugu news, agriculture
programmes, farming creators, official government channels), understands it in
Telugu and English, and turns it into a small number of things Agriculture
Department leadership should know today — each traceable to the evidence that
produced it.

**Status: Phase 2 — live public data.** The system collects real public
content, enriches it with schema-validated LLM extraction, derives narratives,
and serves them through NOW, Narratives, Narrative Detail and Evidence
surfaces. **No credentials are required to run it.**

## Quick start

```bash
npm install
npm run pipeline   # live collection + intelligence (no API keys needed)
npm run dev        # open http://localhost:3000
```

The pipeline is idempotent. Without `DATABASE_URL` it uses an embedded PGlite
database in `.data/` (delete to reset). See `.env.example` and
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for optional credentials.

> PGlite allows one connection per data directory: run the pipeline and the
> dev server sequentially. Setting `DATABASE_URL` removes this constraint.

Other commands:

```bash
npm run pipeline:seed                 # fictional development corpus instead of live data
npm test                              # 37 tests, in-memory database
npm run quality                       # data-quality + query-yield report
npm run trace -- <external-id>        # full provenance chain for one record
npm run audit:relevance               # docs/LIVE_RELEVANCE_AUDIT.md (also :voice, :dedup)
npm run snapshot:create -- --label "…"  # frozen, verifiable copy of live state
```

## Two surfaces, deliberately

Senior officers do not browse products. There are exactly two screens:

- **The command screen** (`/`) — the whole operational picture in one scroll:
  where the crop season stands, what needs attention (ranked), what is going
  well, which districts carry evidence, who is talking, where it came from,
  and the collected media itself.
- **The evidence view** (`/findings/[id]`, `/narratives/[id]`) — everything
  behind any single item: original Telugu verbatim, labelled English
  translation, author classification with confidence, district with
  confidence, extracted claims, timeline, the processing trail, and
  duplicates shown but never counted.

A ribbon states which evidence is on screen — **Live public data**, **Verified
snapshot**, or **Development data** — computed from the lineage of the active
findings, not from whatever sits in the database.

## How it works

```
connectors (SourceConnector) → raw_items (immutable) → mentions (canonical)
  → boilerplate stripping (content_text; original_text kept verbatim)
  → relevance gate (agriculture-first, deterministic, free)
  → enrichment (Zod-validated; Claude CLI / AI Gateway / heuristic)
      └─ model relevance confirmation (demotes non-substantive items)
  → dedup (exact hash + near, title-gated)
  → narratives (ontology-derived, subtopic-split, origin-partitioned)
      └─ LLM adjudication (title + synthesis, deterministic fallback kept)
  → findings (explainable components) → evidence links
```

Jobs are plain functions behind an application-level job layer — nothing
imports a scheduler, so the execution backend can move without touching
connectors or intelligence stages. Every pipeline transition writes a
`processing_events` row.

## Documentation

| Document | Contents |
|---|---|
| [PRODUCT_VISION](docs/PRODUCT_VISION.md) | What this is and the principles constraining it |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Stack, boundaries, identifiers, idempotency |
| [DATA_SOURCES](docs/DATA_SOURCES.md) | Channel registry, quota model, Apify seam, compliance |
| [ONTOLOGY](docs/ONTOLOGY.md) | Bilingual ontology, coverage, disambiguation, query tiers |
| [INTELLIGENCE_MODEL](docs/INTELLIGENCE_MODEL.md) | Every pipeline stage as implemented |
| [TRUST_AND_PROVENANCE](docs/TRUST_AND_PROVENANCE.md) | Guarantees, `data_origin`, snapshots |
| [DEPLOYMENT](docs/DEPLOYMENT.md) | Credentials (all optional), operations, scheduling |
| LIVE_*_AUDIT | Generated relevance / voice / dedup audits over live data |

## Repository layout

```
src/
  app/            NOW, Narratives, Narrative Detail, Finding Detail
  components/     evidence card, mix bars, timeline, badges
  db/             Drizzle schema, migrations, client, read-model queries
  ingestion/      connectors (youtube-rss, youtube-api, apify, demo-seed),
                  normalization, boilerplate, router, scheduler, jobs
  intelligence/   relevance, enrichment, dedup, narratives, findings, snapshot
  ontology/       bilingual ontology + query generation
scripts/          pipeline, migrate, trace, snapshot, quality, audits
docs/
```
