# P0-B — RECONCILIATION CENSUS

**Date:** 2026-08-19 · **Method:** all figures below were recomputed directly from the row-level
files under `canonical/` and `registers/` using throwaway Node scripts (`node census.js`, run
against `smartcard-canonical-v1`, read-only) — never copied from `FINAL_METRICS.json`. Where a
figure below disagrees with a document, the document is what's wrong, not this census, unless
stated otherwise.

---

## 1. REGISTER ↔ ROW RECONCILIATION

Every headline figure in `FINAL_METRICS.json` was independently recomputed from the actual
`canonical/` rows. Result: **near-total reconciliation.** Of ~70 recomputed sub-metrics, exactly
two genuinely disagreed on first pass, and both are now explained (§2, §3) — neither is a data
defect.

| Family | Recomputed | FINAL_METRICS | Match |
|---|---|---|---|
| cards.total | 1,077 | 1,077 | ✅ |
| cards.byLifecycle | CURRENT 378 / TARIFF_ONLY 25 / RETIRED 56 / EXCLUDED 15 / UNVERIFIED_LEGACY 603 | identical | ✅ |
| cards.shippablePerInstitution (17 orgs) | identical, e.g. hapoalim 42, fibi 38, otsar-hahayal 38 | identical | ✅ |
| cards.fxResolutionPaths | ISSUER_X_OPERATOR 671 / ISSUER_DEFAULT 121 / ISSUER_UNANIMOUS 110 / ISSUER_SOLE_KNOWN_OPERATOR 94 / OPERATOR_UNKNOWN_RANGE 43 / PER_CARD_ISSUER_TARIFF 34 / CARD_LEVEL_EXCEPTION 4 | identical | ✅ |
| fees.total / byGeneration / byField / calculationSafe(1043) / operatorAttributed(1033) / markedHistorical(85) | identical | identical | ✅ |
| waivers.total(171) / machineUsable(64) / byRuleType / byIssuer | identical | identical | ✅ |
| fx.pairs(43) | 43 | 43 | ✅ |
| fx.cardLevelExceptionRules | 14 (after correcting which array to read — see §3) | 14 | ✅ |
| benefits.total(843) / byScope | identical | identical | ✅ |
| benefits.cardPinned | 441 | 441 | ✅ |
| relationships.total(3,540) / shippable(1,850) / byType (all 8 types) | identical | identical | ✅ |
| clubs.total(334) / byKind (CLUB 123 / PROGRAMME 211) | identical | identical | ✅ |
| merchants.total(266) / officialUrlVerified(126) | identical | identical | ✅ |
| billing.institutions(18) / byStatus | identical | identical | ✅ |
| interest.issuers(17) | 17 | 17 | ✅ |
| contentPack (glossary 89 / consumer-rights 25 / issuer-contacts 18) | identical | identical | ✅ |
| conflicts.total(97) / byScope (35/36/26) / byKind (1/22/55/19) | identical (after correcting field names — see §3) | identical | ✅ |
| ownerQuestions.total(81) / byStatus | identical | identical | ✅ |
| validation.passCount(49) / scenarios.passCount(23) | identical | identical | ✅ |
| **merchants.withArabicName** | **93** | **93** | ✅ (the "91" in casual reading is a sub-total, not a metric — see §2) |
| **benefits.cardsCarryingABenefit / shippableCardsCarryingABenefit** | **174 / 83** (via relationships graph) | 174 / 83 | ✅ once the correct join is used — see §3 |

**Conclusion: the registers do reconcile against the rows.** This had never been checked before —
until now the registers had only ever been checked against each other. No canonical file was
modified to produce this reconciliation.

---

## 2. THE 93-vs-91 DISCREPANCY — RESOLVED, NOT A DEFECT

`merchants.withArabicName = 93` (any merchant with a non-null, non-empty `nameAr`). Summing only
the three "positively derived" status buckets (`OFFICIAL_ARABIC` 9 + `COMMON_USAGE` 51 +
`TRANSLITERATION` 31 = 91) undercounts by exactly 2. The two records:

| merchantId | canonicalName | nameAr | nameArStatus | Why |
|---|---|---|---|---|
| `merch:airalo` | Airalo | `Airalo` | `NOT_APPLICABLE` | Brand mark stays in Latin script even on the brand's own Arabic-locale page (`airalo.com/ar`) |
| `merch:sunglass-hut` | sunglass hut | `Sunglass Hut` | `NOT_APPLICABLE` | Same pattern — verified against the brand's MENA Arabic edition, which keeps the brand name in Latin script |

**This is a fourth legitimate category, not an error.** `NOT_APPLICABLE` means "translation isn't
the right model for this name" (the Latin brand mark *is* the correct Arabic-market display), so
`nameAr` is correctly populated with the Latin string while the status correctly records that no
translation/transliteration/local-usage judgment was needed. `withArabicName` (93) is the right
figure for "does this merchant have a value to display in the Arabic name slot"; the 91 is a
sub-total of *how that value was derived*, and a valid fourth bucket was always going to make the
two numbers diverge. No record needs correcting.

---

## 3. METRIC SCOPES — RESOLVED

### `cards.operatorKnown = 318` (the flagged ambiguity)
**Resolved: scoped to the 378 shippable/CURRENT cards, not the 1,077-row universe.**
`operatingCardCompanyId != null` over all 1,077 rows gives 749; over the 378 `lifecycleStatus:
CURRENT` rows it gives exactly 318, matching `FINAL_METRICS` precisely. **Any adapter that reads
`operatorKnown` as universe-wide will overstate FX-confidence unresolved by 431 rows.** This
should be named `operatorKnown` → `operatorKnownAmongShippable` in the next metrics regeneration,
or documented inline; it is not self-evident from the field name.

### `waivers.narrativeOnly = 65`
Not "not machine-usable" (which is 107 = 171 − 64). It is exactly `byRuleType.UNSTRUCTURED_NARRATIVE`
(65). The other 42 non-machine-usable rows (`FULL_WAIVER_TRIGGER_NOT_MACHINE_READABLE` 15,
`DEFINITION_NOT_A_WAIVER` 1, `EXCLUSION_NOTE_NOT_A_WAIVER` 2, `CONDITIONAL_REDUCED_FEE` 2, etc.) are
real rows with a specific reason, not narrative prose. Scope is a specific rule-type bucket, not the
complement of `machineUsable`.

### `benefits.cardsCarryingABenefit = 174`, `shippableCardsCarryingABenefit = 83`
**This is the important one for D0 (§T3).** Naively unioning `benefit.resolvedCardIds` across all
843 benefits gives only 107 / 63 — a real undercount. The correct source has two parts that must
both be read:
1. `resolvedCardIds` on the benefit record — direct, card-pinned entitlements.
2. `inheritedCardIds` on the benefit record (present only on `PROGRAMME_WIDE`-scope benefits) — cards
   that inherit the benefit via an evidenced `CARD_ATTACHED_TO_PROGRAMME` edge, computed separately
   from the direct pin.

Independently, walking the `relationships.jsonl` graph — `CARD_GRANTS_BENEFIT` (621 edges) ∪
`CARD_INHERITS_BENEFIT_VIA_PROGRAMME` (581 edges), taking the `card:`-prefixed endpoint of each —
gives **174 distinct cards / 83 shippable**, an exact match, confirming the relationships graph is
the authoritative join and safe to use for D0 regardless of which benefit-side field an engine
reads. **Recommendation for the adapter (P1-C): compute "cards carrying a benefit" from the
relationships graph, not from the benefit record's own fields** — it is one join instead of two
fields with different population rules per scope.

### `benefits.byProgrammeResolution` (132 `PROGRAMME_RESOLVED`)
Field name is `programmeResolutionStatus` on the benefit record (not a name that was guessed
correctly on the first pass). Present only on programme-scoped benefits.

### `fx.cardLevelExceptionRules = 14`
Lives at `fxResolution.cardLevelExceptions` (an array), a sibling of `fxResolution.pairs`, not
inside it. Confirmed 14 rows, matching. Each row carries a rich audit trail (`auditVerdict`,
`fannedOutRowsInV1`, `sourceQuoteVerbatim` vs `quoteAsRecordedByV1`) documenting the exact v1
defects this generation fixed — e.g. the FLYCARD / FLYCARD PREMIUM substring-match bug the baseline
already cites.

### `conflicts.byScope` / `byKind`
Row-level field names are `smartcardScope` and `conflictKind` (not `scope` / `kind`). The register's
own `counts` object (`total: 97, byScope: {...}, byKind: {...}, cardRelevant: 35,
genuineCardDisagreements: 5`) is pre-aggregated and matches the row-level recomputation exactly
once the correct field names are used.

---

## 4. UNIT AND SCALE CONVENTIONS

### JPY-per-100 / LBP-per-10 — **already handled correctly, self-documenting**
`market-reference/boi-fx-rates.snapshot.json` carries a root-level `unitTrap` field stating verbatim:
*"JPY is quoted per 100 and LBP per 10. Always use `ratePerOneUnit` for cost maths."* Every currency
row carries both `unit` (100 for JPY, 10 for LBP, presumably 1 elsewhere) **and** a pre-divided
`ratePerOneUnit`, plus its own `calculationSafe: true/false` flag. This is a solved problem in the
data; the Tier-1 convention only needs to say "always read `ratePerOneUnit`, never `rateIlsPerUnit`
directly," and forbid engines from reading `unit` themselves to "fix" a rate.

### Percentage scale — **mostly consistent, one real defect class found**
FX and card-cost percentages (`fee-terms.valueNumeric` where `field=FX_COMMISSION_PCT`,
`card.costs.fxCommissionPct.value`) are **uniformly whole-number-percent** (e.g. `2.0` means 2%,
range observed 0–3, `unit: "PERCENT"` everywhere). The one v1-era defect the roadmap warned about
(FIBI storing `0.16` for "16%", CAL storing `1.0` for "1%") **does not reproduce in this
generation** for these fields — good news, worth stating plainly rather than re-warning about a
solved problem.

**But `benefits[].value.kind: "PERCENT"` is a real, live defect class.** It is used as a catch-all
numeric-value tag, not a strict percentage marker:

| `valueTypeRaw` under `kind:"PERCENT"` | Count | Actual meaning | Example value |
|---|---|---|---|
| `PERCENTAGE_OF_SPEND`, `PERCENTAGE`, `percentage`, `PERCENTAGE_DISCOUNT`, `PERCENTAGE_OF_POINTS`, `PERCENTAGE_OF_LOAD` | 67 | genuine percentage | 0–~10 |
| `POINTS_PER_SPEND` | 7 | ₪ spent per 1 point earned | **180–400** |
| `BONUS_BENEFIT` | 1 | ₪ spend threshold per bonus unit | **3,000** |
| `null` | 130 | unknown without reading `description` | 0.1–? |

A component that renders `${value.value}%` whenever `value.kind === "PERCENT"` will print **"3000%"**
and **"400%"** for real records today. This must be a named Tier-1 decision, not left implicit —
see the draft, §T6 item 6.

### `shipToApp` — expressed differently per family, not universally
Explicit boolean field present on: `card-products` (correlates exactly 1:1 with
`lifecycleStatus === "CURRENT"` — 378 true, all others false), `fee-terms`, and `relationships`
(1,850 true / 1,690 false). **Absent** as a direct field on `benefits`, `clubs`, and `waivers` —
those families' shippability is derivative, reachable only by walking the relationships graph or
the parent card. A Tier-1 adapter cannot filter `benefits.jsonl` on `shipToApp` directly; it must
filter on the graph.

### `calculationSafe` — same asymmetry, different fields for the same concept
Explicit on `fee-terms` (1,043 true / 132 false) and on each currency row in
`boi-fx-rates.snapshot.json`. **Absent** on `card-products`, `benefits`, and `stacking-rules`.
`fees/card-fee-waivers.json` has no `calculationSafe` field at all — it uses its own,
differently-named gate, `machineUsable` (64 true / 107 false), for the same underlying purpose
("is this row trustworthy enough for an engine to compute with"). **Two vocabularies for one
concept.** Flagged as a required Tier-1 decision — see draft §T6 item 4.

---

## 5. PATH-BEARING FIELDS — SIZING THE GATE-#10 PROBLEM

Full scan across all 15 sub-families plus 10 standalone JSON files, using a path/URI detector.
**~1,951 confirmed real filesystem-path leak instances**, all absolute Windows paths with drive
letter and/or the developer's username, across 5 distinct field paths in 4 families:

| Field | Family | Count | Example |
|---|---|---|---|
| `evidence[].sourceLocalPath` | fees (fee-terms) | 1,676 | `C:\Users\ebrah\SmartCard-Data-Lab\...\תעריפון מלא.pdf` |
| `evidence[].sourceLocalPathOriginalRecorded` | fees | 110 | same shape |
| `evidence[].localCopy` | merchants | 115 | `C:\Users\ebrah\All application data\smartcard-canonical-v1\evidence\merchants\...` |
| `evidence[].localCopy` | clubs/programmes | 28 | `C:\Users\ebrah\...\evidence\clubs\prog2026\...` |
| `legalNameAr/He/En.sourceUrl` | content — issuer contacts | 22 | `file:///C:/Users/ebrah/All%20application%20data/smartcard-canonical-v1/canonical/entities/organisations.json` |

**Every one of `fees/fee-terms.jsonl`'s 1,175 records carries this field** (it is the primary
evidence-locator field for the whole family) — this is the single largest source and the one gate
#10 must handle first. It never leaves `evidence[]`/`sourceLocalPath`-shaped fields, which is good
for the projection: **one strip rule at that field shape covers ~92% of the confirmed instances.**

**Separately, ~1,805 occurrences of the bare internal codename `"SmartCard-Data-Lab"`** (not a full
path — just a `lineage.origin` tag) appear across `cards` (231), `clubs` (276), `relationships`
(453) and **every one of the 843 `benefits` records**. Not covered by OD-16's literal definition
(file://, drive letter, UNC, user-home fragment), but it does reveal the developer's private
source-tree naming to every installed app and should almost certainly be stripped or replaced with
a generic label (`"estate-internal"`) by the same projection pass, as a matter of professionalism if
not of the letter of gate #10. Recorded as a **recommendation, not a requirement** of OD-16.

**Two categories of false positive were caught and excluded**, worth naming so a future session
doesn't re-discover them the hard way:
1. Any `X://` where X is a single letter that is itself the tail of an ordinary word (`http`**`s:`**`//`)
   — a naive drive-letter regex without a word-boundary guard matches inside `https://`.
2. Free-text fields that embed **literal regex source as documentation** (e.g.
   `fee-terms.operatorAttributionBasis`, `benefits.stacking.evidenceBasis`) contain doubled
   backslashes (`\\.?`, `\\b`, `\\s+`) that coincidentally match a naive UNC-path pattern
   (`\\server\share`). Confirmed false by reading the raw strings directly — not real paths.

No canonical file was modified to produce this scan.

---

## 6. FIELD CENSUS

Full per-field census (type, fill rate, enum values where cardinality ≤ 40, one example otherwise)
for all 13 requested entity families (cards, fees, FX pairs, waivers, billing, interest,
clubs/programmes, relationships, benefits, stacking, merchants, content — split into glossary /
consumer-rights / issuer-contacts — and conflicts) is in the companion file `field-census.json`
(also written this session). It is a reference artifact (~950 KB, ~1,100+ distinct field paths on
`cards` alone given its nested cost/verifiedRegistry structure) — read it by field path, not front
to back.

---

## 7. WHAT WAS NOT DONE (explicitly, per scope)

No benefit→card link was created. No similarity matching was run. No canonical or register file was
modified — every artifact in §1–§6 came from throwaway scripts writing to the session scratchpad,
never back into the estate.
