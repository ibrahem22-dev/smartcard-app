# T1 — CONTRACT AUDIT: WERE R0–R6 APPLIED TO THE FROZEN CONTRACT?

**Date:** 2026-08-20 · **Session:** 04, T1 · **Mode:** **OBSERVATION ONLY — nothing amended**
**Audited:** `SMARTCARD_DATA_CONTRACT.md` v1.0 (FROZEN 2026-08-20)

---

## 0. WHY THIS AUDIT COULD NOT BE COMPLETED AS SPECIFIED

**`TIER1_CONVENTIONS_OWNER_RULING.md` does not exist on disk.** Searched the entire user tree
(`find /c/Users/ebrah -maxdepth 4 -iname "*TIER1*" -o -iname "*OWNER_RULING*"`) — no result. It is
referenced **by name** in three places that do exist:

- `SMARTCARD_CURRENT_BUILD_BASELINE.md` line 8
- `SMARTCARD_OWNER_DECISIONS.md` lines 12 and 66
- the Session 04 prompt, §1 item 6

The `R0`–`R6` tokens that *do* appear in `SMARTCARD_DEVELOPMENT_EXECUTION_MODEL.md` (lines 736–741)
are **an unrelated risk register** — "R1 duplicate calculation logic", "R2 Tier-1 convention churn",
"R6 canonical estate written to by an executor". They are not the Tier-1 revisions.

**Consequence.** The audit below reports, for each of the seven questions in the Session 04 brief,
**what the frozen contract actually says**, with line evidence. It does **not** assert what R0–R6
require, because that text is unavailable. Applying revisions reconstructed from the brief's
one-line summaries would mean amending the project's most expensive artifact against a paraphrase —
the precise error class this session was convened to prevent.

Authority versions on disk at audit time: OWNER_DECISIONS **v1.5**, BUILD_BASELINE **v1.5**,
EXECUTION_MODEL **v2.4**. (Precondition A required v1.6/v1.6/v2.4; the brief's own §1 reading list
says v1.5/v1.5/v2.4, matching disk on the first two.)

---

## 1. FINDINGS

| # | Question | Verdict | Evidence |
|---|---|---|---|
| **R0** | datasetId assertion as a compiled-in expected constant with hard refusal | **APPLIED** | §1 line 40 |
| **R1** | `USER` chip ("Your value") in the product-facing enum | **NOT_APPLIED** | absent |
| **R2** | `STALE` as a *modifier* `{chip, stale, asOfDate}` | **NOT_APPLIED** — frozen as a fifth state | §2.1 line 80, line 85 |
| **R3** | `obtainable: boolean`; chip naming `UNKNOWN` vs `WITHHELD` | **NOT_APPLIED** on both counts | absent; §2.1 uses `WITHHELD` |
| **R4** | Lattice `USER > VERIFIED > ESTIMATE > UNKNOWN`, four propagation rules, one implementation | **PARTIAL** | §2.1 line 87, §4 lines 160–163 |
| **R5** | Benefits strict allowlist, raw text preserved, build gate, G06b note | **PARTIAL** | §6.4 lines 310–325, gate 12 line 446 |
| **R6** | Projection **omits** `lineage`; gate asserts no `lineage` key survives; both FP families fixtured | **PARTIAL** | GATE10 Rule D line 118 |

**Summary: one applied, three not applied, three partial. The freeze did not incorporate the
ruling.** R0's compliance is almost certainly coincidental — it reflects what the Session 02 draft
already said, not an applied revision.

**The three the brief flags as structural — R1, R2, R4 — are exactly the three that are missing or
incomplete.** All three shape the provenance value that the P1-C adapter returns and that every
engine consumes. This is why T4 was not attempted.

---

## 2. DETAIL

### R0 — datasetId assertion · APPLIED
> §1, line 40: *"The application's ingest path MUST assert `datasetId === "smartcard-canonical-v2"`
> before trusting any pack content, and MUST refuse the pack on mismatch (this is gate #9)."*

A literal expected constant plus a hard refusal. Satisfies the requirement as stated in the brief.

**One tension worth recording:** §1 also says identity *"MUST be read from the `DATASET_ID` marker
file … and MUST NOT be inferred from the containing folder's name."* Those coexist correctly — the
marker governs what the **estate** is for the pipeline; the compiled-in literal governs what the
**app** will accept — but the contract never says so explicitly, and a reader could take the first
sentence as licence to trust whatever the marker reports. Worth one clarifying sentence whenever the
contract is next opened.

### R1 — `USER` chip · NOT_APPLIED
The chip enum (§2.1, lines 76–81) is exactly `VERIFIED · ESTIMATE · CONFLICT · WITHHELD · STALE`.
No `USER`, no "Your value", no vault-originated concept anywhere in the document.

**Why this matters more than a missing enum member.** OD-18's own text (register lines 426–430)
states that `CUSTOMER_SPECIFIC` and `LOGIN_GATED` are *"facts the user can supply, and should render
an 'Add yours' prompt that converts the value to `USER`"*, and that **per-card APR is permanently
`CUSTOMER_SPECIFIC` by design** — so the conversion target is load-bearing, not an edge case. The
frozen contract has no state for a user-supplied value to land in.

### R2 — `STALE` as modifier · NOT_APPLIED
> §2.1, line 80: `| STALE | HISTORICAL | false | No |` — a row in the chip table, i.e. a fifth state.
> §2.1, line 85: *"`STALE` MUST be distinct from `WITHHELD`."* — explicitly a peer state.

No `stale: boolean`, no `asOfDate`. The contract collapses a `HISTORICAL` value's *earned* chip into
`STALE`, losing the distinction between "this was VERIFIED and is now old" and "this was an ESTIMATE
and is now old". If R2 requires the modifier form, this is a structural change to every provenance
record.

### R3 — `obtainable` and chip naming · NOT_APPLIED
`obtainable` appears nowhere. On naming, the contract uses **`WITHHELD`** — which is OD-18's option
**(b)**, while the register's stated recommendation is option **(a)** (keep `UNKNOWN`, add
`obtainable`). See ADR-007: the in-session ruling Session 03 obtained did **not** cover this
question.

### R4 — the lattice · PARTIAL
Present:
> §2.1 line 87: *"A chip MUST NOT be upgraded by any downstream process. Derivation can only preserve
> or degrade."*
> §4 lines 160–163: the ESTIMATE propagation rule with mandatory result downgrade and reason trace.
> §7 line 361: conflicts take the conservative candidate and downgrade to `ESTIMATE`.

Missing: no explicit ordered lattice (impossible without `USER`), not expressed as four named
propagation rules, and **no requirement that it be implemented exactly once in the engine
framework's result type**. That last clause is the one with teeth — without it, each engine
implements propagation independently, which is the "one brain, many surfaces" defect class E1 found
three live instances of.

### R5 — benefits handling · PARTIAL
Present: the closed enum (§6.4 line 310), deterministic classification from `valueTypeRaw` (line
321), the rule that `valueTypeRaw: null` must **not** default to `PERCENTAGE` (line 325), and build
gate 12 (line 446).

Missing: no explicit requirement to **preserve the raw text** of a withheld value (the contract
withholds the number but is silent on keeping the human-readable description), and **no G06b
schema-split note** — G06b will rewrite this corpus, and the contract does not tell it what shape to
emit.

### R6 — `lineage` omission · PARTIAL
Present: `SMARTCARD_GATE10_PROJECTION.md` Rule D line 118 — *"DROP `<family>.lineage` (entire
object)"* — which is omission, not scrubbing. `SMARTCARD_DATA_CONTRACT_CARDS.md` §2.6 also excludes
it.

Missing, and this is the substantive half:
1. **The Tier-1 contract itself never mentions `lineage`.** `grep -n lineage SMARTCARD_DATA_CONTRACT.md`
   returns nothing. The omission rule lives only in a subordinate spec and one entity schema, so
   family #3 through #13 could each re-derive it differently.
2. **Gate #10 does not assert that no `lineage` *key* survives.** Its condition (§3) is
   pattern-based — `file://`, drive letter, UNC, user-home, codename. A `lineage` object whose
   values happened to be clean would pass the gate untouched. A key-level assertion is a different
   and stronger check than a value-pattern scan.
3. Both false-positive families **are** represented in the spec's §5.2 fixtures (N1–N5) — but as
   paraphrases. The real corpus strings were added to the *implementation* during the Session 03 R2
   repair (`test/corpus-negative-fixtures.json`, six verbatim strings) and were never back-ported
   into the spec, so §5.2 still lists five negatives while the code tests eleven.

---

## 3. ONE FURTHER DEFECT FOUND BY THE T6 SWEEP, RECORDED HERE BECAUSE IT IS A CONTRACT DEFECT

**Gate 11 does not catch the defect it was created for.**

Contract §6.3 scopes the range gate to *"any field with `unit: "PERCENT"`"*. Measured against the
real corpus:

| | |
|---|---|
| benefits rows with `value.kind === "PERCENT"` | 206 |
| …of which carry `value.unit` matching PERCENT | **20** |
| …rows whose value exceeds 100 | 5 |
| …of those, how many carry `unit: "PERCENT"` | **0** |

All five rows that would render `"3000%"`, `"400%"`, `"200%"`, `"190%"`, `"180%"` have
`unit: undefined`. **Gate 11 as frozen would catch none of them.**

The defect is still covered end-to-end, because gate 12 is `kind`-based and remaps
`POINTS_PER_SPEND`/`BONUS_BENEFIT` out of the percentage path. But §6.3's stated purpose — *"the
range gate is what catches the next instance without anyone having to notice it"* — is unmet for the
benefits family, which is the only family where the overload actually occurs.

**Recommended amendment:** gate 11 keys on `unit: "PERCENT"` **or** `kind: "PERCENTAGE"`.

---

## 4. WHAT THIS MEANS FOR THE SEQUENCE

The contract is frozen, incomplete, and **cannot be corrected without the ruling**. The dependency
chain is:

```
TIER1_CONVENTIONS_OWNER_RULING.md on disk
        └─> contract amendment to v1.1 (an INCIDENT, with an ADR)
                └─> P1-B projection      (provenance shape must be final first)
                        └─> P1-C adapter (its signature IS the provenance shape)
                                └─> P0-C3+ twelve more families
```

Projecting cards now would bake a provenance record with no `USER` state, `STALE` as a peer rather
than a modifier, and no `obtainable` flag into the pack format, the adapter signature and the engine
result type — then require re-projection and re-goldening of every family once the ruling lands.
That is precisely the "Tier-1 convention churn after projection begins" risk the Execution Model
rates CRITICAL.

**Nothing in this document was amended. The freeze stands as written, now with a known gap list.**
