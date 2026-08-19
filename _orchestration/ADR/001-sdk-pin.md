# ADR-001 — SDK Pin (OD-12)

**Status:** Accepted
**Date:** 2026-08-19
**Decides:** OD-12 (SMARTCARD_OWNER_DECISIONS.md)

## Context

The app repository's HEAD commit (`b285ca1`, 2026-07-24, branch `expo-57-upgrade-spike`) pins
Expo ~52.0.0 / React 18.3.1 / React Native 0.76.9 / TypeScript ^5.3.3. The working tree present at
session start (2026-08-19) — 22 modified files plus a large untracked set — pins a different stack
entirely.

## Decision

**Pin Expo ~57.0.8 / React Native 0.86.0 / React 19.2.3 / TypeScript ~6.0.3 — the working tree, not
HEAD.**

## Evidence

Read directly from `package.json` at each ref:

| | HEAD (`b285ca1`) | Working tree |
|---|---|---|
| expo | ~52.0.0 | ~57.0.8 |
| react | 18.3.1 | 19.2.3 |
| react-native | 0.76.9 | 0.86.0 |
| typescript | ^5.3.3 | ~6.0.3 |

`package-lock.json` in the working tree resolves `expo` at `~57.0.8` (line 20) — the lockfile
matches the working tree's `package.json`, not HEAD's. HEAD's Expo 52 pin matches neither the
lockfile nor the installed `node_modules` tree on disk.

Per SMARTCARD_OWNER_DECISIONS.md OD-12 and SMARTCARD_DEVELOPMENT_EXECUTION_MODEL.md §15.2, the
working tree additionally: typechecks clean, lints at `--max-warnings=0`, passes 410 tests across
42 suites, and produces a successful Android bundle (1,172 modules, 3.7 MB Hermes). These were
re-verified from the committed state in T1 Step 4 of this session — see
`_orchestration/reports/` / session final report for the actual command output.

No evidence on disk contradicts the recommendation.

## Consequences

- HEAD's Expo 52 pin is superseded by the working-tree commit (`wip/expo-57-working-tree`).
- `newArchEnabled` rides along as a separate, non-blocking item (OD-14): present in HEAD's
  `app.json`, deleted in the working tree's `app.json`, while `android/gradle.properties` still
  sets it `true` and `react-native-mmkv@3.3.3` expects the New Architecture. This is a P2 entry
  gate, not a P-1 blocker, and is NOT resolved by this ADR.
- Reverting to Expo 52 would discard a completed, working, tested upgrade in order to redo it
  later. Rejected for that reason.
