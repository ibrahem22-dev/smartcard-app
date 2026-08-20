# TASK P1-B / U1–U3 — cards projection, pack + manifest, atomic import
PHASE: P1-B   LANE: I   EXECUTOR: Cursor (`cursor-agent`, claude-opus-5-high)   WORKTREE: C:\Users\ebrah\wt-P1B   BRANCH: task/P1-B

## OBJECTIVE

Build the first three stages of the SmartCard cards tracer bullet:

```
canonical card rows → [U1 projection] → pack rows → [U2 pack + manifest] → [U3 atomic import]
```

U4 (adapter read) and U5 (engine lattice test) are the supervisor's and are **out of scope for you**
— but your output shape is their input, so conform to it exactly.

**Node is at `C:\Users\ebrah\AppData\Local\nvm\v20.20.2` and is NOT on the default PATH.** Prepend
it before running anything: `export PATH="/c/Users/ebrah/AppData/Local/nvm/v20.20.2:$PATH"`, then
confirm `node -v` prints `v20.20.2`. Dependencies are already installed. **You must actually run
every DoD command and paste its real output.**

## CONTEXT YOU NEED (read these, nothing else)

- `C:\Users\ebrah\All application data\SMARTCARD_DATA_CONTRACT.md` **v1.1** — §1 (identity), **§2
  entire (the provenance vocabulary, the lattice)**, §3, §4, §6.3, §6-A, §7, §8, §9.
- `C:\Users\ebrah\All application data\SMARTCARD_DATA_CONTRACT_CARDS.md` **v1.2** — the whole file.
  §1.1 is the filter arithmetic; **§4 is the exact provenance record shape you must emit.**
- `C:\Users\ebrah\All application data\SMARTCARD_GATE10_PROJECTION.md` — §2 rules A–E, §3 the gate.
- `test/fixtures/canonical-cards-sample.json` in your worktree — **13 real canonical card rows**,
  supplied by the supervisor, covering every branch. Read its `_why` annotations.
- Your own existing `src/` — the gate framework, determinism harness, transaction framework and
  manifest verification are already built and tested. **Reuse them; do not reimplement.**

Do not read anything else. In particular, see FORBIDDEN ZONES.

## SCOPE — files you may create or modify

- `src/projection/**` (new) — U1
- `src/pack/**` (new) — U2
- `src/import/**` (new) — U3, may reuse `src/transaction.ts`
- `src/gates/legacy-rows.ts`, `src/gates/lineage.ts` (new) — the two gates U1 needs
- `test/**` — tests for the above
- You MAY add exports to `src/gates/index.ts` if one exists; do not restructure existing modules.

## FORBIDDEN ZONES

- **`C:\Users\ebrah\All application data\smartcard-canonical-v1\`** — the canonical estate. You must
  **not** read it, at all. It is filesystem read-only and out of bounds by standing rule; the
  supervisor supplies estate data as fixtures. Your projection takes rows as an **argument**; it
  never opens the estate itself.
- `C:\Users\ebrah\All application data\_app_archive\`
- `C:\Users\ebrah\SmartCard-Agent\` — the application repository. Different system (OD-10).
- Never create, read or reference a signing key, `.env`, `.pem`, `.p12` or `.keystore`.
- Do not modify `test/fixtures/canonical-cards-sample.json` or `test/corpus-negative-fixtures.json`.

## ARCHITECTURAL CONSTRAINTS (violating any fails the task regardless of tests)

1. **The projection is a pure function**: `(rows: CanonicalCardRow[], opts) => PackRow[]`. No file
   I/O, no clock, no network, no globals. The caller supplies rows and a build timestamp.
2. **Allowlist projection.** Emit **only** the fields named in cards schema §2.1–§2.5. A field you
   do not recognise is dropped, never passed through. This is what stops future estate fields
   leaking.
3. **`lineage` is OMITTED**, never scrubbed (contract §6-A).
4. **NEVER infer a value's unit or scale from its magnitude.** No `value < 1 → ×100`, no
   magnitude-based type guessing, anywhere. Read declared type only.
5. **`value` must be structurally ABSENT when `chip === "UNKNOWN"`** — not `null`, not `0`. The key
   does not exist. This is what makes `undefined ?? 0` impossible (contract §2.5 rule 3).
6. **The projection never emits `chip: "USER"`.** It has no Layer-A source (contract §2.2).
7. **Deterministic:** two builds from identical input produce byte-identical output. Sort every
   collection explicitly; never rely on object key order or filesystem order.
8. TypeScript strict, no `any`, Node 20.

## WHAT TO BUILD

### U1 — Projection

**The filter** (cards schema §1.1), which must be asserted, not assumed:
| `lifecycleStatus` | Action |
|---|---|
| `CURRENT` | project, `isSelectable: true`, **counted as current** |
| `RETIRED`, `TARIFF_ONLY_NOT_PROVEN_CURRENT`, `EXCLUDED_FROM_PRODUCT_COUNT` | project, `isSelectable: true`, **NOT counted** |
| `UNVERIFIED_LEGACY_CANDIDATE` | **NEVER projected** |

**The provenance record** — exactly cards schema §4. Map Layer-A `verificationStatus` → chip per
contract §2.1: `VERIFIED_OFFICIAL`/`CORROBORATED`/`SINGLE_SOURCE` → `VERIFIED`;
`DERIVED`/`DERIVED_FROM_OFFICIAL`/`ESTIMATED` → `ESTIMATE`; the five UNKNOWN-family statuses →
`UNKNOWN` **with `reason` and `obtainable`** (`obtainable: true` only for `CUSTOMER_SPECIFIC` and
`LOGIN_GATED`). `HISTORICAL` → `stale: true` **keeping the earned chip**, never a chip of its own.

An absent cost field (e.g. `atmSameCurrencyFee`, missing on 299 of 378) projects as
`chip: "UNKNOWN"`, `reason: "UNKNOWN"`, `obtainable: false`, **no `value` key**.

**Counts must state their scope.** Any count you emit is an object naming its population, e.g.
`{ population: "CURRENT", value: 378 }`. A bare number is a defect — Session 03 shipped
`operatorKnown = 318` with no scope and it was misread as universe-wide when it is shippable-only.

### U2 — Pack + manifest
Assemble `catalog.pack` and a manifest per contract §8: `datasetId`, `datasetVersion`, `packId`,
`packVersion`, `builtFrom`, `minAppVersion`, `generatedAt` (**passed in**, never read from the
clock), per-file `sha256`, and a `signature` field. **Dev builds are UNSIGNED** — leave the
signature absent or explicitly `null` and make verification tolerate that. Reuse
`src/manifest.ts`.

### U3 — Atomic import
Reuse `src/transaction.ts`. Stage → integrity-check → swap → rollback-on-failure. Prove by test
that a failure at each stage leaves the prior state **byte-identical**, hash-compared.

### Two new gates the projection must run
- **Gate 1** — fails if any `UNVERIFIED_LEGACY_CANDIDATE` row is present in pack output.
- **Gate 10 (lineage half)** — fails if any `lineage` key survives at any nesting depth. Reuse the
  existing `pathDetectorGate` for the path half; do not modify it.

## DEFINITION OF DONE — run each, paste verbatim output

1. `npx tsc --noEmit` exits 0
2. `npm run lint` exits 0
3. `npx jest --runInBand --ci` — all suites pass, including the 6 that already exist (29 tests). You
   must not break them.
4. A test proves the projection **drops all `UNVERIFIED_LEGACY_CANDIDATE` rows** from the fixture.
5. A test proves an absent cost field yields `chip: "UNKNOWN"` with **no `value` key** —
   assert `'value' in record === false`, not `value === undefined`.
6. A test proves **no `lineage` key** and **no filesystem path** survives projection of the fixture.
7. A test proves **determinism**: projecting the same fixture twice yields byte-identical JSON.
8. A test proves rollback restores byte-identical prior state.
9. `git diff --name-only` plus `git status --short` show only files inside SCOPE.

## REQUIRED OUTPUT

Write `reports/P1-B-U1-U3.md` in your worktree:
- what you built, module by module, and why it is shaped that way;
- every DoD command and its verbatim output (say so if you trim);
- **anything you could not do, and why** — honesty here is valued above completeness;
- **any assumption you made that was not specified** — ALWAYS list these;
- anything that looked wrong but was out of scope.

## EXPLICITLY NOT IN SCOPE

- U4 (the adapter read) and U5 (the engine lattice test) — the supervisor's.
- Reading the canonical estate, or wiring the projection to it. It takes rows as an argument.
- Any entity family other than cards.
- Real signing, real network, real filesystem packs outside your worktree's temp dirs.
- Modifying `src/gates/path-detector.ts`, `src/gates/percent-range.ts`, or any existing test.
