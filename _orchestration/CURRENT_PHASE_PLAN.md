# CURRENT PHASE PLAN

Source of sequencing truth: `SMARTCARD_DEVELOPMENT_EXECUTION_MODEL.md` §15 (v2.0, AUTHORITATIVE).
This file is a working excerpt for quick resume, not a replacement — if it and the Execution Model
disagree, the Execution Model wins.

## Just completed (session 01, 2026-08-19)

```
✅ P-1   DONOR PRESERVATION            branch wip/expo-57-working-tree, commit 5c22411, pushed
✅ P0-A  DATASET IDENTITY + FREEZE     DATASET_ID marker + INPUT_MANIFEST.json, no rename
✅ E0    EXECUTOR CAPABILITY PROBE     TIER 1 (qualified) — see EXECUTOR_CAPABILITIES.md
✅ T4    SUPERVISOR STATE LAYER        this directory
```

## Next up — P0-B RECONCILIATION CENSUS (Lane C, Claude Code direct, 1-2d)

Not started. Not scoped in detail by this session (out of scope per the session brief). Before
starting it, a fresh session should:

1. Read `SMARTCARD_DEVELOPMENT_EXECUTION_MODEL.md` §15.3/§15.6 for where P0-B sits in the revised
   sequence, and whatever section defines P0-B's actual deliverable in detail (not fully read this
   session — orient by section, on demand, per the baseline's own instruction).
2. Read `_orchestration/STATE.json` `openBlockers` and `openOwnerDecisions` first.
3. Confirm `git status --porcelain` in `app\SmartCard` is still empty and HEAD still matches
   `STATE.json.branchMap` before trusting anything else in this file.

## Full remaining sequence (from Execution Model §15.6, unmodified)

```
      P0-B   Reconciliation census                Claude Code direct   1–2d   Lane C
      D0/D1  Coverage (per-institution) + FX min   Claude Code direct   1d     Lane R
      E1     Boundary lint as diagnostic           Claude Code + exec   1d     Lane E
      P0-C1  TIER-1 CONVENTION FREEZE              Claude Code direct   1d     ← THE GATE
      P1-A   Contract-agnostic infrastructure      1 executor           3–4d   Lane I
      P2-PREP Repo relocation (OD-10)              Claude Code direct   0.5d   Lane A — needs OD-13
      P1-B   Cards tracer bullet, end to end       1 executor           2d
      then   P1-B remaining families ‖ P2 migration ‖ P1-C → P1-D → P3 → P4 → P5 → P6 → P7 → P8
```

**Critical path:** `P-1 → P0-A → P0-C1 → P1-B(cards) → P1-C → P3 → P4` (unchanged by this session).

## Blockers carried into P0-B

- None that block P0-B specifically. P0-B does not require OD-13 or OD-14.
- OD-13 (app root relocation) and OD-14 (`newArchEnabled`) remain OPEN — neither gates P0-B; both
  gate later phases (P2-PREP and P2 native builds respectively). See `STATE.json.openOwnerDecisions`.
- OD-12 (SDK pin) has been **implemented** this session (Expo 57 committed, ADR-001 written) but the
  Owner Decisions register itself (`SMARTCARD_OWNER_DECISIONS.md`) — an Owner-only, append-only
  document — was deliberately left unedited by this session. It still reads "OPEN — recommended."
  Flagged for the Owner; see final session report.
