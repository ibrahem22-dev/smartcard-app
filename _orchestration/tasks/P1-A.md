# TASK P1-A — Contract-agnostic pipeline infrastructure (kickoff slice)
PHASE: P1-A   LANE: I   EXECUTOR: Codex (`codex exec`, model gpt-5.6-terra)   WORKTREE: C:\Users\ebrah\wt-P1A   BRANCH: task/P1-A

## OBJECTIVE

Build the **contract-agnostic infrastructure** for the SmartCard data pipeline: a gate framework
that fails builds, a corrupted-fixture test rig that proves each gate actually fires, a build
determinism harness, an atomic apply/rollback transaction framework, and manifest
verification. "Contract-agnostic" is the point — **none of this code may know what a card, a fee or
a benefit is.** It operates on generic packs, manifests and gate functions. The ten specific data
gates plug into this framework later, at P1-B.

When you are done, `npm test` must pass, and the test suite itself must prove that a gate rejects a
corrupted fixture and accepts a clean one.

## CONTEXT YOU NEED (read these, nothing else)

- `C:\Users\ebrah\All application data\SMARTCARD_GATE10_PROJECTION.md` — **§3 (the gate condition),
  §4 (false positives the detector must NOT fire on), §5 (the exact fixtures to implement).**
  This is your primary specification. §5.1 lists 8 positive fixtures, §5.2 lists 5 negative
  fixtures; implement all 13 verbatim.
- `C:\Users\ebrah\All application data\SMARTCARD_DATA_CONTRACT.md` — **§8 (manifest grammar and
  signing envelope) and §9 (gate-failure semantics).** §9 gives the ten gates by number; you are
  building the framework they plug into, NOT the gates themselves.
- `README.md` in your worktree.

Do not read anything else. Do not go looking for the application repository, the canonical data
estate, or any other SmartCard directory. Everything you need is above.

## SCOPE — files you may create or modify

Everything inside your worktree `C:\Users\ebrah\wt-P1A`, specifically:
- `package.json`, `tsconfig.json`, `jest.config.js` (or equivalent test runner config)
- `src/**` — the infrastructure modules
- `test/**` or `src/**/__tests__/**` — the test suite including the fixture rig
- `.github/workflows/*.yml` — a CI workflow that runs typecheck + lint + tests
- `README.md` — you may append a "Development" section; do not rewrite what is there

## FORBIDDEN ZONES — do not touch, do not read for inspiration

- `C:\Users\ebrah\All application data\smartcard-canonical-v1\` — the canonical estate. Read-only at
  the filesystem level and not yours to read at all. The pack builder reads it, at P1-B, not you.
- `C:\Users\ebrah\All application data\_app_archive\` — the donor archive.
- `C:\Users\ebrah\SmartCard-Agent\` — the application repository and its workspace. Entirely out of
  scope; this is a different system under OD-10.
- `C:\Users\ebrah\smartcard-data-pipeline\` — the main repo directory. You work in the **worktree**
  at `wt-P1A`, not there.
- Never create, read or reference any signing key, `.env` file, certificate, `.pem`, `.p12` or
  `.keystore`.

## ARCHITECTURAL CONSTRAINTS (violating any of these fails the task regardless of tests)

1. **Contract-agnostic.** No module may reference cards, fees, benefits, merchants, clubs, FX, or
   any other SmartCard entity. A gate is a function; the framework runs functions. If you find
   yourself importing a domain concept, you have built the wrong thing.
2. **Every gate is binary and fails the build.** There is no warning level, no `--force`, no
   environment variable that downgrades a failure. A gate result is pass or fail.
3. **A gate reports ALL violations, not the first.** One build iteration must be able to fix an
   entire defect class. Include the full field path and row identifier in each violation.
4. **Deterministic by construction.** No `Date.now()`, `Math.random()`, filesystem iteration order,
   or object-key-order dependence anywhere in a build path. Sort explicitly. Timestamps are inputs,
   passed in, never read from the clock inside a build function.
5. **Rollback must restore the exact prior bytes.** An apply that fails midway leaves the previous
   state byte-identical, proven by hash comparison in a test — not by inspection.
6. **No network calls anywhere**, including in tests. The pack-update client's download step is an
   injected interface; tests supply a fake.
7. **Signing: verification only, with test-generated keypairs.** Implement signature *verification*
   and let tests generate a throwaway keypair at runtime using Node's built-in `crypto`. Never
   commit a key. Never implement a signing step that reads a key from disk.
8. Node 20 (the project's pinned runtime), TypeScript strict, no `any`.

## WHAT TO BUILD

**A. Gate framework**
- A `Gate` interface: an id, a human-readable description, and a function taking a pack-like input
  and returning a list of violations (empty = pass).
- A runner that executes a set of gates, aggregates every violation from all of them, and fails the
  build if any gate produced one.
- Output that names the gate id, the field path and the row id for each violation.

**B. Corrupted-fixture test rig — the part that matters most**
- A harness that, for each gate, asserts (i) named corrupted fixtures FAIL and (ii) named clean
  fixtures PASS.
- Implement the path-detector gate from `SMARTCARD_GATE10_PROJECTION.md` §3 as the **reference
  gate** that exercises the framework, with all 13 fixtures from §5.1 and §5.2 implemented verbatim.
  Note especially: it must traverse to **any nesting depth including inside arrays** (fixture P5),
  must inspect **string content including stringified JSON** (P8), and must **not** fire on the
  negative fixtures N1–N5, three of which are real strings taken from the corpus.
- A meta-test asserting the rig itself works: a deliberately broken gate that returns no violations
  for a corrupted fixture must cause the suite to fail.

**C. Determinism harness**
- A utility that runs a build function twice over the same input and asserts byte-identical output.
- At least one test proving it catches non-determinism (feed it a deliberately non-deterministic
  function and assert the harness reports failure).

**D. Atomic apply / rollback**
- A transaction framework: stage → integrity-check → swap → rollback-on-failure.
- Tests proving: a successful apply swaps in the new state; a failure at each stage leaves the prior
  state byte-identical (hash-compared).

**E. Manifest verification**
- Verify a manifest's per-file `sha256` set and its detached signature against a public key.
- Version comparison and a `minAppVersion` check.
- Tests: valid manifest passes; tampered file fails; tampered signature fails; `minAppVersion`
  higher than the app version fails.

**F. CI workflow** running typecheck, lint and tests on push.

## DEFINITION OF DONE — every item must be objectively checkable

1. `npm ci` (or `npm install`) completes and `npx tsc --noEmit` exits 0.
2. `npm test` exits 0, and the suite includes all 13 gate-10 fixtures from
   `SMARTCARD_GATE10_PROJECTION.md` §5.1–§5.2.
3. A test proves the path gate FAILS on a path nested at depth ≥ 6 inside arrays (fixture P5).
4. A test proves the path gate does NOT fire on the three real corpus strings in fixtures N2, N3, N4.
5. A test proves rollback restores byte-identical prior state, compared by hash.
6. A test proves the determinism harness detects a non-deterministic build function.
7. A test proves manifest verification rejects a tampered file and a tampered signature.
8. `git diff --name-only` from the worktree shows only files inside SCOPE.
9. No file in the repository matches `*.pem`, `*.key`, `*.p12`, `*.keystore`, or contains a
   `BEGIN PRIVATE KEY` block.

## REQUIRED OUTPUT

Write `reports/P1-A.md` **inside your worktree** containing:
- What you built, module by module, and why it is structured that way.
- Every DoD command you ran and its verbatim output (trim long output, and say that you trimmed it).
- Anything you could not do, and why. ← honesty here is valued above completeness
- **Any assumption you made that was not specified.** ← ALWAYS list these
- Anything you noticed that seems wrong but was out of scope.

## EXPLICITLY NOT IN SCOPE

- **The ten data gates themselves.** You build the framework; they plug in at P1-B. The path
  detector is included only as the reference gate that exercises the framework.
- Any projection, pack-building or schema logic. No entity knowledge (constraint 1).
- Reading or parsing the canonical estate.
- Any signing implementation that uses a real key.
- Real network I/O of any kind.
- Publishing the package, configuring npm registries, or adding a release workflow.
- Reformatting or "improving" `README.md` beyond appending a Development section.
