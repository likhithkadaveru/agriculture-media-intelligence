# Deployment and operations

_Phase 2._

## Credentials: required vs optional

**Nothing is required to run the system.** It collects live public data,
enriches it, and serves intelligence with zero credentials configured.

| Variable | Status | Without it |
|---|---|---|
| `DATABASE_URL` | Optional | Embedded PGlite in `.data/pglite` (same schema, same migrations) |
| — LLM — | | |
| `AI_GATEWAY_API_KEY` | Optional | Falls back to the local Claude Code CLI, then to the deterministic enricher |
| `LLM_MODEL` | Optional | Defaults to `anthropic/claude-sonnet-4-5` (gateway path only) |
| `CLAUDE_CLI_MODEL` | Optional | Defaults to `haiku` |
| `ENRICHER` | Optional | Force `heuristic` \| `gateway` \| `claude-cli` instead of auto-selection |
| — Sources — | | |
| `YOUTUBE_API_KEY` | Optional | RSS collection only; search discovery stays dormant |
| `APIFY_API_TOKEN` | Optional | Apify seam stays dormant; no actors registered yet |

### Enricher selection

```
AI_GATEWAY_API_KEY set  → LlmEnricher      (Vercel AI SDK, generateObject)
claude CLI on PATH      → ClaudeCliEnricher (headless `claude -p`)
neither                 → HeuristicEnricher (deterministic ontology rules)
```

All three satisfy the same Zod contract. Which one ran is recorded per mention
in `enrichment_meta` and shown in the UI's provenance block. Only model-backed
enrichers perform relevance confirmation; the heuristic enricher does not
demote items, because it cannot judge substance.

### What each credential unlocks

- **`YOUTUBE_API_KEY`** — the highest-value addition. RSS only sees the 15
  most recent uploads of channels we already know. Search discovery finds
  district-level farmer voices, small creators and coverage the registry
  misses. Free tier (10,000 units/day) supports ~12 full cycles per day at
  the scheduler's current caps.
- **`AI_GATEWAY_API_KEY`** — production enrichment path, and the single
  biggest throughput win. The Claude CLI bridge spawns a full CLI process per
  item and measures **~30 seconds per mention**, serially: a 100-item batch
  takes roughly an hour. The gateway path issues ordinary API calls (seconds
  per item, parallelisable), so enrichment stops being the pipeline's
  bottleneck. The CLI bridge exists so the system works with zero credentials
  during development; it is not appropriate for a server.
- **`APIFY_API_TOKEN`** — Phase 3 sources (X, Instagram) via the adapter seam.
- **`DATABASE_URL`** — required for real deployment; PGlite is single-process
  and single-connection.

## Local operation

```bash
npm install
npm run pipeline          # live collection + intelligence
npm run dev               # UI at http://localhost:3000
```

```bash
npm run pipeline:seed     # development corpus instead of live data
npm test                  # 28 tests, in-memory database
npm run quality           # internal data-quality + query-yield report
npm run trace -- <id>     # full provenance chain for one record
```

Audit reports:

```bash
npm run audit:relevance   # docs/LIVE_RELEVANCE_AUDIT.md
npm run audit:voice       # docs/LIVE_VOICE_AUDIT.md
npm run audit:dedup       # docs/LIVE_DEDUP_AUDIT.md
```

Verified snapshot for demonstrations:

```bash
npm run snapshot:create -- --label "2026-08 Telangana Agriculture Demo"
```

### PGlite constraint

PGlite allows one connection per data directory. Run the pipeline and the dev
server sequentially, not concurrently. A real Postgres has no such limit; set
`DATABASE_URL` to remove the constraint entirely.

## Scheduling

The job layer (`src/ingestion/jobs`) is deliberately scheduler-agnostic — no
module imports Vercel Cron, Trigger.dev or Temporal. Any backend that can call

```ts
await runJob("collectLive", ctx);
await runJob("runIntelligence", ctx);
```

can drive the system. Phase 2 drives it from a CLI script. Moving to a hosted
scheduler means writing a caller, not touching connectors or intelligence
stages.

Suggested cadence once deployed: `collectLive` every 6 hours (matching Tier A
frequency), `runIntelligence` immediately after each collection.

## Deploying to Vercel

1. Provision Postgres through the Vercel Marketplace (Neon), set
   `DATABASE_URL`.
2. Set `AI_GATEWAY_API_KEY` (and optionally `YOUTUBE_API_KEY`).
3. `npm run db:migrate` against the provisioned database.
4. Deploy. The UI is server-rendered and reads only precomputed aggregates.
5. Drive the jobs from Vercel Cron routes that call `runJob`, or from any
   external scheduler.

Enrichment is long-running (seconds per item), so run it as a background job,
never inside a request handler.
