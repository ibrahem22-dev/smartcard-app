# ADR-007 — OD-18 recovery: the ruling the register believes exists was never given

**Status:** Finding recorded — **OD-18 REMAINS OPEN**
**Date:** 2026-08-20
**Session:** 04, T2
**Action required:** Owner must rule on OD-18. The register entry must be corrected, not merely
filled in.

## What T2 was asked to do

> *"Session 03 reported that the Owner ruled live on both open draft items… That ruling exists only
> in a chat transcript… Read the actual ruling back out of the frozen contract — what did it decide
> about the chip naming (UNKNOWN vs WITHHELD) and about ESTIMATE/calculationSafe propagation? Record
> it verbatim."*

The register (`SMARTCARD_OWNER_DECISIONS.md` lines 409–413) states the same expectation:

> *"Session 03 reported that when it stopped at the failed precondition, the Owner 'approved and
> ruled on both open items' live… The ruling must be read back out of the frozen contract at Session
> 04 T1 and recorded here verbatim."*

## What actually happened, and it is not what the register assumes

**Session 03 asked the Owner exactly three questions. None of them was OD-18's question.**

Reconstructed from the Session 03 transcript, the three questions and their answers were:

| # | Question asked | Owner's answer |
|---|---|---|
| 1 | How to proceed given the Tier-1 draft was unapproved? | *"Approve now, run full session"* |
| 2 | Do `ESTIMATE`-chip values stay `calculationSafe`? | *"Yes — compute, but downgrade the result"* |
| 3 | How to fix the benefits `PERCENT` overload rendering `"3000%"`? | *"Schema split at the pipeline"* |

**OD-18 asks a different question entirely:** whether to keep the spec's `UNKNOWN` chip and add
`obtainable: boolean` (option a, the register's recommendation), or amend spec §2 and §11-A to
rename it `WITHHELD` (option b).

The conflation is understandable and traceable. The **Tier-1 draft's** two open items were
(1) ESTIMATE/`calculationSafe` and (2) the benefits `PERCENT` overload — and those two *were* ruled
on. **OD-18 is a third, separate item**, raised in register v1.4, which Session 03 never saw because
it was running against a v1.3 register. Session 03 asked about "both open items" meaning the
draft's; the register read that as covering OD-18. It did not.

## Consequence: the frozen contract took option (b) without a ruling

`SMARTCARD_DATA_CONTRACT.md` §2.1 uses **`WITHHELD`**, and `obtainable` appears nowhere in the
document. That wording came from the Session 02 draft, which I authored — not from any Owner
decision.

So the frozen contract currently:

- adopts **option (b)** — the option the register does **not** recommend;
- amends a **published product promise** (spec §2's four-state provenance vocabulary, enforced by
  the shared chip component) — which OD-18 explicitly says *"is a deliberate amendment, not a
  contract detail"*;
- omits `obtainable`, which OD-18 says **both** options must carry regardless, and which is
  load-bearing because per-card APR is permanently `CUSTOMER_SPECIFIC` by design.

Register line 441 states the one unacceptable outcome: *"the chip enum and the spec disagreeing."*
**That is the current state.**

## Decision recorded

**OD-18 is OPEN. It was never ruled.** The register's `⚠️ RULED IN-SESSION — VERIFY` status is
**incorrect** and must be changed to `OPEN`, not completed.

This ADR deliberately records a *negative* result. The instruction was to recover a ruling and write
it down verbatim; the honest outcome of that instruction is that there is no ruling to recover, and
writing one down would manufacture an Owner decision from a supervisor's drafting choice. That is
the exact failure mode the append-only register exists to prevent — and it very nearly happened,
because two documents already assert the ruling exists.

## What the Owner needs to decide

OD-18, as originally posed (register §3, lines 418–441):

- **(a) Recommended** — keep `UNKNOWN`, add `obtainable: boolean`. No spec amendment; the four-state
  promise holds; the "Add yours" affordance is unlocked.
- **(b)** — amend spec §2 and §11-A to `WITHHELD`, add `obtainable`. Arguably the better word, at
  the cost of amending a published promise and re-touching two spec sections plus the chip
  component.

Either way `obtainable: boolean` is required, true for `CUSTOMER_SPECIFIC` and `LOGIN_GATED`.

**This should be ruled together with R0–R6**, since R3 covers the same ground and the contract can
then be amended to v1.1 in a single incident rather than two.

## Register corrections required

1. **OD-18** — status `⚠️ RULED IN-SESSION — VERIFY` → **`OPEN`**. Add a note that Session 03's
   in-session ruling covered the draft's two items only.
2. **OD-19** — status `OPEN — recommended` → **`APPROVED`** (ruled in Session 04: ship the 15
   flagged, subject to the per-row integrity check, which they all passed — see the cards schema
   amendment and `_orchestration/reports/` for the per-row evidence).
