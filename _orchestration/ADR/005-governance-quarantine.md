# ADR-005 — Legacy governance artifacts are removed from the working line, not just labelled

**Status:** Accepted
**Date:** 2026-08-20
**Session:** 03, T1

## Context

Session 02's first delegation produced the project's most useful supervision evidence: an
executor, given a task packet that named its context files explicitly and said *"Do not
read the whole repository. Everything you need is listed here"*, read `AGENTS.md` anyway,
cited two of its sections back in its report, and appended a governance section invoking a
review process that no longer exists.

The relevant property of `AGENTS.md` is not that it is old. It is that it is an **active,
imperative, contradicting directive**:

- Line 5: *"This file is your only instruction source. Read it fully before every task."*
- §2, "Tech Stack (Pinned — Do Not Upgrade)": **Expo SDK 52 · RN 0.76.9 · React 18.3**,
  with *"v24 crashes SDK 52 — BANNED"*. **OD-12 (APPROVED, closed) pins Expo 57.0.8 /
  RN 0.86.0 / React 19.2.3 / TS 6.0.3.** An agent obeying `AGENTS.md` would revert the
  entire Session 01 preservation and call it compliance.

Baseline v1.3 §7 already classified this file HISTORICAL. That label was necessary and
insufficient: labels live in documents an executor is not required to read, while
`AGENTS.md` sat at the repository root, where tooling and models look by convention.

## Decision

**Legacy governance artifacts are deleted from the working line and preserved in git
history behind an annotated tag.** Labelling them historical is not a control; removal is.

Applied to: `AGENTS.md` (843 lines, tracked since `b2fcf43`).
Preserved at: **`archive/legacy-governance-2026-08-19`** (annotated, pushed).
Recover with: `git show archive/legacy-governance-2026-08-19:AGENTS.md`

The governing principle, which generalises past this one file:

> **Content that does not exist cannot contaminate.** Where an instruction file and a
> current Owner decision disagree, and an agent has demonstrated it will read outside its
> authorized scope, the file must be removed rather than annotated.

## Scope — what was deliberately NOT removed, and why

| Kept | Reason |
|---|---|
| `docs/RTL_LTR_RULES.md`, `docs/RTL-AGENT-GUARD.md`, `docs/RTL_RECOVERY_AUDIT.md` | Zero dead-era vocabulary. Technical direction-handling references, not agent governance. The Forensic Adoption Decision rates the i18n/RTL kit among the strongest inheritable subsystems; deleting its documentation would discard working knowledge. |
| `docs/SEC-CONTRACT-001.md`, `docs/SECURITY-REVIEW-M1-M2-GATE-2026-06-25.md` | Security key-lifecycle contract and its review. Still describes `keyVault.ts` as built. |
| `docs/ANDROID_BUILD_PATH_LENGTH_FIX.md` | An environment workaround that is still true. |
| `_orchestration/validation/E1.md`, `LEDGER.jsonl`, `STATE.json` | These *quote* the dead vocabulary because they are the **incident record**. Deleting the evidence of a contamination event to make a grep pass would be the wrong kind of clean. The L11 grep therefore excludes `_orchestration/` by design, and that exclusion is stated wherever the grep is run. |

The one executor-authored artifact that did carry contamination —
`_orchestration/reports/E1-boundary-violations.md` §8 — was **stripped** (commit
`7bb378f`) rather than kept, because it is a durable input to P2/P3 rather than a record
of the incident, and a future reader would reasonably treat it as current guidance.

## Residual risk — NOT actioned this session, flagged for the Owner

Three legacy governance artifacts remain at the **workspace root**
(`C:\Users\ebrah\SmartCard-Agent\`), which is in the parent chain of every executor
worktree and therefore still reachable:

| Artifact | Size |
|---|---|
| `SmartCard_Master_Instructions.md` | 187 KB |
| `AGENTS.md` (a different, 48-line file) | 1.4 KB |
| `docs/decision-room/` | ~40 files |

They were **not** removed, for one decisive reason: **the workspace-root git has zero
commits**, so nothing there can be preserved behind a tag. Deletion would be
irreversible, and this project's operating principle is that irreversible acts on
unpreserved content require an Owner decision, not supervisor initiative. `CLAUDE.md` at
that root was already neutralised in Session 02 (content replaced with a pointer to the
current authority set), which is the reversible half of the fix.

**Recommended:** move the three artifacts to a quarantine directory outside every
worktree's parent chain — a move, not a delete, so it stays fully reversible — or
initialise history at that root first. Either is a small task; both need the Owner to
choose, because the second one touches a repository this project's constraints have
deliberately kept untouched.
