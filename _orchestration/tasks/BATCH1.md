# TASK P0-C3 / BATCH-1 — cost-model projections: fee terms, FX pairs, waivers

PHASE: P0-C3 · BRANCH: task/P1-B · WORKTREE: C:\Users\ebrah\wt-P1B

## OBJECTIVE

Project the three cost-model source families into pack rows under the frozen contracts, reusing the
gate framework, pack builder and provenance types that already exist in this repo from cards.

```
fee-terms (1,175) ─┐
fx pairs (43) + exceptions (14) ─┼─> projection ─> pack rows ─> gates
waivers (171) ─┘
```

**Node:** `C:\Users\ebrah\AppData\Local\nvm\v20.20.2` is NOT on PATH. Run
`export PATH="/c/Users/ebrah/AppData/Local/nvm/v20.20.2:$PATH"` and confirm `node -v` prints
`v20.20.2`. Dependencies are installed. **Run every DoD command and paste real output.**

## CONTEXT YOU NEED (read these, nothing else)

- `C:\Users\ebrah\All application data\SMARTCARD_DATA_CONTRACT_COSTMODEL.md` — **your primary spec.**
  §0 is the shape census, §1 fee terms, §2 FX, §3 foreign-ATM, §4 waivers. Read all of it.
- `C:\Users\ebrah\All application data\SMARTCARD_DATA_CONTRACT.md` v1.2 — §2 entire (especially
  **§2.7, the three on-disk states**), §3, §4, §5, §6-A, §7, §9.
- `test/fixtures/canonical-costmodel-sample.json` in your worktree — **43 real rows, chosen to cover
  every on-disk shape the census found.** Every entry carries a `_shape` annotation saying which
  shape it exists to cover. **If your code cannot handle one of them, that is the bug the fixture
  was built to expose.**
- Your existing `src/projection/**` (cards), `src/gates/**`, `src/pack/**`. **Reuse the provenance
  types and the gate framework. Do not reimplement or fork them.**

## SCOPE — files you may create or modify

- `src/projection/fee-terms.ts`, `src/projection/fx.ts`, `src/projection/waivers.ts` (new)
- `src/projection/index.ts` — add exports only
- shared helpers under `src/projection/` if genuinely shared with cards (do not change cards' behaviour)
- `test/**` — tests for the above
Nothing else. Do NOT modify `src/gates/path-detector.ts`, `src/gates/percent-range.ts`,
`src/projection/project-cards.ts`, or any fixture.

## FORBIDDEN ZONES

- `C:\Users\ebrah\All application data\smartcard-canonical-v1\` — the canonical estate. **Do not
  read it.** Your projections take rows as an argument; the supervisor runs them against the estate.
- `C:\Users\ebrah\SmartCard-Agent\` — the application repo (different system, OD-10).
- Never create or reference a signing key, `.env`, `.pem`, `.p12`, `.keystore`.

## ARCHITECTURAL CONSTRAINTS (violating any fails the task regardless of tests)

1. **Pure functions.** `(rows, opts) => PackRow[]`. No file I/O, no clock, no network, no globals.
2. **Allowlist projection.** Emit only fields the schema names. Unrecognised fields are dropped.
3. **`lineage` OMITTED; `evidence[]` DROPPED wholesale** and replaced by
   `sourceId + sourceLabel + publicationDate + registryId` (contract §6-A, costmodel §1.5).
4. **THE THREE STATES (contract §2.7) — this is the one that will bite.** A value field is
   present-with-a-value, **present with `value: null`**, or absent. A `null` at a VERIFIED grade is
   an **evidenced absence**: `chip: UNKNOWN`, `reason: NOT_PUBLISHED`, `obtainable: false`, and
   **no `value` key at all**. It is NOT an error and NOT `0`.
5. **NEVER infer unit or scale from magnitude.** No `value < 1 → ×100`. Sub-1 percentages are
   genuine in this market.
6. **`value` structurally absent when `chip === UNKNOWN`** — reuse cards' `KnownValue`/`UnknownValue`
   split so the compiler enforces it.
7. **Empty array ≠ missing.** `cardLevels: []` means *all levels*; `tiers: []` means *not tiered*;
   `appliesToPopulations: []` means *all populations*. Project as `[]`, never as UNKNOWN.
8. **Null-guard nested legs.** `pair.foreignAtmCounterPct` is `null` on 18 of 43 pairs — reading
   `.conservativeValue` off it throws. (This crashed the supervisor's own census script.)
9. **FX exceptions match LONGEST-NAME-FIRST**, by descending `matchPrecedence`. Assert the ordering
   is total: two rules with equal precedence and overlapping names must FAIL the build, not tie.
10. **Narrative waivers ship their `quote` verbatim and are NEVER parsed at runtime.**
11. **Counts state their scope** — `{ metric, population, value }`, never a bare number.
12. TypeScript strict, no `any`, deterministic (sort explicitly), Node 20.

## WHAT TO BUILD

**A. `projectFeeTerms(rows, opts)`** — costmodel §1. Filter `shipToApp === true`. Both
`calculationSafe` classes ship; false ones are flagged, not dropped. Provenanced value per §1.4.

**B. `projectFxPairs(pairs, exceptions, opts)`** — costmodel §2. Both primary legs (43/43 each);
secondary legs may be null or leg-absent. Emit `conservativeValue` as the value. Exceptions sorted
longest-name-first with a totality assertion.

**C. `projectWaivers(rows, opts)`** — costmodel §4. `machineUsable` → `calculationSafe`. Narrative
rows ship `quote` verbatim plus `notMachineUsableBecause`. The 81 verified `resultingFeeIls` nulls
project UNKNOWN/NOT_PUBLISHED, never 0. Duplicates keep their pointer.

**D. Gates** — reuse `pathDetectorGate`, `lineageGate`, `percentRangeGate` via `runGates`. Add a
family-appropriate `asRecordPack` for each so the existing gates can inspect the output.

## DEFINITION OF DONE — run each, paste verbatim output

1. `npx tsc --noEmit` exits 0
2. `npm run lint` exits 0
3. `npx jest --runInBand --ci` — all suites pass, **including the 11 existing suites / 140 tests,
   none weakened or deleted**
4. A test per family proves a **present-with-null at a VERIFIED grade** yields `chip: UNKNOWN`,
   `reason: NOT_PUBLISHED`, and **`'value' in record === false`**
5. A test proves a null nested FX leg does **not** throw
6. A test proves FX exception ordering is longest-name-first, and that an equal-precedence
   overlapping pair FAILS
7. A test proves a narrative waiver ships its `quote` unchanged, byte for byte
8. A test proves projecting the fixture twice is byte-identical (determinism)
9. A test proves no `lineage` key and no filesystem path survives any of the three projections
10. `git status --short` shows only files inside SCOPE

## REQUIRED OUTPUT

Write `reports/BATCH1.md`: what you built and why it is shaped that way; every DoD command with
verbatim output; **anything you could not do and why**; **every assumption you made that was not
specified**; anything that looked wrong but was out of scope.

## EXPLICITLY NOT IN SCOPE

- Reading the estate, or wiring projections to it.
- Any family outside these three (no clubs, programmes, relationships, benefits, merchants).
- Changing cards' projection behaviour.
- The adapter, the app repo, real signing, real network.
