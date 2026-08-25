# Intelligence model

_Phase 2. Describes the implemented pipeline, stage by stage._

## Two-stage relevance (the shape live data forced)

Relevance is a funnel, not a single test:

```
deterministic gate (free, recall-oriented)
        ↓ passes
LLM enrichment + relevance confirmation (precision)
        ↓ confirms
narratives and findings
```

The first live run exposed that the original single-stage design was
**inverted**. Telangana political content — official channel press releases,
CM coverage — is saturated with state markers and mentions "farmers" once in
passing, so it flooded through the gate and consumed enrichment budget.
Meanwhile genuine Telugu farming content was discarded for free, because it
discusses paddy, urea and pests without ever naming the state. The system was
paying to reject noise and throwing away signal.

Three corrections, each visible in code:

1. **Agriculture-first, title-weighted.** A real agriculture story says so in
   its headline; a passing mention in a press-release body does not. Content
   with no agriculture evidence is now rejected deterministically and never
   reaches the model.
2. **Agriculture-specific government entities.** "Chief Minister" is not
   agriculture evidence. `GovernmentEntityEntry.agricultureSpecific`
   separates the Agriculture Department and PJTSAU from the CMO and district
   collectors.
3. **Regional prior for agriculture-dedicated sources.** Telugu farming
   channels cover both Telangana and Andhra Pradesh and rarely name either.
   They now pass the gate on a weak prior so the model — which reads context
   properly — decides state relevance, instead of the gate discarding them.

Model confirmation then demotes anything scoring below 0.5 on either axis,
recording a `RELEVANCE_REJECTED` event with `stage: "model_confirmation"` and
both scores. Only model-backed enrichers do this; the deterministic enricher
never demotes, because it cannot judge substance.

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

## Stage 2.5 — boilerplate stripping (`src/ingestion/normalization/boilerplate.ts`)

Real YouTube descriptions are mostly channel promotion: subscribe CTAs, URLs,
hashtag blocks and SEO keyword tails. In one observed case ~1,500 of 1,923
characters were boilerplate. This caused two distinct defects at once:

- **False duplicates** — unrelated videos from one channel scored 0.75–0.97
  similarity purely on shared promo text.
- **False relevance** — an Andhra Pradesh story was accepted as Telangana
  because the SEO tail contained "Telangana News Today".

So mentions carry a derived `content_text` (boilerplate removed) alongside the
verbatim `original_text`. Relevance, deduplication and enrichment read
`content_text`; evidence display keeps `original_text`. Source content is
never altered — only what the intelligence layer reads is narrowed to what the
author actually wrote.

## Stage 3 — deduplication (`src/intelligence/dedup`)

Governing rule: **same content ≠ same claim.** Fourteen farmers independently
reporting a fertilizer shortage are fourteen voices, not one duplicate.

- **Exact**: sha256 over normalized `content_text` (lowercased, punctuation
  stripped, letters + combining marks kept — Telugu matras are `\p{M}` and
  must survive normalization).
- **Near**: three conditions must all hold — headline-core Jaccard ≥ 0.3,
  body bigram Jaccard ≥ 0.4, body unigram Jaccard ≥ 0.6.
- **The title gate** exists because body similarity alone proved insufficient
  on live data. The headline core is the first pipe-separated segment (where
  Telugu news titles carry the story) minus broadcast stopwords (`live`,
  `news`, `tv`, `telugu`, …), so items from one channel do not inherit
  similarity from shared branding.

Calibration against real and seed pairs — genuine duplicates score 0.33–1.0 on
the title gate, false positives 0.00–0.18, leaving the 0.3 threshold in a
clear gap:

| Case | Title similarity |
|---|---|
| Syndicated story, rewritten headline | 0.33 |
| Same event, extended headline | 1.00 |
| Re-uploaded press meet | 1.00 |
| Different stories, same channel boilerplate | 0.00–0.06 |
| Independent farmers, same issue, different districts | 0.18 |

Earliest-published item is canonical.
- Duplicates keep `status = "duplicate"` with `duplicate_of_mention_id` and
  are retained as evidence, displayed nested under their canonical item, and
  **never counted** in narrative or finding aggregates.

## Stage 4 — narratives (`src/intelligence/narratives`)

Narratives are **derived from the ontology**, not hard-coded, and are strictly
partitioned by `data_origin` — live evidence and development evidence can
never meet inside one narrative.

Derivation (`deriveNarratives`):

- A **subtopic** with ≥3 distinct items becomes its own narrative, so one
  topic yields genuinely different conversations rather than a single bucket:
  `fertilizer-availability/dap-availability` and
  `fertilizer-availability/fertilizer-price` stay separate.
- Remaining topic-level items form a base topic narrative (≥2 items).
- One mention can evidence several narratives.

**LLM adjudication** (`adjudicate.ts`) then proposes a precise title and a
2–3 sentence synthesis grounded only in representative evidence, Zod-validated,
stored in `explanation`. The deterministic title and computed executive summary
always remain as fallback and are never overwritten by the model.

**Trend status** (`computeTrendStatus`) is observation-window based in Phase 2 —
no historical baseline exists yet: `emerging` (first evidence within 2 days),
`rising` (recent ≥ 1.5× prior window), `falling`, `resurfacing` (≥7-day quiet
gap before a new burst), `stable`.

Aggregation over canonical mentions only:

- mention count, unique authors, source mix, voice mix, district counts,
  first/last detected, stance summary;
- **stance_by_voice** — stance distribution partitioned into official /
  media / public voice classes. This is the raw material for divergence.
- A template executive summary composed only from computed aggregates.
- Confidence = min(0.95, 0.3 + 0.05·authors + 0.08·sourceTypes) — a stated
  formula, not a model output.
- One `narrative_snapshots` row per run, recording mention count, duplicate
  count, unique authors, source mix and type count, voice mix, districts and
  district count, stance mix, stance by voice, engagement totals,
  `newMentionsSincePrevious`, first/last seen, trend status and confidence.
  This series is the raw material Phase 3 needs for velocity and
  emerging-signal detection; trustworthy baselines require history that only
  accumulates by running.

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
