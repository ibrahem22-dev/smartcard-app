# CURRENT PHASE PLAN

Source of sequencing truth: `SMARTCARD_DEVELOPMENT_EXECUTION_MODEL.md` §15–§16 (v2.1,
AUTHORITATIVE). This file is a working excerpt for quick resume, not a replacement.

## Just completed (session 02, 2026-08-19/20)

```
✅ P0-B  RECONCILIATION CENSUS         P0-B-census.md + field-census.json
✅ —     FREEZE COMPLETED              canonical/ now fully sha256-checksummed
✅ OD-15 ENVIRONMENT CONTROLS          estate + archive read-only (OS ACL), verified both ways
✅ D0    BENEFIT COVERAGE PER INST.    verdict: HIGH user-visible impact
✅ E1    BOUNDARY-LINT DIAGNOSTIC      first delegation — validated after 1 repair
✅ —     HOUSEKEEPING                  CLAUDE.md neutralized, secret scan clean, drift fixed
✅ —     TIER-1 CONVENTIONS DRAFT      written, NOT frozen — see below
```

## Next up — P0-C1 TIER-1 CONVENTION FREEZE — **BLOCKED ON OWNER APPROVAL**

**Not started, and must not be started, until the Owner has reviewed
`_orchestration/reports/TIER1-CONVENTIONS-DRAFT.md`.** That document proposes answers for all nine
required conventions with evidence; two items are left explicitly open (see the draft's own
summary section) and need an Owner call, not a supervisor judgment call, before the freeze can
happen — that asymmetry (cheap to decide now, expensive to change after P1 encodes it) is the
entire reason this session split "draft" from "freeze."

Before a future session runs P0-C1 itself, it should:
1. Confirm the Owner has actually reviewed the draft (don't assume silence is approval).
2. Resolve the two open items from the draft's summary (the `ESTIMATE`/`calculationSafe`
   propagation question, and the `benefits[].value.kind:"PERCENT"` unit overload — the second one
   has a **live, reproducible bad output** if shipped unresolved: `${value}%` renders `"3000%"` for
   real records today).
3. Only then write the actual frozen contract and mark OD-16 (estate path immutable — also still
   technically OPEN in the register) resolved alongside it, since the draft's item 1 depends on it.

## Full remaining sequence (from Execution Model §15.3/§15.6, unmodified)

```
      P0-C1  TIER-1 CONVENTION FREEZE              Claude Code direct   1d     ← THE GATE, BLOCKED
      P1-A   Contract-agnostic infrastructure      1 executor           3–4d   Lane I
      P2-PREP Repo relocation (OD-10)              Claude Code direct   0.5d   Lane A — needs OD-13
      P1-B   Cards tracer bullet, end to end       1 executor           2d
      then   P1-B remaining families ‖ P2 migration ‖ P1-C → P1-D → P3 → P4 → P5 → P6 → P7 → P8
      D1     FX minimum fees (separate Lane R session — research, not this session's job)
```

**Critical path:** `P-1 → P0-A → P0-B → P0-C1 → P1-B(cards) → P1-C → P3 → P4`.

## Standing state a future session must re-confirm before trusting anything

- The canonical estate and `_app_archive\` are filesystem **read-only** (OD-15 ACL, session 02).
  Verify with `icacls "C:\Users\ebrah\All application data\smartcard-canonical-v1"` before assuming
  a write there will work; see ADR-003 for the reversal command if a deliberate write is needed.
- `task/E1-boundary-lint` (commit `5842152`) is validated but **not merged** into
  `wip/expo-57-working-tree`. `.eslintrc.boundaries.js` is diagnostic-only by design — do not wire
  it into CI without a deliberate decision to do so.
- OD-15 and OD-16 remain `OPEN — recommended` in `SMARTCARD_OWNER_DECISIONS.md` as of this writing,
  even though both were acted on this session per direct Owner instruction in the session brief.
  Confirm the register has been formally updated before assuming that status has changed.

## Blockers carried forward

- P0-C1 blocked on Owner approval of the Tier-1 draft (this session's main deliverable).
- OD-13 (app root relocation) and OD-14 (`newArchEnabled`) remain open — neither gates P0-C1; both
  gate later phases (P2-PREP and P2 native builds respectively).
