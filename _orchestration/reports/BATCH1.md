# BATCH-1 — cost-model projections: fee terms, FX pairs, waivers

PHASE P0-C3 · BRANCH `task/P1-B` · WORKTREE `C:\Users\ebrah\wt-P1B` · Node v20.20.2

Three cost-model source families now project into pack rows under the frozen contracts, on top of
the cards provenance types and the existing gate framework. Nothing was forked and nothing in cards'
behaviour changed: the 11 pre-existing suites and their 140 tests pass unmodified.

---

## 1. What was built

| File | Lines of purpose |
| --- | --- |
| `src/projection/cost-model.ts` | new — the rules all three families share: the three on-disk states, the shipping filter, the date precedence, the checked readers, the scoped-count vocabulary |
| `src/projection/fee-terms.ts` | new — `projectFeeTerms`, `asFeeTermRecordPack`, `FEE_TERM_FIELDS` |
| `src/projection/fx.ts` | new — `projectFxPairs`, `asFxRecordPack`, `FX_LEG_UNITS`, `auditForeignAtmSources` |
| `src/projection/waivers.ts` | new — `projectWaivers`, `asWaiverRecordPack` |
| `src/projection/provenance.ts` | modified — visibility only, plus one behaviour-preserving extraction (§1.6) |
| `src/projection/index.ts` | modified — exports only |
| `test/costmodel-fixture.ts` | new — loads the supervisor fixture, keeps each row's `_shape` annotation |
| `test/fee-terms.test.ts`, `test/fx.test.ts`, `test/waivers.test.ts`, `test/costmodel-shapes.test.ts` | new — 189 tests |

### 1.1 The shape of the solution, and why

The three families are three different files on disk but one contract problem. They share the chip
table, the `obtainable` rule, the three on-disk states, the unit rule, the empty-array rule and the
count vocabulary. So `cost-model.ts` holds those once and the three family modules hold only what is
genuinely theirs — `projectCostValue` is called by all three and exists in one place, which is why a
ruling about `value: null` is a one-line change rather than a three-file audit.

`cost-model.ts` delegates everything provenance-shaped to `./provenance`: `CHIP_BY_STATUS`,
`OBTAINABLE_REASONS`, `unknownReasonForGrade`, `NULL_VALUE_REASON` and `readDeclaredProvenance` are
imported, not copied. `CostModelKnownValue` is cards' `KnownValue` intersected with two members;
`CostModelUnknownValue` is cards' `UnknownValue` with `unit` relaxed to optional. A pack row's
`value` is therefore the same shape a card's cost field is, and the compiler enforces the split
(constraint 6): there is no `value` key on the UNKNOWN arm, so `if (chip === 'UNKNOWN')` is not a
convention anybody can forget — reading `.value` off an unnarrowed union does not compile.

### 1.2 A — fee terms (costmodel §1)

`projectFeeTerms(rows, opts) => { rows, counts }`. Filters on `shipToApp`, resolves the row's
provenance, projects one `value`, allowlists 24 fields and drops everything else.

Both `calculationSafe` classes ship. A `REPLACEMENT_FEE` whose price is "מחירון חברת השילוח" is a fee
the user is actually charged; dropping it would show a cheaper card than exists. It ships with
`calculationSafe: false` and `notCalculationSafeBecause` carrying the issuer's own words.

The projection **downgrades** a declared `calculationSafe: true` to `false` when the value's chip is
`UNKNOWN`. The estate ships that contradiction — rows with `valueNumeric: null` carry
`calculationSafe: true` — and Tier-1 §2.1 does not permit computing on a value that has no number.
The contract's table wins and the count `CALCULATION_SAFE_DOWNGRADED_BY_UNKNOWN_CHIP` says how often
(5 of 17 in the fixture), so the disagreement is visible in the artifact rather than silently
resolved.

The estate's own `provenanceChip` is dropped. On the fixture's `NOT_PUBLISHED` row it reads
`"VERIFIED"`, which contradicts Tier-1 §2.1. The chip is derived from `verificationStatus` here.

### 1.3 B — FX pairs and exceptions (costmodel §2)

`projectFxPairs(pairs, exceptions, opts) => { pairs, exceptions, counts }`. One function for both
because the exceptions are overrides *on* the pairs, and the totality assertion has to see all of
them at once.

**The null leg.** `foreignAtmCounterPct` is `null` on 18 of 43 pairs — the key exists and its value
is `null`, which is exactly what crashed the supervisor's census script. The guard is the first
statement in `projectLeg`, before anything reads into the leg. Both shapes are handled and they mean
different things:

- `leg === null` or leg absent → nothing was recorded. There is no grade to read, so `reason` is
  `UNKNOWN`. Claiming `NOT_PUBLISHED` would assert a documented search that no field on disk records.
- leg present, `conservativeValue: null` → the ordinary present-with-null state, and the leg's own
  grade decides the reason (Tier-1 §2.7).

The two primary legs are asserted at 43/43: a pair whose `fxCommissionPct` or `foreignAtmPct` is
missing FAILS the build, because §2.1 measures them as complete and a gap there is a defect rather
than an absence.

`conservativeValue` is the value that ships, per §2.2 — the reading least favourable to the user. If
the file's own `conservativeValue` is *lower* than its `distinctPublishedValues`, the file disagrees
with itself about which number is safe and the build FAILS. Understating a cost is not a failure
mode worth absorbing quietly. More than one distinct published value is a conflict under Tier-1 §7:
`candidates[]`, `resolution: PRESERVED_NOT_ARBITRATED`, no scalar and no winner.

**The ordering, and its totality.** Descending `matchPrecedence`, written onto the row as
`matchOrder` so an engine iterates a number rather than re-deriving the rule. Two conditions FAIL
the build, both scoped to rules that can actually collide (same issuer, same operator, same field,
one name a case-insensitive substring of the other):

1. equal precedence with **different** outcomes — nothing in the data says which wins, and a
   comparator returning 0 there is a coin toss with a price attached;
2. the **longer** name carrying the **lower** precedence — that is the v1 `FLYCARD` defect exactly:
   the general 2.6% rule firing on the `FLYCARD PREMIUM` cards entitled to 2.55%.

Two byte-identical rules at equal precedence are **not** a failure. The fixture contains exactly that
(`FLYCARD PREMIUM` at precedence 14, twice, same value and unit) and there is no ambiguity to
resolve — whichever fires, the engine reads 2.55%. They are counted under
`EXACT_DUPLICATE_OVERLAPPING_RULES` and both ship.

**Foreign-ATM across two sources** (§3, and the count §5.1 could not settle) is
`auditForeignAtmSources(feeTerms, pairs)`, deliberately **not** inside `projectFxPairs`. A conflict
that spans two families cannot be adjudicated inside one family's projection, and a signature that
took fee terms would invite exactly that. It reports; it rewrites nothing.

### 1.4 C — waivers (costmodel §4)

`projectWaivers(rows, opts) => { rows, counts }`. `machineUsable` is renamed `calculationSafe` at
the boundary — one name for one concept (Tier-1 §4) — and an absent `machineUsable` reads as `false`,
because a rule that does not claim to be computable does not get to be.

`resultingFeeIls` and `baseCardFeeIls` are **always** projected, even when null, because the census
measures all three states on them and an absent key would erase the difference between "not stated"
and "not applicable". The other amounts are omitted when null per §4.3: a waiver carries whichever
thresholds its `ruleType` implies, and a missing one means "this rule type does not use that
threshold".

The 81 verified `resultingFeeIls` nulls project `UNKNOWN` / `NOT_PUBLISHED` with no `value` key. This
is the single most consequential line in the batch: `0` would tell the user a waiver makes their
card free, when what the tariff says is that the resulting fee is not stated. For a *waiver* that
difference is the entire point. A stated `0` still projects as `0` — a stated zero is a fact and is
not suppressed.

Narrative rules ship `quote` byte for byte and are never parsed. Where a narrative rule carries no
`notMachineUsableBecause`, the row's own `parseBasis` fills it, because `parseBasis` states in the
estate's words why the clause could not be reduced to a rule. It is never invented and never filled
for a usable rule.

### 1.5 D — gates

All four existing gates are reused unmodified through `assertGatesPass`, and each family exposes an
`asRecordPack` so they can inspect it: `legacyRowsGate` (gate 1), `lineageGate` (gate 10 lineage
half), `pathDetectorGate` (gate 10 path half), `percentRangeGate` (gate 11). The gates run *inside*
each projection, so a poisoned row fails the build rather than being caught by a test later.

Every `asRecordPack` keys its envelopes with the arrival position appended (`termId#3`). Every
primary key in this corpus repeats — 5 duplicate `termId`s, 5 duplicate `ruleId`s, 2 duplicate
`pairId`s, 2 duplicate `exceptionId`s — and a gate reporting one violation per distinct id would
under-report.

The gate wiring is proven live, not decorative: a Windows path smuggled through an **allowlisted**
text field (`scopeText`) fails the fee-term build; a legacy marker in a waiver `quote` fails on gate
1; a 140% FX leg fails on gate 11; and an uncorroborated sub-1 percentage fails rather than being
multiplied by 100.

### 1.6 The one change to a shared file

`src/projection/provenance.ts` is modified. The whole diff is: five declarations widened from
module-private to exported (`CHIP_BY_STATUS`, `OBTAINABLE_REASONS`, `NULL_VALUE_REASON`,
`DeclaredProvenance`, `readDeclaredProvenance`), and one inline `reason` ladder inside
`projectCostField` extracted verbatim into an exported `unknownReasonForGrade`. No condition, no
constant and no branch changed. The alternative was to copy the chip table into `cost-model.ts`,
which would mean two tables that must agree about which Layer-A status earns which chip — and the
day they disagree, one of them is shipping a wrong chip. The 140 pre-existing tests passing
unmodified is the evidence that cards' behaviour is unchanged.

---

## 2. Definition of Done — verbatim output

### DoD 1 — `npx tsc --noEmit` exits 0

```
$ npx tsc --noEmit
exit=0
```

### DoD 2 — `npm run lint` exits 0

```
$ npm run lint

> smartcard-data-pipeline@0.1.0 lint
> eslint "src/**/*.ts" "test/**/*.ts"

exit=0
```

### DoD 3 — `npx jest --runInBand --ci`, all suites pass, the 11 existing suites intact

```
$ npx jest --runInBand --ci
PASS test/costmodel-shapes.test.ts
PASS test/pack.test.ts
PASS test/projection-provenance.test.ts
PASS test/import.test.ts
PASS test/projection.test.ts
PASS test/fx.test.ts
PASS test/fee-terms.test.ts
PASS test/waivers.test.ts
PASS test/engine-lattice.test.ts
PASS test/gates.test.ts
PASS test/pack-update.test.ts
PASS test/percent-range.test.ts
PASS test/manifest.test.ts
PASS test/determinism.test.ts
PASS test/transaction.test.ts

Test Suites: 15 passed, 15 total
Tests:       329 passed, 329 total
Snapshots:   0 total
Time:        2.057 s, estimated 3 s
Ran all test suites.
exit=0
```

The 11 pre-existing suites, run alone, to show none was weakened or deleted (329 − 189 new = 140):

```
$ npx jest --runInBand --ci --testPathIgnorePatterns "fee-terms|/fx.test|waivers|costmodel-shapes"
PASS test/pack-update.test.ts
PASS test/determinism.test.ts

Test Suites: 11 passed, 11 total
Tests:       140 passed, 140 total
Snapshots:   0 total
Time:        2.628 s
Ran all test suites.
```

No existing test file appears in `git status`, so none was edited.

### DoD 4 — present-with-null at a VERIFIED grade, per family

One test per family, each asserting `chip: 'UNKNOWN'`, `reason: 'NOT_PUBLISHED'` and
`'value' in record === false`:

```
test/fee-terms.test.ts
  THE THREE ON-DISK STATES (Tier-1 section 2.7) on valueNumeric
    √ DoD 4 - present-with-null at VERIFIED_OFFICIAL is an evidenced absence, not an error and not 0
    √ present-with-null at SINGLE_SOURCE is also an evidenced absence
    √ a NOT_PUBLISHED grade reaches the same projection by the direct route (costmodel section 1.4)
    √ an absent valueNumeric is UNKNOWN/UNKNOWN - nobody has looked yet - and is NOT an evidenced absence

test/fx.test.ts
  DoD 4 - present-with-null on a leg is an evidenced absence, not 0
    √ projects conservativeValue null at VERIFIED_OFFICIAL as UNKNOWN/NOT_PUBLISHED with no value

test/waivers.test.ts
  DoD 4 - the 81 resultingFeeIls nulls are evidenced absences, never 0 (costmodel section 4.2)
    √ projects resultingFeeIls null at VERIFIED_OFFICIAL as UNKNOWN/NOT_PUBLISHED with NO value key
    √ never confuses "a waiver makes the fee zero" with "the resulting fee is not stated"
    √ projects a real resulting fee of 0 as 0 - a stated zero is a fact, and is not suppressed
    √ treats baseCardFeeIls null the same way, on the real row that has one
```

### DoD 5 — a null nested FX leg does not throw

```
test/fx.test.ts
  DoD 5 - a null nested leg does not throw (costmodel section 2.1, constraint 8)
    √ projects the two real pairs whose foreignAtmCounterPct is null instead of dereferencing it
    √ projects the null leg as UNKNOWN/UNKNOWN with no value key, because nothing was recorded
    √ does not throw on a leg that is absent rather than null - both are "nothing recorded"
    √ projects a null foreignAtmSameCurrencyFee leg the same way, on the real row that has one
    √ counts the absent legs under the leg they belong to, so 18-of-43 is readable in the artifact
    √ fails a pair missing a PRIMARY leg, which section 2.1 measures at 43/43
```

### DoD 6 — exception ordering is longest-name-first, and an equal-precedence overlap FAILS

```
test/fx.test.ts
  DoD 6 - FX exception ordering is longest-name-first and total (costmodel section 2.3)
    √ orders FLYCARD PREMIUM ahead of FLYCARD, which is the v1 defect not repeated
    √ writes matchOrder onto the row so an engine iterates it rather than re-deriving the order
    √ orders longest-name-first even when the input arrives shortest-first
    √ FAILS on equal precedence with overlapping names and different values - a tie is a coin toss
    √ FAILS when the LONGER name carries the LOWER precedence, which is the FLYCARD defect exactly
    √ does NOT fail two byte-identical rules at equal precedence: there is no ambiguity to resolve
    √ counts the real corpus duplicates: FLYCARD PREMIUM twice and FLYCARD twice
    √ does not fail equal precedence when the names cannot collide at all
    √ judges overlap case-insensitively, because that is what matchSemantics declares
    √ does not compare rules across issuers, operators or fields: they cannot collide
    √ FAILS a rule with no precedence rather than inventing one
    √ marks every exception value as resolved by a card-level exception
    √ drops the v1 name-correction and paraphrase audit trail, keeping only the name the source uses
```

### DoD 7 — a narrative waiver ships its quote unchanged, byte for byte

```
test/waivers.test.ts
  DoD 7 - a narrative rule ships its quote verbatim and is never parsed (section 4.1)
    √ carries the quote byte for byte, including the Hebrew and the punctuation
    √ carries the Hebrew quote of the other narrative shape byte for byte too
    √ carries every quote in the corpus through unchanged, not just the ones a test names
    √ renames machineUsable to calculationSafe at the boundary: one name for one concept
    √ states WHY the rule is not machine usable rather than leaving it unexplained
    √ never fills notMachineUsableBecause on a rule that IS usable
    √ reads an absent machineUsable as NOT usable: a rule that does not claim it does not get it
    √ counts the two classes, so the 107-of-171 narrative share is visible in the artifact
    √ carries quoteProvenance, which is what says the quote is a contiguous verbatim string
```

### DoD 8 — projecting the fixture twice is byte-identical

```
test/costmodel-shapes.test.ts
  DoD 8 - determinism
    √ projects the fixture twice byte-identically
    √ is byte-identical across two independent projections of every family separately
    √ emits the same key ORDER, not merely the same keys: the pack is a byte artifact
    √ does not depend on the arrival order of the input for the sequence of keys it emits
    √ reads no clock: the same rows with the same declared build date give the same asOfDate
    √ sorts the counts, so two builds cannot differ by count order alone
```

### DoD 9 — no `lineage` key and no filesystem path survives

```
test/costmodel-shapes.test.ts
  DoD 9 - no lineage key and no filesystem path survives any of the three projections
    √ carries no key named lineage at any nesting depth
    √ carries no key named evidence, verifiedRegistry or sourceLocalPath at any depth
    √ holds no Windows drive path, UNC path, POSIX absolute path or file URI in any string
    √ holds no internal codename and no document file name
    √ proves the fixture DOES carry what was removed, so the assertions above are not vacuous
```

The last test is there because the other four would pass on an empty projection. It asserts that the
input rows *do* carry a `C:\...` path, *do* carry a `.pdf` file name and *do* carry a `lineage` key,
so the four assertions above are measuring removal and not absence.

### DoD 10 — `git status --short` shows only files inside SCOPE

```
$ git status --short
 M src/projection/index.ts
 M src/projection/provenance.ts
?? TASK-BATCH1.md
?? src/projection/cost-model.ts
?? src/projection/fee-terms.ts
?? src/projection/fx.ts
?? src/projection/waivers.ts
?? test/costmodel-fixture.ts
?? test/costmodel-shapes.test.ts
?? test/fee-terms.test.ts
?? test/fixtures/canonical-costmodel-sample.json
?? test/fx.test.ts
?? test/waivers.test.ts
```

`TASK-BATCH1.md` and `test/fixtures/canonical-costmodel-sample.json` were supplied with the worktree
and are untouched (the packet was not modified; the fixture was not modified). Everything else is
inside SCOPE. `reports/BATCH1.md` — this file — is the required output and will appear once written.

### What the fixture actually projects to

For the supervisor's benefit, the scoped counts over the 43-row fixture:

```
feeTerms   INPUT_ROWS 19  PROJECTED 17  DROPPED_SHIP_TO_APP_FALSE 2
           VALUE_PRESENT 12  EVIDENCED_ABSENCE 5  UNKNOWN_ABSENCE 0
           DISTINCT_KEYS 12  DUPLICATE_KEYS 5
           CALCULATION_SAFE 12  FLAGGED_NOT_CALCULATION_SAFE 5
           CALCULATION_SAFE_DOWNGRADED_BY_UNKNOWN_CHIP 5  NO_LABEL_IN_ANY_LANGUAGE 1
fxPairs    INPUT_ROWS 7  PROJECTED 7  DISTINCT_KEYS 6  DUPLICATE_KEYS 1
           DECLARED_DUPLICATE_POINTER 1  FLAGGED_NOT_CALCULATION_SAFE 1
fxLegAbsent            foreignAtmCounterPct 2  foreignAtmSameCurrencyFee 1  (primaries 0, 0)
fxLegValuePresent      fxCommissionPct 7  foreignAtmPct 7  foreignAtmCounterPct 5  same-ccy 6
fxExceptions           INPUT_ROWS 4  PROJECTED 4  EXACT_DUPLICATE_OVERLAPPING_RULES 2
waivers    INPUT_ROWS 13  PROJECTED 13  DISTINCT_KEYS 8  DUPLICATE_KEYS 5
           MACHINE_USABLE 11  NARRATIVE 2  DECLARED_DUPLICATE_POINTER 2
           DATASET_VERSION_DIVERGES_FROM_BUILD 13
waiverResultingFee     VALUE_PRESENT 8  EVIDENCED_ABSENCE 5  UNKNOWN_ABSENCE 0
waiverBaseCardFee      EVIDENCED_ABSENCE 2
foreignAtmCrossSource  JOINABLE_SCOPES 0  UNJOINABLE_SCOPES 1  CONFLICTED 0
```

Every count states its `metric` and its `population` (constraint 11); there is no bare number in the
API. A test in each suite walks the whole count list and asserts that.

---

## 3. Things I could not do, and why

**The cross-source foreign-ATM audit is unproven against real overlapping data.** The fixture's one
`FOREIGN_ATM_FEE` fee term belongs to an (issuer × operator) scope that no fixture FX pair covers,
so `JOINABLE_SCOPES` is 0 and `CONFLICTED` is 0. The join logic and the disagreement report are
tested on a planted case (`test/fx.test.ts` — "detects a planted disagreement, so the audit is not
vacuously clean"), which proves the mechanism but says nothing about the real rate. Whether the two
sources actually agree across the estate is a question only a run against the estate can answer, and
I may not read it. **This is the one number in Batch 1 I would not quote to anyone.**

**FX pair provenance has no source of its own.** The fx-resolution file carries no `evidence[]`, no
`sourceId` and no date. Its provenance *is* the fee terms it was resolved from, cited by `termIds` —
and `termIds` is not projected, because it is a join key into another family rather than a citation a
user can read. So an FX leg's `registryId` is synthesized from the pair's own scope
(`reg:fx:org:cal:org:cal`) and its `sourceLabel` is synthesized from the same. Both are opaque,
stable and path-free, and both are overridable by `opts.sourceLabels` under gate 10 rule A — but
neither is a real registry citation, and the real one has to come from `SOURCE_REGISTRY.jsonl` when
that exists. Flagged rather than faked.

**`shipToApp` cannot be derived here.** Tier-1 §3 says a family with no `shipToApp` on disk has it
derived from the relationships graph. Walking that graph means reading the estate, which is
forbidden (OD-15). It is a caller-supplied hook instead — see §4 for what the default does and why.

**No pack was written and no manifest was built.** Wiring these three families into the pack builder
and the manifest is not in SCOPE. `asRecordPack` per family is the seam the supervisor plugs in.

---

## 4. Every assumption I made that was not specified

**A1 — an undeclared `shipToApp` is shippable, and the resolution is counted.**
`shipToApp` is absent on 17 of the 19 fee-term rows and on every waiver rule, and the only value ever
observed on disk is `false` — the estate marks the exceptions explicitly. Reading "undeclared" as
"not authorized" would project an *empty* pack from a corpus of 1,175 authorized fee rows, which is
a silent catastrophe dressed as caution. The default is therefore "shippable", but the rows that
took it are counted under `SHIP_TO_APP_UNDECLARED_RESOLVED_SHIPPABLE`, so the number is in the
artifact rather than buried in a decision nobody can see, and `opts.resolveShipToApp` lets the
pipeline override it. A declared `false` is never overridable — the estate's own statement outranks a
build-time hook — and a declared `true` is never withheld.

**A2 — the shipping filter also applies to FX pairs and exceptions.** Neither declares `shipToApp`
today. Both projected row types assert `shipToApp: true`, and a record that asserts something should
have made the decision, so `decideShipToApp` runs on all four collections. On this corpus it changes
nothing; it means one filter rather than a family that quietly opts out.

**A3 — `value: null` under an ESTIMATE grade earns `reason: UNKNOWN`, not `NOT_PUBLISHED`.**
Costmodel §1.4 and cards §2.3 enumerate only the three *verified* statuses for `NOT_PUBLISHED`. An
estimate grade asserts a figure was DERIVED, not that a public source was searched and found silent,
so `NOT_PUBLISHED` would assert evidence nobody gathered. This case is unobserved in the corpus.
(Inherited from `NULL_VALUE_REASON` in cards, where the same reading was taken.)

**A4 — an absent value key is `reason: UNKNOWN` even on a `VERIFIED_OFFICIAL` row.** Tier-1 §2.7
separates the three states, and state 3 is "nobody has looked yet". A row's grade describes the
fields that *exist* on it; it cannot retroactively certify a search for a field the row never
mentions. `CostValueDeclaration.keyDeclared` is a required (not optional) member precisely so that
every call site has to state which of the three states it is reading.

**A5 — a number with no unit FAILS the build; a null with no unit omits the key.** Costmodel §1.4
says a fee term's unit is its own, and `unit` is `null` on 39 rows. Where there is no number, no
unit is needed and the key is omitted (consistent). Where there is a number, a unit cannot be
invented from the magnitude (constraint 5) or from what sibling rows happen to hold, so the row
fails. Units outside Tier-1 §5's two permits (`OTHER`, on the research rows) yield *no* unit rather
than shipping an unpermitted one.

**A6 — a `conservativeValue` lower than the published value FAILS.** §2.2 says the conservative
reading ships. If the file's own field is not that reading, the file disagrees with itself about
which number is safe. I chose to fail rather than to quietly take the larger number, because a
projection that repairs its input teaches nobody that the input is broken.

**A7 — `matchOrder` is written onto the exception row.** §2.3 specifies the ordering but not who
holds it. Leaving an engine to re-derive it from `matchPrecedence` means two implementations of the
same rule, and the v1 defect was exactly a mis-ordering. One brain, one ordering: the projection
computes it, asserts it is total, and ships the index.

**A8 — two byte-identical exceptions at equal precedence are a duplicate, not an ambiguity.** The
totality assertion fires on equal precedence with *different* outcomes. Identical rules have nothing
to arbitrate. Failing them would reject the real fixture for a distinction with no consequence.

**A9 — `parseBasis` fills an empty `notMachineUsableBecause` on a narrative waiver.** §4.1 names
`notMachineUsableBecause` on 33 of 107 narrative rows. The other 74 would ship as "not computable,
no reason given". `parseBasis` states, in the estate's words, why the clause could not be reduced to
a rule, so it is the honest filler. Never invented, and never filled for a usable rule.

**A10 — the estate's `provenanceChip` and `calculationSafe: true` lose to the contract.** Both
contradict Tier-1 §2.1 on real rows. The chip is derived from `verificationStatus`; the safety flag
is ANDed with "the value has a number". The overrides are counted, not silent.

**A11 — waivers carry their own `datasetVersion` (2.1.0) rather than the build's (2.0.0).** The
family is separately versioned on disk. Asserting the build's version would erase a real fact about
the source. `DATASET_VERSION_DIVERGES_FROM_BUILD` counts it.

**A12 — a fee term's `sourceLabel` is synthesized from `sourceType` + `locator`, never from
`sourceTitle` or `sourceLocalPath`.** `sourceLocalPath` is never read at all, which is stronger than
scrubbing it, and `sourceTitle` is a document *file name* (`תעריפון מלא.pdf`). `locator` names a
position *inside* a document (`p.26`, `sheet גיליון 1 row r611`) and carries no file name on any
fixture row. See §5 for the residual risk this leaves.

**A13 — identifiers are sorted, prose is not.** `cardLevels`, `excludedOperatorIds`, `baseTermIds`
and `appliesToPopulations` are sorted (order carries no meaning; a canonical one is worth having).
`conditions`, `exemptions`, `discounts` and `notes` keep the issuer's own order, because reordering
an issuer's list rewrites the document.

**A14 — synthesized ids.** The fx-resolution file has no pair id and the exceptions have no
exception id, but a pack row needs a key. `pairId` is `fx:{issuer}|{operator|*}` and `exceptionId` is
`fxx:{issuer}|{operator|*}|{field}|{cardNameRaw}`. Both are derived only from members the row
declares, so they are stable across builds.

**A15 — duplicate keys are counted, never dropped.** Every primary key in this corpus repeats.
Cards' duplicate-id build failure would refuse this corpus outright, so all four orderings use
`(key, arrival position)` — total, so DoD 8 holds — and duplicates ship. A repeated term is a fact
about the source tariff.

---

## 5. Things that looked wrong but were out of scope

**The estate contradicts the contract on two fields, on real rows.** `provenanceChip: "VERIFIED"` on
a `NOT_PUBLISHED` row, and `calculationSafe: true` on rows whose `valueNumeric` is `null`. The
projection overrides both and counts the overrides, but the *source* is still wrong and every other
consumer of those files will read the wrong values. Worth a data-campaign ticket, not a projection
change.

**`quoteAsRecordedByV1` is a paraphrase stored in a field whose name promises a quote.** All four FX
exceptions carry `quoteIsParaphrase: true` and a `sourceQuoteVerbatim` holding the real line. I
project neither — §2.3 names them audit metadata — but a field called `quote…` containing text that
is not a quote is a trap for the next reader. The verbatim line exists and is better; the naming is
what is wrong.

**`auditDefectClasses` repeats one string four times** on every FX exception, mirroring the four v1
rows that were fanned out. Dropped, so harmless here, but it means the estate's own defect count is
inflated 4× if anyone counts array length.

**One FX pair is a relabelled copy of another institution's tariff.** `org:union × org:amex-il`
carries `evidenceIsAnotherInstitutionsTariff: "org:mizrahi-tefahot"` and a note explaining that Bank
Igud is merged and this row must never price a current product. It projects with
`calculationSafe: false`, `notCalculationSafeBecause` and `duplicateOfPairId`, which is the most the
projection can do. What it *should* have is a lifecycle status that keeps it out of pricing
altogether. `evidenceProvenanceNote` on that row also quotes an estate folder name
(`בנק מזרחי-20 ו- אגוד-13`); it is dropped, and a test asserts the string does not survive.

**`sourceLocator` on waivers embeds a document file name** (`תעריפון מלא.pdf · p.22`). Dropped
wholesale rather than parsed apart, so waivers cite only their registry label. That is correct but it
means a waiver's citation is currently less specific than a fee term's (no page number), until the
real source registry exists.

**The residual risk I did not close.** `pathDetectorGate` catches drive paths, UNC paths, POSIX
absolute paths and file URIs, but a *bare file name* is not a path and does not trip it. Fee-term
labels include `evidence[].locator`, and on all 19 fixture rows a locator is a within-document
position with no file name — but that is measured over 19 rows, not 1,175. If a locator in the estate
ever carries a `.pdf` leaf, it will reach a `sourceLabel`. Two things bound it: `opts.sourceLabels`
overrides the synthesized label for any `registryId` (gate 10 rule A), which is how this is supposed
to work once the registry exists; and `test/costmodel-shapes.test.ts` asserts no output string
matches `/\.(pdf|xlsx|xls|docx|csv|json|jsonl)\b/i`, so a supervisor run against the estate will
surface it as a test failure rather than as a shipped label. I did not add a gate for it because
gates are out of SCOPE to modify and a bare file name is not what Tier-1 §6-A prohibits.

**`HISTORICAL` alone still fails the build**, inherited from cards. No cost-model row is `HISTORICAL`
today. If the estate produces one, the projection stops and asks rather than inventing a grade or
discarding a real number — which is the behaviour I want, but it is a hard stop and someone should
know it is there.

---

# R1 — the unit domain, and two more discoveries (ADR-010)

**Author: the supervisor, not the executor.** The R1 packet (`TASK-BATCH1-R1.md`) was written for
delegation and delivered to `cursor-agent` twice. The first run was killed by a 10-minute foreground
timeout mid-edit; the second, launched detached, **idled for 25 minutes with no TTY, wrote nothing,
and exited 1 while the wrapper reported exit 0.** The packet stands as written; the implementation
below is mine. The executor-capability finding is recorded in `_orchestration/EXECUTOR_CAPABILITIES.md`.

## What the real corpus did to Batch 1

`test/l13-batch1.manual.ts` is a supervisor-only harness (never in the jest suite — it reads the
canonical estate, which no executor and no CI job may do). Its first run died on its first row:

```
ProjectionBuildError: row=term:yahav|op:isracard:CARD_FEE:14 path=value.unit:
  a value is declared but no unit is: a number without a unit is not a fact (costmodel section 1.4)
```

The row is `valueNumeric: 63.31, unit: "USD"`. The unit *is* declared. Three separate defects fell
out of that one line, and only the third belongs to the code as delivered.

### 1. The contract was wrong (authority defect — mine)

Tier-1 §5 said `PERCENT` and `ILS` were the only permitted units. Measured domain across all 1,175
fee terms: **ILS 748 · PERCENT 248 · USD 117 · OTHER 17 · null 39 · EUR 6.** 123 foreign-currency
rows, 118 of them `calculationSafe`, were being crashed on rather than shipped.

The delivered code implemented the stated rule correctly and failed loudly rather than guessing —
its docstring cites the rule and documents the build failure as intended behaviour. Fixed by
**contract v1.3 §5.1/§5.2** and **costmodel v1.1 §1.4-A/§1.4-B**, not by blaming the projection.

### 2. The census passed while blind (process defect — mine)

Contract v1.2 §2.8 required a pre-schema shape census, and it ran. It printed JSON *types*, so
`unit` read as `string:1136 / null:39` — a healthy-looking field whose actual domain had five values
of which the schema named two. §2.8 now has a fourth mandatory clause: **the value domain of every
enumerated field**, and a requirement to sample fixtures **by combination** (the old fixture had
`unit: null` rows and value-present rows, and still never had a value-present row with a foreign
unit — the cell where all 123 failures lived).

### 3. An unrecognised unit was coerced to "absent" (genuine defect in the code)

`readDeclaredCostUnit` returned `CostUnit | undefined` and mapped anything unrecognised to
`undefined`, collapsing *"the estate declared no unit"* into *"the estate declared a unit I have
never heard of"*. This one survives the contract fix and is repaired regardless: three explicit
states, and an unrecognised unit now throws `UNIT_NOT_IN_SCHEMA` **naming the value**.

The first version of my own fix used `describe(raw)`, which prints `"string"` — reproducing the very
defect. The test caught it inside a minute, which is the argument for asserting on messages.

### 4. `CONFLICTING` maps to no chip (found by the new tests, not by the sweep)

34 shippable fee terms carry `verificationStatus: CONFLICTING`, which `CHIP_BY_STATUS` deliberately
omits (§2.1: it is not a chip). They failed the build. The estate declares these conflicts **by
reference** — `conflictsWithTermIds` names the disagreeing rows — where §7's `candidates[]` shape
assumes the readings are available inline, as they are for FX legs only.

Ruling: the invariant that matters is that **no scalar value reaches a consumer unarbitrated**. A
by-reference conflict projects `chip: UNKNOWN`, `reason: CONFLICTED`, no `value` key, with
`valueText` and the deduplicated pointers preserved. All 34 are already `calculationSafe: false` on
disk, so nothing is being taken away from an engine that had it.

## Changes

| File | Change |
|---|---|
| `types.ts` | `CardCostUnit` (narrow, cards) split from `CostUnit` (four values); `COST_UNITS`, `FOREIGN_COST_UNITS`, `isForeignCostUnit`, `UNIT_NOT_DETERMINABLE_MARKER`, `DeclaredCostUnit`; reasons `UNIT_NOT_DETERMINABLE`, `CONFLICTED`; `DECLARED_COST_UNITS` re-keyed to `CardCostUnit` |
| `cost-model.ts` | `readDeclaredCostUnit` to three states + throw; `CONFLICTING` handled centrally for all three families; the `OTHER` arm; FX-exposure trio on the known arm |
| `fee-terms.ts` | `conflictsWithTermIds` projected, deduplicated and sorted |
| `fx.ts`, `waivers.ts` | call-site updates only; no behaviour change (FX legs are PERCENT/ILS, waivers carry no `unit` — both measured) |
| `provenance.ts` | `UNIT_NOT_DETERMINABLE` added to `OBTAINABLE_REASONS`; cards' `readUnit` narrowed to `CardCostUnit` |

`DECLARED_COST_UNITS` re-keyed to `CardCostUnit` is the guard that matters: a single widened union
would have let a dollar-denominated `foreignAtmPct` typecheck. The compiler rejected exactly that
during the repair, which is the guard proving itself.

## Definition of done — verbatim

```
$ npx tsc --noEmit
TSC=0

$ npm run lint
> eslint "src/**/*.ts" "test/**/*.ts"
LINT=0

$ npx jest --runInBand --ci
Test Suites: 16 passed, 16 total
Tests:       356 passed, 356 total
JEST=0
```

All 15 pre-existing suites / 329 tests still pass, none weakened or deleted; `test/unit-domain.test.ts`
adds 27.

### L13 real-corpus (supervisor-run, all 1,175 fee terms · 43 FX pairs + 14 exceptions · 171 waivers)

```
projected: fees=1090  fxPairs=43  fxExceptions=14  waivers=171

  PASS  fees/fx/waivers: gates (paths / lineage / percent-range)
  PASS  no "lineage" key · no sourceLocalPath · no drive-letter path · no file:// URI · no codename
  PASS  every chip in the enum — 0 bad          PASS  projection never emits USER — 0 emitted
  PASS  UNKNOWN never carries a value key       PASS  UNKNOWN always has reason + obtainable
  PASS  fees/fx/waivers deterministic
  PASS  L13a: Hebrew and Arabic survive projection
      fees 1090 provenanced values, 60 NOT_PUBLISHED · fx 186, 0 · waivers 532, 85

  L13b — the ADR-010 target records, BY ID:
  PASS  term:yahav|op:isracard:CARD_FEE:14      63.31 USD, VERIFIED, FX-flagged
  PASS  term:otsar-hahayal|op:isracard:FOREIGN_ATM_FEE:5   175 EUR — not USD-special-cased
  PASS  term:one-zero|research:OTHER:14         UNKNOWN/UNIT_NOT_DETERMINABLE, no value, no unit
  PASS  term:mercantile|op:cal:CARD_FEE:26      UNKNOWN/CONFLICTED, no value key
  PASS  term:yahav|op:isracard:CARD_FEE:1       control: ILS row carries no FX-exposure keys
  PASS  conflict pointers projected, deduplicated and sorted
  PASS  every shipped foreign-currency amount is FX-flagged — 0 unflagged
  PASS  no ILS/PERCENT value carries an FX-exposure key — 0 wrongly flagged
      shipped: 109 foreign-currency · 34 conflicted · 1 unit-not-determinable

=== ALL BATCH-1 L13 CRITERIA PASS ===
```

Cards' pack re-verified byte-identical after all of this:
`c48e91204132409a8943a22ea545a5453dd2580796e91d9a6698b16cead500f6`, 979,069 bytes.

## costmodel §3 / §5.1's open question, answered

`auditForeignAtmSources` (built by the executor unprompted, which is why it was there when needed)
joins the two foreign-ATM sources. **167 joinable scopes, 8 unjoinable, 8 genuine disagreements.**
The conflict path is no longer theoretical:

```
org:jerusalem x org:cal   pair=3    feeTerm=3.9   (term:jerusalem|research:FOREIGN_ATM_FEE:13)
org:jerusalem             pair=3.9  feeTerm=3     (term:jerusalem|research:FOREIGN_ATM_FEE:17)
org:jerusalem             pair=3.9  feeTerm=2     (term:jerusalem|research:FOREIGN_ATM_FEE:20)
org:jerusalem             pair=3.9  feeTerm=0.9   (term:jerusalem|research:FOREIGN_ATM_FEE:27)
org:max x org:max         pair=3    feeTerm=22    (term:max|op:max:FOREIGN_ATM_FEE:2)      <-- see below
org:mizrahi-tefahot x org:max  pair=3  feeTerm=2  (term:mizrahi-tefahot|research:FOREIGN_ATM_FEE:18)
org:pagi x org:cal        pair=3    feeTerm=3.5   (term:pagi|op:cal:FOREIGN_ATM_FEE:1)
org:postal-bank           pair=2.5  feeTerm=4     (term:postal-bank|research:FOREIGN_ATM_FEE:10)
```

## Findings recorded, NOT fixed

**`term:max|op:max:FOREIGN_ATM_FEE:2` reads `22 PERCENT` against the pair's `3 PERCENT`.** A 22%
foreign-ATM commission is not a plausible Israeli rate; this looks like an ILS amount carrying a
PERCENT unit. It is **canonical data and was not touched** — no transform may infer a unit from a
magnitude (§6.2), which cuts both ways: I may not "correct" it either. It needs a human read against
the tariff. The other seven disagreements are plausible rate differences, not suspected type errors.

**`HISTORICAL` alone still fails the build, and the corpus DOES contain it.** The delivered report
says *"No cost-model row is `HISTORICAL` today"* — true of the 43-row fixture, **false of the
corpus: 85 fee terms are `HISTORICAL`.** They do not crash the build only because every one is
`shipToApp: false` (they are all `org:union`, a merged bank) and the shipping filter runs first. That
is luck, not design: one `HISTORICAL` row that ships will stop the build. Left as a hard stop, per
§2.3 — a bare `HISTORICAL` states that a value is old without stating what grade it earned, and the
alternatives are inventing a grade or silently discarding a real number. Flagged so it is a known
tripwire rather than a surprise.

**One FX leg is `CONFLICTING`** (`foreignAtmSameCurrencyFee`); it takes the same by-reference path.

**85 of 1,175 fee terms are dropped** by the shipping filter (`shipToApp: false`), all `org:union`.
1,090 ship. Stated because a count without its population is a defect even when it is right.
