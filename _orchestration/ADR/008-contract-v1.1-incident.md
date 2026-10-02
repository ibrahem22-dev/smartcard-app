# ADR-008 — INCIDENT: the v1.0 contract freeze did not hold; amended to v1.1

**Status:** Accepted — contract **RE-FROZEN at v1.1**
**Date:** 2026-08-20 · **Session:** 05, T1
**Classification:** **INCIDENT**, not an edit. Per contract §0, any change to Tier-1 requires an ADR
stating what broke and what it costs.

## What happened

`SMARTCARD_DATA_CONTRACT.md` was frozen at v1.0 in Session 03 **against an authority set that did
not contain the Tier-1 ruling.** The ruling (R0–R6) had been authored and was referenced by name in
three authority documents and one session prompt — but it never reached
`C:\Users\ebrah\All application data\`. Session 03 could not apply revisions it had no way to see.

Session 04 audited v1.0 against the ruling and found:

| | R0 | R1 | R2 | R3 | R4 | R5 | R6 |
|---|---|---|---|---|---|---|---|
| | APPLIED\* | **NOT** | **NOT** | **NOT** | PARTIAL | PARTIAL | PARTIAL |

\* Coincidentally — v1.0 matched the Session 02 draft, not the ruling.

**The three revisions flagged as structural were exactly the three entirely missing.** That is not
bad luck; it is the predictable result of freezing against an incomplete authority set.

Session 04 then **refused to amend**, because the ruling still was not on disk and the only
available source was a set of one-line summaries in its own prompt. Reconstructing authority from
summaries of authority, in order to edit the most expensive artifact in the project, is the failure
mode the whole freeze discipline exists to prevent. **That refusal was correct and is the reason
this amendment is trustworthy.**

## Why it happened, and what actually fixed it

The root cause is not carelessness in drafting. It is a **delivery** failure: mandatory instructions
were placed in a file that the session needing them did not have. This recurred across three
sessions — Session 02 flagged the sync gap, Session 03 froze against v1.3, Session 04 could not
audit because the ruling never arrived.

The fix was not to write the ruling more carefully. It was to **stop putting mandatory instructions
in a file a session may not have**: Session 05's prompt carries the full amendment specification
inline in its §4, with `SMARTCARD_DATA_CONTRACT_AMENDMENT_v2.md` on disk as durable reference. Both
were checked and match exactly. The prompt is the instruction; the file is the record.

That is a genuinely better process, and it is worth stating why: an instruction's reliability is
bounded by its delivery mechanism, not by its content.

## What changed in v1.1

| Rev | Section | Change |
|---|---|---|
| **R0** | §1 | Compiled-in `EXPECTED_DATASET_ID` with **hard refusal** on mismatch. States the authority split: the marker defines what the *estate* is, the constant defines what the *app will accept*. |
| **R1** | §2.1, §2.2 | **`USER` added to the chip enum.** No Layer-A source — it originates in the vault. Outranks every chip; never overwritten by a pack update. |
| **R2** | §2.3 | **`stale` becomes a modifier** (`stale: boolean` + `asOfDate`). `HISTORICAL` sets it and **retains its earned chip**. v1.0's fifth-state rule withdrawn. |
| **R3** | §2.1, §2.4 | **`WITHHELD` → `UNKNOWN`**, plus `reason` and `obtainable`, present iff `chip === UNKNOWN`. |
| **R4** | §2.5 | **Lattice frozen**: `USER > VERIFIED > ESTIMATE > UNKNOWN`, four propagation rules, implemented once in the framework's result type. |
| **R5** | §6.4-A, §6.4-B | Numeric benefit values projected **only** on a `valueTypeRaw` allowlist; everything else `UNKNOWN` with **raw text preserved**. Enum split folded into G06b's output spec. |
| **R6** | §6-A (new) | **`lineage` omission stated as a projection rule**, not only a gate. Gate #10 extended to assert no `lineage` key survives at any depth. |
| **R7** | §9 | **Gate 11 keys on `unit` OR `kind`**, with acceptance by record id (L13b). |

## The two changes that matter most, and why

**R2 — `stale` as a modifier rather than a state.** v1.0 collapsed a `HISTORICAL` value into a
`STALE` chip, **destroying information**: a fee that was `VERIFIED_OFFICIAL` as of a stated date
became indistinguishable from a stale estimate. As a modifier both facts survive —
*"verified, as of March 2025"* — which is simultaneously more useful and more honest, because the
verification genuinely happened.

**R3 — the chip enum and the spec no longer disagree.** v1.0 said `WITHHELD`; the spec says
`UNKNOWN`. The Owner register names that exact disagreement as the one unacceptable outcome, and
v1.0 shipped it. Reverting costs nothing here because §2 was being rewritten for R1/R2/R4 anyway,
and `reason` recovers the full precision `WITHHELD` was reaching for (`NOT_PUBLISHED` genuinely is
not "unknown") without amending a published product promise.

**And the one with the most downstream reach: `obtainable`.** `CUSTOMER_SPECIFIC` and `LOGIN_GATED`
are facts the *user* can supply, and must offer an "Add yours" affordance converting the value to
`USER`. Since per-card APR is permanently `CUSTOMER_SPECIFIC` by design, this is a primary path.
Without the flag, Card DNA §A's pencil appears everywhere or nowhere.

## Cost of this incident

**Low, because it was caught before projection.** No pack had been built, no adapter signature
existed, no engine consumed a provenance record. Session 04's decision to defer P1-B rather than
project against v1.0 is what kept the cost at "amend one document."

Had P1-B run against v1.0, the correction would have required re-projecting and re-goldening all
thirteen entity families, plus changing the adapter signature and the engine result type — the
"Tier-1 convention churn after projection begins" risk the Execution Model rates CRITICAL.

## Consequences

- **The contract is re-frozen at v1.1.** Any further change requires a new ADR and the same incident
  treatment.
- `SMARTCARD_DATA_CONTRACT_CARDS.md` v1.1 §4 was written against the v1.0 provenance shape and
  **must be re-derived** — it currently describes a record with no `USER`, no `stale` modifier and
  no `obtainable`. Tracked as a T3 prerequisite in this session.
- Gate 11's implementation must be amended per R7 and proven by record id (T2).
- **Process change worth keeping:** where a session depends on a ruling, the ruling belongs in the
  prompt, not only in a file. A referenced-but-absent authority is worse than no authority, because
  it invites reconstruction.
