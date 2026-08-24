# Intelligence model

_Phase 1. Describes the implemented pipeline, stage by stage._

## Canonical mention

Every public item becomes one `mentions` row (see `src/db/schema`). Fields
that cannot be evidenced stay `null` — the system never invents districts,
claims, translations, engagement or author attributes. Arrays (`topics`,
`crops`, `schemes`, `government_entities`) allow multiple assignments.

## Stage 1 — relevance gate (`src/intelligence/relevance`)

Deterministic, ontology-driven, runs before anything expensive.

- **Telangana relevance**: explicit state marker (+0.6), district name
  (+0.5), author/organisation anchored to Telangana (+0.4, e.g. an official
  account of the state government — official statements often say "across the
  state" without naming it). Out-of-state markers zero it when no in-content
  Telangana evidence exists, and dampen it (−0.3) otherwise.
- **Agriculture relevance**: 0.35 per matching term family (markers, topics,
  crops, inputs, schemes, government entities), capped at 1. The author
  context is deliberately **excluded** here: a Telangana farmer's cricket post
  must still be rejected.
- Accept iff Telangana ≥ 0.4 AND agriculture ≥ 0.35. The reason string names
  exactly which families matched or failed and is stored on the mention.

## Stage 2 — enrichment (`src/intelligence/enrichment`)

One Zod contract (`EnrichmentResultSchema`) that every enricher must satisfy;
nothing unvalidated reaches the database or UI.

- **HeuristicEnricher** (active by default): ontology matching for topics /
  subtopics / crops / schemes / entities; Unicode-ratio language detection;
  district+mandal extraction with confidence (0.92 mandal-level, 0.85 single
  district, 0.6 multi-district); keyword-lexicon sentiment; negation-aware
  ("no shortage" strips reassurance phrases before counting complaint
  markers); author-type classification from bio/name signals with confidence;
  conservative template claims (DAP-availability cases only).
- **LlmEnricher** (wired, inactive until `AI_GATEWAY_API_KEY` is set): the
  same contract through `generateObject` (Vercel AI SDK), prompt constrained
  to ontology ids, translation for Telugu/mixed content.
- Every enrichment stores `{provider, model, promptVersion, durationMs,
  success, enrichedAt}` on the mention and in an `ENRICHED` /
  `ENRICHMENT_FAILED` event. Failures never crash the stage.

## Stage 3 — deduplication (`src/intelligence/dedup`)

- **Exact**: sha256 over normalized text (lowercased, punctuation stripped,
  letters + combining marks kept — Telugu matras are `\p{M}` and must
  survive normalization).
- **Near**: word-bigram Jaccard ≥ 0.4 AND unigram Jaccard ≥ 0.6, calibrated
  against the corpus (syndicated light rewrite ≈ 0.55/0.78; closest distinct
  pair ≈ 0.17/0.41). Earliest-published item is canonical.
- Duplicates keep `status = "duplicate"` with `duplicate_of_mention_id` and
  are retained as evidence, displayed nested under their canonical item, and
  **never counted** in narrative or finding aggregates.

## Stage 4 — narratives (`src/intelligence/narratives`)

Phase 1 assignment is rule-based (`NARRATIVE_DEFINITIONS`: predicates over
enriched fields, `assigned_by = "rule"`). Aggregation over canonical mentions
only:

- mention count, unique authors, source mix, voice mix, district counts,
  first/last detected, stance summary;
- **stance_by_voice** — stance distribution partitioned into official /
  media / public voice classes. This is the raw material for divergence.
- A template executive summary composed only from computed aggregates.
- Confidence = min(0.95, 0.3 + 0.05·authors + 0.08·sourceTypes) — a stated
  formula, not a model output.
- One `narrative_snapshots` row per run (future trend detection input).

## Stage 5 — findings (`src/intelligence/findings`)

Category thresholds (deliberately legible):

- **emerging**: ≥ 6 distinct items AND ≥ 2 districts AND ≥ 3 source types;
- **watch**: ≥ 2 distinct items.

**Divergence** is computed, not asserted: official voices lean supportive of
the government position AND ≥ 50% of stance-carrying public voices are
critical. The finding page shows the underlying stance-by-voice counts.

Every finding stores named `components` (independent voices, district list,
source types, farmer-originated share, critical share, divergence flag,
duplicates excluded) plus a human-readable `reason` naming the thresholds it
crossed. Ranking is a documented bounded sum over components
(`rankScore` in `findings/stage.ts`) — no opaque score exists anywhere.

Copy is composed from templates driven by components (e.g. "12 independent
voices across 5 source types… official statements describe the situation as
under control while public reports describe local problems").

## Event trail

Every transition emits a `processing_events` row referencing the entities it
touched: `COLLECTED, NORMALIZED, RELEVANCE_ACCEPTED/REJECTED, ENRICHED,
ENRICHMENT_FAILED, DEDUPED, NARRATIVE_ASSIGNED, NARRATIVE_UPDATED,
FINDING_GENERATED`. `npm run trace -- <external-id>` prints the complete
chain for any record.
