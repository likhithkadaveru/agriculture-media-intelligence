# Product vision

## The problem

Government of Telangana agriculture leadership can already read individual
articles and posts. What no one can do is see the *whole conversation*: what
farmers across 33 districts are saying right now, which concerns are spreading,
where they are concentrated, who is driving them, and whether public experience
matches the official position.

Existing tools answer "how many mentions, what sentiment". That is not an
operational question. "Fertilizer availability complaints are rising across
three districts, driven by farmer-originated reports, while official statements
describe supply as adequate" — that is.

## What this system is

A public-intelligence platform that collects Telangana agriculture discourse
from public sources, understands it in Telugu and English, and turns thousands
of items into a small number of things leadership should know today — each one
traceable to the evidence that produced it.

**It is not** a news-clipping dashboard, a sentiment tracker, or a BI report.
The unit of value is a *narrative with evidence*, not a metric.

## Principles that constrain the build

1. **Every conclusion traces to evidence.** A finding → a narrative → the
   mentions that support it → the immutable raw payload → the original public
   URL. `npm run trace` prints the whole chain for any record.
2. **AI interpretation is never disguised as source content.** Original Telugu
   appears verbatim; translation is a separate, labelled block; model-derived
   fields are collapsed under an "AI interpretation" heading.
3. **No opaque scores.** Findings carry named component metrics and state the
   thresholds they crossed. Divergence is the display of stance-by-voice
   counts, not a mystery number.
4. **Unknown stays unknown.** Districts are assigned only from evidence, with
   confidence; unlocated items are shown as unlocated rather than forced onto a
   map.
5. **Same content ≠ same claim.** Syndicated copies are collapsed;
   independent people reporting the same problem stay independent voices.
6. **Nothing is labelled misinformation.** Disagreement with an official
   position is not falsehood. Contested claims are shown as positions side by
   side, with their evidence.
7. **Public data only.** No private groups, no direct messages, no restricted
   accounts, no individual surveillance.

## Who it serves

Agriculture Department leadership, the Minister's office, district
administration, and communications teams — people who need to know what is
happening in the field before it becomes a headline, and who must be able to
verify any claim the system makes before acting on it.

## Where it stands

- **Phase 1** — foundation and one complete vertical slice on a fictional
  development corpus.
- **Phase 2** — live collection from public YouTube sources across Telugu news,
  agriculture programmes, farming creators and official government channels;
  real Telugu/English intelligence; narrative surfaces; verified snapshots.
- **Next** — search-based discovery (needs a YouTube API key), additional
  source families through the Apify seam, geographic map intelligence,
  historical baselines for genuine emerging-signal detection, and the natural
  language query surface.

## The test it must pass

A senior official opens the system and asks *"what should I know about
agriculture today?"* — sees a handful of meaningful findings, picks one, and
within seconds understands what happened, whether it is growing, where, who is
talking, what government says, whether public experience agrees, and can open
the original sources themselves.
