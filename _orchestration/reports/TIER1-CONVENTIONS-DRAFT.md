# TIER-1 CONVENTIONS — DRAFT — PROPOSED — NOT FROZEN — REQUIRES OWNER APPROVAL

**Date:** 2026-08-19/20 · **Author:** SmartCard supervisor, session 02 · **Status:** input to P0-C1,
not P0-C1 itself. Nothing here is binding. The Owner reviews this; only the Owner's approval (or a
revision) turns any of it into the freeze.

**Why this is a draft and not a decision.** Every one of the nine conventions below is cheap to
change today and expensive to change after row-level schemas, gate implementations, adapter
signatures, engine assertions and test fixtures all encode it. That asymmetry is why this document
exists as a separate step rather than a supervisor judgment call folded into P1-A.

**Grounding.** Every proposal below cites a concrete finding from `P0-B-census.md` and
`field-census.json` (this session's T1), not from what would be elegant in the abstract. Where the
census could not settle something, it is listed as an open question, not silently decided.

---

## INPUT READ: the app's prior provenance experiment (`src/authority/`)

Read in full, as input only, per instruction — not the contract:

- `authorityValue.ts` — a 5-state model (`KNOWN`/`UNKNOWN`/`BLOCKED`/`CONFLICT`/`HISTORICAL`),
  structurally separating "has a value" from "does not" so `undefined ?? 0` cannot manufacture a
  number.
- `presentation.ts` — six presentation tones, a `FORBIDDEN_UNAVAILABLE_RENDERINGS` list (`"0"`,
  `"0%"`, `"free"`, `"verified"`, …), and `rendersAsZeroAmount()` — a guard against exactly the
  defect class E1 just found live in `DecisionScreen.tsx` (a hardcoded `84/100` rendered as if it
  were an engine output).
- `claimClassification.ts` — separates a *business rule* ("show installments above 3 payments")
  from a *financial data claim* ("this card charges 2.8% abroad"), fails closed (an unrecognized
  field is treated as authority-requiring), and derivations inherit their inputs' authority
  requirement rather than manufacturing their own.

**What I took:** the structural value/no-value separation, the CONFLICT state's "candidates are
preserved, never arbitrated to a winner" design (this is *exactly* OD-3 and *exactly* how
`CONFLICT_REGISTER.json` already models `PRESERVED_NOT_ARBITRATED` — the two were built
independently and agree), the forbidden-renderings guard, and the business-rule/financial-claim
split with fail-closed defaults.

**What I rejected, and why:** `PROVENANCES` names only `OFFICIAL_AUTHORITY` as authority-grade,
which means under this experiment's own rule **every one of the 378 shipped cards' verified FX/fee
values would read as `UNVERIFIED_INPUT`** (`mayShowAsVerified: false`) purely because they arrived
via the bundled pack rather than a live API call — `isCurrentAuthority()` cannot be true for
`BUNDLED_DATASET` provenance as written. That is backwards: the canonical estate's own
`verification-vocabulary.csv` already carries a real, field-level verification grade
(`VERIFIED_OFFICIAL` / `CORROBORATED` / `SINGLE_SOURCE` / …) that survives into the pack. The fix is
not "trust bundled data less," it is "the bundled provenance tag must carry the estate's own
verification tier as a sub-field," so a `VERIFIED_OFFICIAL` bundled fee reads as verified and an
`ESTIMATED` one does not — the authority grade should travel with the value from the estate, not be
flattened to a single `BUNDLED_DATASET` bucket at the app boundary. See item 2 below.

---

## 1. DATASET IDENTITY AND VERSION GRAMMAR (given OD-16: the path is immutable)

**Proposal.** `datasetId` and `datasetVersion` are read **only** from `DATASET_ID` (the marker file)
and `INPUT_MANIFEST.json` at the estate root — never inferred from the containing folder's name.
Every pack the pipeline produces embeds the same `datasetId`/`datasetVersion` it was built from, and
the app's ingest path asserts `datasetId === "smartcard-canonical-v2"` (or whatever the marker
currently says) before trusting any pack content. A version bump is `datasetVersion` changing; the
folder name never changes and is not evidence of anything.

**Evidence.** The estate self-identifies as `smartcard-canonical-v2` / `2.0.0` while living in
`smartcard-canonical-v1\` — confirmed twice now (session 01's `DELIVERY_MODEL.json` read, this
session's `INPUT_MANIFEST.json` freeze). This has already caused confusion once (the original `v1`→
candidate-line mixup the README documents) and the rename was proven unsafe this session (`file://`
citations baked into shipped data — see P0-B-census §5).

**What breaks if changed later:** any code that resolves dataset identity from a path fragment
silently trusts the wrong generation the next time this estate (or a sibling one) is regenerated
under a differently-named folder — which is exactly the failure mode that produced two prior
discredited generations in this project's history.

## 2. PROVENANCE VOCABULARY

**Proposal — two layers, not one.**

**Layer A — data-layer verification status** (13 states, unchanged, already exists):
`VERIFIED_OFFICIAL · CORROBORATED · SINGLE_SOURCE · CONFLICTING · DERIVED · DERIVED_FROM_OFFICIAL ·
NOT_PUBLISHED · LOGIN_GATED · CUSTOMER_SPECIFIC · ESTIMATED · HISTORICAL · UNKNOWN_AFTER_RESEARCH ·
UNKNOWN` — this is estate-internal, ships with every fact, and the app never needs to reproduce it.

**Layer B — product-facing provenance chip, four states + Stale:**

| Chip | Data states that map to it | `calculationSafe` |
|---|---|---|
| `VERIFIED` | `VERIFIED_OFFICIAL`, `CORROBORATED`, `SINGLE_SOURCE` | true |
| `ESTIMATE` | `DERIVED`, `DERIVED_FROM_OFFICIAL`, `ESTIMATED` | true (per estate crosswalk) — see open question below |
| `CONFLICT` | `CONFLICTING` **only** | false |
| `WITHHELD` | `NOT_PUBLISHED`, `LOGIN_GATED`, `CUSTOMER_SPECIFIC`, `UNKNOWN`, `UNKNOWN_AFTER_RESEARCH` | false |
| **`STALE`** (separate from `WITHHELD`) | `HISTORICAL` | false |

**Evidence.** `canonical/crosswalks/verification-vocabulary.csv` already implements 3 of these 4
chips (`VERIFIED`/`ESTIMATE`/`UNKNOWN`) — read directly this session. It currently folds
`HISTORICAL` into the same `UNKNOWN` chip as genuinely-never-researched facts. **This is the one
recommended change to the existing crosswalk**: `HISTORICAL` deserves its own `STALE` chip, because
"this was the rate as of a stated date" is materially more useful to a user than "we don't know,"
and the app's own `authorityValue.ts` independently built exactly this distinction (a `HISTORICAL`
state that carries a value but fails `isCurrentAuthority`) — two independent efforts arriving at the
same structure is a strong signal it's the right one, not a coincidence to discard.

**Shippable provenance shape — never a path.** Per OD-16 (gate #10), the app-facing provenance
record for any field is `{ chip, sourceLabel, publicationDate, registryId }` — never a `sourceUrl`,
`sourceLocalPath`, or `file://` URI. P0-B-census §5 found **~1,951 real filesystem-path leak
instances**, overwhelmingly in `fee-terms.evidence[].sourceLocalPath` (1,676 of them, on nearly
every one of the 1,175 fee-term rows) — this is not a hypothetical risk, it is the dominant shape of
today's evidence field, and gate #10 must be a real, tested transform, not an afterthought.

**Open question, not decided here:** should `ESTIMATE` remain `calculationSafe: true`? The estate's
own crosswalk says yes (a derivation with a stated formula is safe to compute with), but this means
an engine computing with an `ESTIMATE` value produces a result that is *itself* only estimate-grade
— OD-3's engine contract already requires this ("downgrades the result to Estimate"), so the
propagation rule needs to be explicit in the Tier-1 spec, not left implicit in each engine's own
judgment.

## 3. `shipToApp` SEMANTICS

**Proposal.** `shipToApp` means exactly one thing: *this row is safe to bundle into a shipped pack
as a first-class, user-facing record.* It is set once, at pack-build time, by the pipeline — never
computed at runtime by the app. Where a family has no direct `shipToApp` field (see evidence below),
the adapter computes it once at build time by walking the relationships graph and **writes it onto
the projected record**, so the app never has to re-derive it from a graph traversal at runtime.

**Evidence — the field is expressed inconsistently today, confirmed by direct inspection:**
- Present, explicit, boolean: `card-products` (1:1 with `lifecycleStatus === "CURRENT"` — 378 true,
  699 false, no exceptions), `fee-terms`, `relationships` (1,850 true / 1,690 false).
- **Absent** on `benefits`, `clubs`, `card-fee-waivers` — their shippability today is *only*
  derivable by walking the relationship graph (confirmed this session: the correct "which cards
  carry a benefit" answer — 174/83 — comes from `CARD_GRANTS_BENEFIT` ∪
  `CARD_INHERITS_BENEFIT_VIA_PROGRAMME` edges, not from any field on the benefit record itself).

**What breaks if changed later:** if the app is ever allowed to compute `shipToApp` itself at
runtime instead of receiving it pre-resolved, two different screens doing that computation slightly
differently is exactly the "one brain, many surfaces" defect class E1 just found three live
instances of (three FX implementations). Resolving shippability is a pipeline-time, single-site
concern, full stop.

## 4. `calculationSafe` SEMANTICS

**Proposal.** One name, one meaning, across every family: *"an engine may read this row's numeric
value and use it in arithmetic; a UI may not simply skip a `calculationSafe: false` row — it must
render the row's provenance state instead."* Adopt `calculationSafe` as the ONE name; retire
`machineUsable` (waivers) as a synonym at the adapter boundary — the adapter renames it on ingest so
every downstream consumer sees one field name for one concept.

**Evidence — currently two vocabularies for the same idea, confirmed by direct inspection:**
- `calculationSafe` (boolean): present on `fee-terms` (1,043 true / 132 false) and on every currency
  row in `boi-fx-rates.snapshot.json` (confirmed — even the JPY/LBP unit-trap rows carry their own
  `calculationSafe`).
- `machineUsable` (boolean): the *same concept*, different name, on `card-fee-waivers.json` (64
  true / 107 false). No `calculationSafe` field exists there at all.
- **Absent entirely** on `card-products`, `benefits`, `stacking-rules` — for these families,
  "calculation-safe" today is implicit in `verificationStatus` (e.g. a card's
  `costs.fxCommissionPct.verificationStatus`), not a standalone flag.

**The rule that must hold everywhere:** engines read **only** `calculationSafe: true` rows (or the
`verificationStatus`-derived equivalent where no explicit flag exists yet). A `calculationSafe:
false` row is not an error and not something to silently drop — OD-3's conservative-value rule and
the `CONFLICT` chip exist precisely so a `false` row still has a defined product treatment.

## 5. UNIT CONVENTIONS

**Proposal.** Adopt the estate's own convention as-is — it is already correct and already
self-documenting. Every currency snapshot in `market-reference/` carries a root-level `unitTrap`
field (verbatim, read this session: *"JPY is quoted per 100 and LBP per 10. Always use
`ratePerOneUnit` for cost maths."*) and every currency row carries a pre-divided `ratePerOneUnit`
alongside the raw `unit`/`rateIlsPerUnit`. **The Tier-1 rule: an engine may read `ratePerOneUnit`
only. Reading `rateIlsPerUnit` or `unit` directly from any engine is itself a boundary violation**,
enforceable the same way E1's R3/R4 rules already work (a natural R6 candidate for the boundary-lint
config, not built this session — out of scope for E1 as specified).

**Evidence.** Verified directly against `boi-fx-rates.snapshot.json`: JPY row has `unit: 100,
rateIlsPerUnit: 1.8697, ratePerOneUnit: 0.018697`; LBP row has `unit: 10, rateIlsPerUnit: 0.0003,
ratePerOneUnit: 0.00003`. Nothing to fix in the data — this is a solved problem; the convention only
needs to be stated as binding.

## 6. PERCENTAGE SCALE CONVENTION

**Proposal — two separate rules, because the census found two separate situations:**

1. **FX and fee percentages: already consistently whole-number-percent** (`2.0` means 2%, never
   `0.02`). Confirmed directly: `FX_COMMISSION_PCT` fee-term values range 0–3, `unit: "PERCENT"`
   uniformly; card-level `costs.fxCommissionPct.value` ranges 1.25–3, no fractional-scale outliers.
   **State this as the binding convention and stop there** — the v1-era FIBI-0.16-vs-CAL-1.0 defect
   the roadmap warned about does not reproduce in this generation.
2. **`benefits[].value.kind: "PERCENT"` is NOT safe to treat as a percentage and must not ship
   as-is.** Confirmed directly this session: under `kind: "PERCENT"`, `valueTypeRaw` ranges over
   `PERCENTAGE_OF_SPEND` (genuine percent, 0–~10) but also `POINTS_PER_SPEND` (₪ spent per point,
   observed up to **400**) and `BONUS_BENEFIT` (₪ spend threshold, observed **3,000**), plus 130
   records with `valueTypeRaw: null`. A component rendering `${value}%` whenever `kind === "PERCENT"`
   prints `"3000%"` today. **Required before P1-C:** either (a) `value.kind` is split into a proper
   enum that distinguishes true percentages from spend-ratios and thresholds, or (b) the adapter
   refuses to project a benefit's numeric value into the app at all unless `valueTypeRaw` is one of
   an explicit allowlist of genuinely-percent types. Left as an open decision — not resolved here
   because it changes the benefits pack's own schema, which is a P1-A/pipeline-side call, not a
   pure app-side convention.

## 7. CONFLICT REPRESENTATION

**Proposal.** Adopt the estate's on-disk shape directly as the adapter's shape — they already agree
in spirit, and OD-3's engine rule is already compatible with it. On disk (`CONFLICT_REGISTER.json`,
read in full this session): each conflict carries `competingValues[]` (each with its own `value`,
`unit`, `scopeText`, `evidence[]`), `classification`, `resolution: "PRESERVED_NOT_ARBITRATED"`
(never anything else — a build validation already fails if this isn't true), and
`smartcardScope`/`conflictKind` (note: **not** `scope`/`kind` — the field names differ from what a
casual reading of `FINAL_METRICS.json`'s aggregate `byScope`/`byKind` would suggest, confirmed by
direct inspection). The adapter's shape for a card-relevant conflict reaching the app is:
`{ candidates: [{ value, unit, scopeText, sourceLabel }], resolution: 'PRESERVED_NOT_ARBITRATED' }`
— structurally identical to the estate's own record, minus the path-bearing evidence detail (which
gate #10 strips per item 2).

**The engine rule (already Owner-approved as OD-3, restated here for completeness, not re-decided):**
a computation that needs one number from a conflicted field uses the **conservative** candidate and
downgrades the result's provenance chip to `ESTIMATE`; a screen that can show all candidates (Card
DNA, Check Verdict — per OD-9) does so via the shared `ConflictedValue` component, never
per-screen bespoke logic.

**Scale, so P1-A can size the work:** 97 total conflicts, 35 card-relevant, of which only **5** are
genuine card-fact disagreements needing this full treatment — the rest are either
`SINGLE_VALUE_NO_COMPETITOR` (22, i.e. not really competing), `EDITION_DIFFERENCE` (19), or
`SCOPE_DIFFERENCE` (1, a sub-scope distinction rather than a contradiction). This is a small,
well-bounded surface, not a pervasive one.

## 8. MANIFEST GRAMMAR AND SIGNING ENVELOPE

**Proposal.** Extend, do not replace, `INPUT_MANIFEST.json`'s shape (this session already
established the pattern by adding per-file `sha256` for `canonical/` in T2): a shipped **pack**
manifest carries `datasetId`, `datasetVersion` (item 1), a `builtFrom` pointer to the exact
`INPUT_MANIFEST.json` checksums it was projected from (so a pack can be traced back to the frozen
input that produced it), a `packVersion` independent of `datasetVersion` (a pack can be rebuilt from
the same dataset with a fixed bug — that's a `packVersion` bump, not a new dataset generation), and
a signature covering the whole pack payload. **Not designed in detail here** — this is P1-A's job
(contract-agnostic infrastructure); this item exists so P1-A has a starting shape rather than a
blank page, and so the two version numbers (`datasetVersion` vs `packVersion`) are distinguished
from the outset rather than conflated later.

## 9. GATE-FAILURE SEMANTICS (the ten gates, including #10)

**Proposal.** Every gate is binary and fails the *build*, not a warning that ships anyway. Gate #10
(OD-16, path-stripping) is now concretely scoped by this session's census, not abstract:

- **What it must catch:** any `file://` URI, any Windows drive letter or UNC path, any user-home
  fragment, **and** — recommended, not required by OD-16's letter but found this session — the bare
  internal codename `"SmartCard-Data-Lab"`, which appears in `lineage.origin` on **100% of the 843
  benefit records** plus large fractions of `cards`/`clubs`/`relationships` (~1,805 occurrences
  total). Not a path, but a private source-tree name that has no business shipping to a user's
  device either.
- **What it must NOT catch (false positives found and fixed this session, worth carrying forward
  into the gate's own test fixtures so they don't get rediscovered the hard way):** ordinary
  `https://` URLs (a naive drive-letter regex without a word-boundary guard matches inside the `s:`
  of `https://`), and free-text fields that embed literal regex source as documentation (`\\.?`,
  `\\b`, `\\s+` patterns coincidentally matching a naive UNC-path check). A gate #10 test suite
  should include at least one corrupted fixture from each of these two false-positive families, per
  the standard "pack gates + corrupted-fixture tests" pattern this project already uses for the
  other nine gates.

The remaining nine gates are not re-litigated here — they are Roadmap/Execution-Model territory,
not something this census touched.

---

## SUMMARY — WHAT'S PROPOSED VS. WHAT'S OPEN

**Proposed, evidence-backed, ready for Owner sign-off:** dataset identity grammar (1), the
four-chip-plus-Stale provenance vocabulary (2) with its one recommended crosswalk change, shippable
provenance shape as label+date+registryId never a path (2), `shipToApp` as pipeline-time-only (3),
`calculationSafe` unification with `machineUsable` retired at the boundary (4), the `ratePerOneUnit`
unit rule (5), the FX/fee percentage-scale confirmation (6, half of item 6), the conflict
representation and its small confirmed scope (7), gate #10's concrete catch-list including the two
false-positive families to guard against (9).

**Explicitly left open, requiring a separate decision before P1-A can proceed cleanly:**
- Whether `ESTIMATE`-chip values keep `calculationSafe: true` given the propagation question (2).
- The `benefits[].value.kind: "PERCENT"` overload — schema split vs. adapter-side allowlist (6,
  second half). **This is the one item on this list with a live, demonstrable defect
  (`${value}%` → "3000%") if shipped unresolved — it should not wait as long as the others.**
- The full manifest/signing envelope shape (8) — sketched, not designed; P1-A's to finish.
