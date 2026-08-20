# ADR-006 — Tier-1 data contract frozen (P0-C1)

**Status:** Accepted — **FROZEN**
**Date:** 2026-08-20
**Session:** 03, T3 · **Phase:** P0-C1, the critical-path gate

## Context

Tier-1 conventions are cheap to decide and catastrophic to change late: every row, gate, adapter
signature, engine assertion and test fixture encodes them. Session 02 therefore deliberately
produced a *draft* (`_orchestration/reports/TIER1-CONVENTIONS-DRAFT.md`) and stopped short of
freezing, leaving two items explicitly open for the Owner.

## The approval, and a precondition that initially failed

Session 03's §1 precondition B required that the Owner had approved the draft and resolved both open
items. **It failed on first check**, and the session stopped rather than proceeding:

- The draft was unchanged since Session 02 committed it (`git status` clean; sole commit `c560610`),
  still titled *"DRAFT — PROPOSED — NOT FROZEN — REQUIRES OWNER APPROVAL"*.
- Baseline v1.3 §1 line 38 read *"Tier-1 draft — written, NOT frozen — awaiting Owner review (2 open
  items)"*, and §8 line 213 read *"▶ OWNER Approve Tier-1 draft ← THE GATE"*.
- The Owner register v1.3 §1 called it *"the true gate on the next session"*.
- Execution Model v2.3 contained no approval statement.

The Owner then **approved in session** and ruled on both open items. That ruling is the authority for
this freeze:

| Open item | Owner ruling |
|---|---|
| Do `ESTIMATE`-chip values stay `calculationSafe`? | **Yes** — engines may compute with them, but any result derived from an `ESTIMATE` input carries the `ESTIMATE` chip and records the downgrade in its reason trace. A chip is never upgraded by derivation. |
| How to fix the `benefits.value.kind:"PERCENT"` overload that renders `"3000%"`? | **Schema split at the pipeline.** `value.kind` becomes a closed enum; classification is deterministic from `valueTypeRaw`; a row that cannot be classified is projected `WITHHELD` with no numeric value, never guessed. |

## Decision

**`SMARTCARD_DATA_CONTRACT.md` v1.0 is FROZEN as of 2026-08-20**, covering all nine Tier-1
conventions. `SMARTCARD_DATA_CONTRACT_CARDS.md` v1.0 is frozen alongside it as the first entity
schema (P0-C2), and `SMARTCARD_GATE10_PROJECTION.md` v1.0 specifies gate #10.

Any subsequent change to the Tier-1 contract is an **incident**, not an edit: it requires a new ADR
stating what broke and what the change costs, Owner approval, and invalidates every artifact that
encoded the previous convention.

## The finding that most changed the contract

The brief required the contract to state what the corpus *actually* holds per field, not to assume.
A field-by-field sweep was run for this freeze. **The corpus is mixed — but the mix is confined to
places that must not ship, which shrinks the normalization work from "unknown and possibly large" to
"6 rows and 130 classifications, in a non-critical pack".**

- **Every field the application reads holds one convention** (whole-number-percent). The resolved
  cost layer `cards.costs.*` has **zero values in (0,1)** across 1,034 populated values.
- **The fraction pocket is real** and sits in raw inherited evidence sub-objects
  (`cards.verifiedFees.*`: `conversionFees[].rate`=0.025, `reloadFees[].rate`=0.008–0.025, and
  conventions *mixed within single fields*). Excluding those sub-objects from projection — which is
  correct anyway, since they carry the path leaks too — removes the entire problem from the shipping
  path.
- **The FIBI hazard is confirmed and was already corrected in-data**: 20 benefit rows carry
  `value.originStoredAs`, recording that FIBI stored `0.16` for 16% and that it was multiplied by
  exactly 100.

**The most consequential single line in the contract is a prohibition** (§6.2): the heuristic
*"value < 1, therefore it is a fraction, multiply by 100"* MUST NEVER be implemented. It is the
obvious rule, and it is wrong on this corpus — there are at least ten genuine sub-1 percentages
(`0.8%` Postal Bank load fee, `0.95%` Isracard FX, `0.9%` Bank Jerusalem promotional ATM rate,
`0.1–0.3%` ONE ZERO commissions). Applying it would corrupt real data while producing plausible
output, which is the worst available failure mode.

## Consequences

- Two new gates exist (#11 PERCENT range, #12 benefits `value.kind` enum), extending the established
  ten rather than renumbering them.
- P1-B's projection is now fully specified for cards and for path-stripping; it should not need to
  invent anything.
- One item is deliberately left **OPEN** in the cards schema (§3): the 15
  `EXCLUDED_FROM_PRODUCT_COUNT` rows, which the session brief's filter did not account for. The
  conservative default (do not ship) applies until the Owner rules.
