# CURRENT PHASE PLAN

Source of sequencing truth: `SMARTCARD_DEVELOPMENT_EXECUTION_MODEL.md` v2.4 §15–§18.

## ⛔ THE ONE THING BLOCKING EVERYTHING

**`TIER1_CONVENTIONS_OWNER_RULING.md` does not exist on disk.**

Expected at `C:\Users\ebrah\All application data\`. Referenced by name in the baseline (line 8), the
Owner register (lines 12, 66) and the Session 04 prompt — but never placed. A filesystem-wide search
returns nothing. The `R0`–`R6` tokens in the Execution Model are an **unrelated risk register**.

Until it lands, the dependency chain below cannot start:

```
TIER1_CONVENTIONS_OWNER_RULING.md on disk
   └─> Tier-1 contract amendment to v1.1   (an INCIDENT: needs an ADR)
          └─> P1-B cards tracer bullet     (provenance shape must be final first)
                 └─> P1-C adapter          (its signature IS the provenance shape)
                        └─> P0-C3+         (twelve more families)
```

**Why this is a hard block, not caution.** Session 04's audit found the contract was frozen without
R1 (`USER` chip), R2 (`STALE` as a modifier) and R3 (`obtainable`) — the three the brief itself
flags as structural. Projecting cards now bakes a provenance record with no `USER` state and `STALE`
as a peer rather than a modifier into the pack format, the adapter signature and the engine result
type. Every one of the thirteen families would then need re-projecting and re-goldening. That is
exactly the "Tier-1 convention churn after projection begins" risk the Execution Model rates
CRITICAL.

## Where things stand

```
✅ P-1 · P0-A · P0-B · D0 · E1 · P0-C1 (frozen) · P0-C2 (cards schema) · gate-#10 spec · P1-A
✅ S04 T1  contract audited — freeze did NOT incorporate R0–R6
✅ S04 T2  OD-18 ruling recovered — finding: it was never given (ADR-007)
✅ S04 T3  OD-19 approved; 15/15 passed integrity; cards schema → v1.1
✅ S04 T6  L13 real-corpus sweep — two defects found, both recorded
⛔ S04 T4  P1-B tracer bullet    DEFERRED — blocked above
⛔ S04 T5  conflict fixture      DEFERRED — shape depends on R2/R4
```

## What the Owner must do to unblock

1. **Place `TIER1_CONVENTIONS_OWNER_RULING.md`** at `All application data\` — or restate R0–R6.
2. **Rule OD-18.** It was never ruled (ADR-007). Options unchanged: (a) keep `UNKNOWN`, add
   `obtainable` — the register's recommendation; (b) rename to `WITHHELD`, add `obtainable`. The
   frozen contract currently implements (b) by accident. Best ruled *together* with R0–R6, since R3
   covers the same ground and both then land in one amendment incident.
3. **Correct the register** — two entries are wrong on disk:
   - OD-18: `⚠️ RULED IN-SESSION — VERIFY` → **`OPEN`**
   - OD-19: `OPEN — recommended` → **`APPROVED`** (ruled Session 04)
4. **Consider bundling two amendments found by measurement**, so the contract is opened once:
   - Gate 11 must key on `unit: "PERCENT"` **or** `kind: "PERCENTAGE"` — as frozen it catches **0 of
     the 5** real rows that would render `"3000%"`.
   - The Tier-1 contract should state the `lineage` omission itself (today it lives only in the
     gate-#10 spec and the cards schema), and gate #10 should assert **no `lineage` key survives**,
     not merely that its values look clean.

## Then — the sequence resumes

**P1-B cards tracer bullet.** Everything it needs is ready except the provenance shape: the cards
schema is at v1.1 with the filter settled (474 rows in `catalog.pack`, 378 displayed as current),
the gate-#10 rules are specified, and P1-A's framework is merged and green.

Its acceptance criteria stand as written in the Session 04 brief §7, plus one addition from T6:
**every gate that requires a built pack (2, 3, 4, 6, 7, 8, 9, and gate 10's round-trip assertion)
gets its own L13 real-corpus run the moment a pack exists.** That is an acceptance criterion, not a
follow-up.

**Then in parallel:** P1-C adapter · P0-C3+ per-entity schemas (fees first — largest path-leak
surface) · the G06b data lane (OD-17 approved, runs as its own session).

## Standing state

- **Frozen, and not to be edited casually:** `SMARTCARD_DATA_CONTRACT.md` v1.0,
  `SMARTCARD_DATA_CONTRACT_CARDS.md` **v1.1**, `SMARTCARD_GATE10_PROJECTION.md` v1.0. Changes are
  incidents requiring an ADR.
- Estate and archive are filesystem read-only (ADR-003); re-verified Session 04.
- `wip/expo-57-working-tree` is the interim integration branch (ADR-004). No `main`, deliberately.
- Pipeline repo at `C:\Users\ebrah\smartcard-data-pipeline`, **no remote yet**, untouched in S04.

## The lesson this session paid for, again

Three sessions running, the newest authority set has not reached `All application data\` before the
session began. Session 02 flagged it; Session 03 froze the contract against v1.3 because of it;
Session 04 could not audit that freeze because the ruling never arrived. **The gap is not in the
decisions — it is in getting them onto disk before the session that needs them.** A decision that
lives only in a chat transcript, or in a document that was written but not placed, is not yet a
decision this project can act on.
