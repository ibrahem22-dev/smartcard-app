# ADR-004 — `wip/expo-57-working-tree` is the interim integration branch

**Status:** Accepted
**Date:** 2026-08-20
**Session:** 03, T2

## Context

This repository has no designated trunk, and that ambiguity has already cost time in
every session so far:

- `HEAD` at the time of the forensic was `expo-57-upgrade-spike` @ `b285ca1` (2026-07-24,
  still Expo 52).
- The preserved working tree — the thing that actually typechecks, lints and passes 410
  tests — was committed by Session 01 onto `wip/expo-57-working-tree`.
- There is no `main`. There is no `develop`.
- Baseline v1.3 §4.4 calls `wip/expo-57-working-tree` "an **archival record, not the
  development line**", which was accurate when written but is no longer how the branch is
  being used: Sessions 02 and 03 have both committed the supervisor state layer, the
  census reports, the governance quarantine and now the E1 adoption onto it.

Session 03 T2 needed a merge target for `task/E1-boundary-lint`, which forced the
question rather than allowing it to be deferred again.

## Decision

**`wip/expo-57-working-tree` is the interim integration branch until OD-13 resolves at
P2-PREP.** Task branches merge into it. It is the branch every gate is run against and
the branch whose green state `STATE.json.lastGreenCommit` records.

**Explicitly NOT decided here, and deliberately so:**
- No `main` is invented. Creating a trunk now would pre-empt OD-13, which is the Owner's
  decision about the application root and is held to P2-PREP.
- No branch is renamed. Renaming `wip/expo-57-working-tree` would break the remote
  tracking of a branch that is currently the only complete copy of two months of
  otherwise-unpreserved work.
- `expo-57-upgrade-spike` is left exactly as it is. It is not deleted, not merged, not
  rebased.

## Why not the alternatives

| Option | Rejected because |
|---|---|
| Create `main` from the preserved tree now | Pre-empts OD-13. The Owner deliberately held the app-root decision to P2-PREP, and "which branch is trunk" is part of that question, not separate from it. |
| Rename `wip/…` to something respectable | Cosmetic gain, real risk: it is the only branch holding the preserved donor tree, and it is already referenced by hash and by name in ADR-001, three session reports and the Owner-facing baseline. |
| Keep merging nothing; leave task branches unmerged | E1's backlog is a durable P2/P3 input. Leaving it stranded on a task branch means the next session rediscovers it, which is the failure mode the state layer exists to prevent. |

## Consequences

- The branch name reads oddly for an integration branch. That is accepted, on the same
  reasoning as OD-16 accepted an oddly-named estate folder: a name that reads wrong is
  cheaper than a rename that breaks references.
- **At P2-PREP, when OD-13 resolves,** the relocation should establish a properly-named
  trunk and this ADR should be superseded by one recording that. Until then, any document
  or session that says "trunk" means `wip/expo-57-working-tree`.
- Merges into it use `--no-ff`, so each adoption is a visible decision point in the graph
  rather than a fast-forward that hides when integration happened.
