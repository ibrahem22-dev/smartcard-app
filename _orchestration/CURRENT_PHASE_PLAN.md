# CURRENT PHASE PLAN

Source of sequencing truth: `SMARTCARD_DEVELOPMENT_EXECUTION_MODEL.md` v2.3 §15–§17.
This file is a working excerpt for quick resume, not a replacement.

## The design phase is over

```
✅ P-1    Donor preservation          commits 5c22411 + 15a7dbf
✅ P0-A   Dataset identity + freeze   DATASET_ID + INPUT_MANIFEST (per-file sha256)
✅ E0     Executor capability probe   Tier 1, qualified
✅ P0-B   Reconciliation census       ~70 metrics reconciled; gate #10 sized
✅ D0     Benefit coverage            verdict HIGH
✅ E1     Boundary-lint diagnostic    86-violation backlog, ADOPTED and merged
✅ P0-C1  TIER-1 CONVENTION FREEZE    ← THE GATE, CLEARED 2026-08-20
✅ P0-C2  Cards entity schema         frozen, one item open (OD-18)
✅ —      Gate #10 projection spec    rules A–E, 13 fixtures
✅ P1-A   Pipeline infrastructure     kickoff slice merged (b3caa69), 2 repairs
```

**Everything after this point is building, not deciding.**

## Next — two lanes, genuinely parallel

### Lane C — P0-C3+ per-entity schemas (supervisor direct)
Twelve families remain, following the pattern `SMARTCARD_DATA_CONTRACT_CARDS.md` established:
fees · FX · waivers · billing · interest · clubs/programmes · relationships · benefits · stacking ·
merchants · content · conflicts.

Order by what P1-B needs first. Cards is done; **fees is the natural second** — it is the largest
path-leak surface (1,676 of 1,951) and the tracer bullet's cost values resolve through it.

### Lane I — P1-B cards tracer bullet (delegable)
End-to-end: read estate → project → gate → pack → manifest → verify. The infrastructure is built
and the contract is frozen, so this should need no new decisions. It **must** include:
- the ten data gates plugged into the P1-A framework, each with its corrupted fixture
- gate #10's round-trip assertion: zero detector hits across every output pack
- **a corrupted fixture for the conflict path** — zero shippable cards have a `CONFLICTING` cost
  field, so that path ships untested by real data unless a fixture proves it

## Blocked on the Owner before P1-B

| ID | Question | Default if unanswered |
|---|---|---|
| **OD-18** *(new)* | Do the 15 `EXCLUDED_FROM_PRODUCT_COUNT` cards ship flagged, like the 81 RETIRED/TARIFF_ONLY? Recommended: yes. | NOT shipped. Manifest counts must say 459 or 474. |
| **OD-17** | Does G06b move out of P5c into a parallel data lane now? Recommended: yes, start after P0-C1. | Stays at P5c; the evidenced empty state becomes a designed MVP surface. |

Neither blocks Lane C. OD-18 blocks the cards pack's final row count; OD-17 blocks the G06b lane's
start date.

## Standing state a future session must re-confirm before trusting anything

- **Three documents are FROZEN** at `All application data\`: `SMARTCARD_DATA_CONTRACT.md`,
  `SMARTCARD_DATA_CONTRACT_CARDS.md`, `SMARTCARD_GATE10_PROJECTION.md`. Changing any of them is an
  **incident** requiring a new ADR and Owner approval — not an edit.
- The canonical estate and `_app_archive\` are filesystem read-only (ADR-003). Verify with `icacls`
  before assuming a write will work; the reversal command is in ADR-003.
- `wip/expo-57-working-tree` is the **interim integration branch** (ADR-004) until OD-13 resolves.
  There is no `main` in the app repo, deliberately.
- The pipeline lives at `C:\Users\ebrah\smartcard-data-pipeline` — a **separate repo, outside the
  app repo** (OD-10). It has **no GitHub remote yet**.
- `AGENTS.md` is gone from the app repo working line by design (ADR-005). It is at tag
  `archive/legacy-governance-2026-08-19`. **Do not restore it** — it pins Expo 52 and contradicts
  OD-12.
- Three legacy governance artifacts still sit at the **workspace root** and were deliberately not
  removed (zero-commit git = no recoverability). See ADR-005 residual risk.

## The two lessons the delegation record has now paid for twice

1. **An executor's report is a hypothesis.** Two delegations, two materially wrong self-reports —
   E1 claimed a file was "already committed" when it had created it; P1-A shipped code that did not
   compile because it could not run its own tools. Both were caught only by independent re-running.
2. **Fixtures written by the implementer test the implementer's understanding.** P1-A's 13 fixtures
   all passed while the detector false-positived on 9% of real prose. The defect surfaced only when
   the supervisor ran it against the **actual corpus**. For any gate, test against real data, not
   against a paraphrase of it.
