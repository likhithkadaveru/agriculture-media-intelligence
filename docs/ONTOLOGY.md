# Telangana agriculture ontology

_Phase 2. Configuration-driven; extending it requires no pipeline or UI code._

Everything the listening layer knows lives in `src/ontology/`:

| File | Contents |
|---|---|
| `types.ts` | Term shapes (`OntologyTerm`, `TopicEntry`, `DistrictEntry`, `GovernmentEntityEntry`) |
| `districts.ts` | All 33 Telangana districts |
| `data.ts` | Topics, subtopics, crops, inputs, schemes, government entities, markers |
| `queries.ts` | Query generation with priority tiers |
| `match.ts` | Bilingual matching |

## Term shape

```ts
{
  id: "dap-availability",        // canonical, kebab-case, stable
  en: "DAP availability",        // canonical English label
  te: "డీఏపీ లభ్యత",              // canonical Telugu label
  variants: [...],               // every surface form that counts as a match
  exclusions: [...],             // forms that must NOT match
}
```

`variants` mixes English spellings (`fertilizer`/`fertiliser`), Telugu forms
(`ఎరువులు`), transliterations (`raithu bharosa`, `rythu bharosa`) and
abbreviations (`DAP`, `MSP`) in one list. Matching handles both scripts:

- **Latin** variants match case-insensitively on non-letter boundaries, so
  `dap` does not match inside `update`.
- **Telugu** variants match as exact substrings. Telugu has no casing, and its
  agglutinative suffixes make word-boundary matching counterproductive.
- **Unicode care**: normalization preserves combining marks (`\p{M}`), because
  Telugu vowel signs are combining marks — stripping them turns `డీఏపీ` into
  `డఏప` and silently breaks both matching and deduplication.

## Coverage

| Family | Count | Notes |
|---|---|---|
| Districts | 33 | All of Telangana, with Telugu names, variants and disambiguation |
| Topics | 13 | Fertilizer, seeds, rainfall, procurement, crop damage, support schemes, power, irrigation, pests, market prices, credit, input costs, mechanisation |
| Subtopics | 14 | e.g. DAP vs urea availability, above-MRP sales, payment delays, loan waiver |
| Crops | 11 | Paddy, cotton, maize, chilli, turmeric, soybean, red/green/bengal gram, groundnut, horticulture |
| Inputs | 8 | DAP, urea, fertilizer, seed, pesticides, electricity, irrigation water, credit |
| Schemes | 5 | Rythu Bharosa, Rythu Bima, crop insurance, loan waiver, mechanisation support |
| Government entities | 7 | Agriculture Dept, Agriculture Minister, Civil Supplies, district administration, agricultural marketing, PJTSAU, CMO |

## Disambiguation that live data forced

**Districts.** Real text collides: Mahabubabad vs Mahabubnagar, Medak vs
Medchal, Nagarkurnool vs Kurnool (which is in Andhra Pradesh), Nirmal the
district vs a person's name. These carry explicit `exclusions`.

**Government entities carry `agricultureSpecific`.** The Agriculture
Department, Agriculture Minister, agricultural marketing and PJTSAU are
inherently agricultural. The CMO, district collectors and Civil Supplies are
not — they matter only inside an agriculture context. Before this distinction
existed, the phrase "Chief Minister" alone scored political press releases as
agriculture-relevant, and official political content flooded the pipeline.

## Query generation

`generateCollectionQueries()` produces 291 search queries across three tiers
(plus 15 channel polls = 306 planned collection queries):

| Tier | Composition | Count | Frequency |
|---|---|---|---|
| A | Core Telangana agriculture terms, English + Telugu | 10 | 6h |
| B | Crop/issue × Telangana | 17 | 24h |
| C | Issue × district × language (4 × 33 × 2) | 264 | weekly, rotated |

Combinatorial explosion is controlled deliberately: Tier C pairs only the four
highest-value issues with districts rather than every topic × every district ×
every language, and the scheduler runs only queries whose `next_run_at` has
passed.

## Extending

Adding a crop, scheme, district or issue means appending one object to the
relevant array. The relevance gate, enrichment prompt (which enumerates
allowed ids), narrative derivation and UI all read the ontology at runtime, so
no other file changes. Mandal and village levels are already modelled
(`DistrictEntry.mandals`, `locations.parentId`) and are populated sparsely
until district-level intelligence is proven.
