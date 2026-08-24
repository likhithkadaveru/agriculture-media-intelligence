# Trust and provenance

_Phase 1. These are implemented guarantees, verified by tests where noted._

## Principles

1. **Every conclusion traces to evidence.** A finding links to a narrative;
   the narrative links to mentions; every mention links to an immutable raw
   payload and a processing-event trail. The UI exposes this chain
   (finding page → evidence cards → "AI interpretation & provenance"), and
   `npm run trace` prints it end to end. _(tested: evidence linkage,
   event trail)_

2. **Source content and AI interpretation never mix.** Evidence cards show
   the original text verbatim, in its original script. Translations are a
   separate, labelled block that never replaces the original, with explicit
   provenance: `seed_authored` (development translations written alongside
   the fictional corpus) or `llm`. Model-derived fields (claim, stance,
   sentiment, relevance scores, classifications) live in a collapsed block
   labelled "AI interpretation".

3. **No opaque scores.** Findings carry named component metrics and a
   human-readable reason naming the exact thresholds crossed. Divergence is
   the display of stance-by-voice counts, not a number from a black box.
   Confidence values are outputs of stated formulas.

4. **Unknown stays unknown.** Districts are assigned only from in-text
   evidence, with stored confidence; mentions without location evidence are
   shown as "District not evidenced" rather than forced onto a map or into a
   bucket. Missing engagement, translation, claim and author fields stay
   null.

5. **Duplicates are evidence, not volume.** Syndicated and near-duplicate
   copies remain visible (nested under their canonical item, labelled
   "not counted toward volume") and are excluded from every count.
   _(tested: narrative aggregation excludes duplicates)_

6. **Structured outputs are validated.** Every enricher — including the
   future LLM path — must produce output that parses against
   `EnrichmentResultSchema` (Zod). Malformed model output is a recorded
   failure event, never a UI artifact. _(tested: schema validation,
   failure-event recording)_

## data_origin discipline

Every data-bearing row carries `data_origin`:

| value | meaning |
|---|---|
| `live` | collected from real public sources by a live connector |
| `verified_snapshot` | a frozen, timestamped capture of previously-collected real data (Phase 2) |
| `demo_seed` | fictional development corpus |

- The seed corpus is fictional end to end: invented authors and outlets with
  "(demo)" suffixes, `demo.invalid` URLs, invented engagement numbers. It
  exists solely to exercise the pipeline and UI without credentials.
- The UI derives its environment ribbon from origins present in the data:
  when `demo_seed` is present (and no live data), every page carries
  "Development data — fictional demo_seed corpus. No real posts, people or
  claims." Individual findings and evidence cards also display their origin.
- Replacing seed with live collection requires configuring credentials and
  registering a live connector — no UI changes. _(tested: data_origin
  preserved through the whole pipeline)_

## Author classification limits

Author types (farmer, farmer organisation, FPO, media, government, creator,
dealer, citizen, …) are classified with stored confidence and displayed with
it. The system does not infer political affiliation and does not invent
demographic attributes. `unknown` is an honest and permitted class.

## Claims

Claim extraction is deliberately conservative in Phase 1 (template-based,
DAP-availability cases only, confidence ≤ 0.75 without district evidence).
There is no "misinformation" label anywhere in the system; contested claims
are represented by showing official and public positions side by side with
their evidence.
