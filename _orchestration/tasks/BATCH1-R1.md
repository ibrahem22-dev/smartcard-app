# TASK BATCH-1 / R1 — the unit domain (ADR-010)

PHASE: P0-C3 · BRANCH: task/P1-B · WORKTREE: C:\Users\ebrah\wt-P1B

## WHAT HAPPENED — read this first, it is not a reprimand

Your Batch-1 delivery passed everything I could check without the estate: tsc 0, lint 0, 15 suites /
329 tests, no path leaks, cards' pack still byte-identical. Then I ran it against the real corpus and
it **failed the build on the first fee term carrying `unit: "USD"`**:

```
ProjectionBuildError: row=term:yahav|op:isracard:CARD_FEE:14 path=value.unit:
  a value is declared but no unit is: a number without a unit is not a fact (costmodel section 1.4)
```

That row is `valueNumeric: 63.31, unit: "USD"` — a VERIFIED, calculation-safe, published monthly card
fee. **The unit is declared.** Your `readDeclaredCostUnit` narrowed `USD` to `undefined`, and the
next check reported a *present* unit as an *absent* one.

**This is my defect, not yours.** Your docstring cites the authority I gave you — *"Tier-1 section 5
permits exactly `PERCENT` and `ILS`"* — and documents the consequence: *"with a number it fails the
build."* You implemented the wrong rule correctly, and you failed loudly rather than guessing, which
is the behaviour I asked for. The rule was measured on the cards family and I over-generalised it.

**The measured domain of `unit` across all 1,175 fee terms:**

| unit | rows | value present |
|---|---|---|
| `ILS` | 748 | |
| `PERCENT` | 248 | |
| `USD` | 117 | 117 |
| `OTHER` | 17 | 1 |
| `null` | 39 | 0 |
| `EUR` | 6 | 6 |

123 foreign-currency rows, **118 of them `calculationSafe: true`**, were being crashed on instead of
shipped. The contract is amended: **Tier-1 v1.3 §5.1/§5.2** and **costmodel v1.1 §1.4/§1.4-A/§1.4-B**.

## AUTHORITY — re-read these two sections, they changed

- `C:\Users\ebrah\All application data\SMARTCARD_DATA_CONTRACT.md` **v1.3** — **§5.1, §5.2**, and
  §2.8's new fourth clause.
- `C:\Users\ebrah\All application data\SMARTCARD_DATA_CONTRACT_COSTMODEL.md` **v1.1** — **§1.4,
  §1.4-A, §1.4-B**.

## FIXTURE

`test/fixtures/canonical-costmodel-units.json` — **new, 13 entries, supplied by me.** Sampled by
*combination*, which is what the first fixture got wrong: it contained `unit: null` rows and it
contained value-present rows, but never a value-present row with a foreign unit. Every entry carries
a `_shape` naming the combination. One entry is `_synthetic: true` — see item 3.

## WHAT TO CHANGE

**1. Split the unit type.** In `src/projection/types.ts`:

```ts
/** Cards section 2.3 — the three card cost facets, unchanged. */
export type CardCostUnit = 'PERCENT' | 'ILS';
/** Tier-1 v1.3 section 5.1 — the projected cost-amount domain. */
export type CostUnit = 'PERCENT' | 'ILS' | 'USD' | 'EUR';
```

`DECLARED_COST_UNITS` must be keyed to `CardCostUnit`, **not** `CostUnit`. Cards' facets must remain
unable to hold a dollar. `CardCostUnit ⊂ CostUnit` so existing assignments still compile — but do
not "simplify" the two back into one, that is the whole point of the split.

**Cards' projected output must not change by one byte.** I will re-verify the cards pack sha256
against `c48e91204132409a8943a22ea545a5453dd2580796e91d9a6698b16cead500f6`.

**2. `readDeclaredCostUnit` must stop coercing.** Currently anything unrecognised becomes
`undefined`. Replace with a three-way outcome — a named unit, an explicit "the estate declared no
unit" (`null`/absent), an explicit "the estate could not name the unit" (`OTHER`), and **a throw for
anything else**.

**3. An unrecognised unit FAILS as `UNIT_NOT_IN_SCHEMA`, naming the value.** The synthetic `GBP`
fixture row exists solely to prove this. It must NOT report "no unit declared", must NOT be treated
as `OTHER`, and must NOT be silently dropped. The estate holds no such row today; the guard is for
the day it does.

**4. `OTHER` is not a unit** (contract §5.1). Value present under `OTHER` → `chip: UNKNOWN`,
`reason: UNIT_NOT_DETERMINABLE`, `obtainable: true`, **no `value` key**, and the row's `valueText`
preserved for display. Exactly one real row: `term:one-zero|research:OTHER:14`, value `175`. It must
not become ILS, must not become `0`, must not be dropped. Add `UNIT_NOT_DETERMINABLE` to
`OBTAINABLE_REASONS`.

**5. Foreign currency is not ILS-calculable** (contract §5.2). A `USD`/`EUR` amount ships at its
earned chip **with its unit and its value** — the published fact is fully known — plus:

```
requiresFxConversion: true
ilsCalculationSafe:   false
ilsCalculationBasis:  'FOREIGN_CURRENCY_REQUIRES_FX'
```

**The row's own `calculationSafe` is preserved verbatim and never overwritten.** They are
independent axes: `calculationSafe` asks *is this published number sound arithmetic input in its own
unit?* (true on 118 of them); `ilsCalculationSafe` asks *may it enter an ILS total?* (never).
`ILS` and `PERCENT` values do not carry these three keys at all — do not emit them as `true`/`false`
noise on 996 rows.

Do **not** convert anything. There is no rate in this repo, and the rows say the conversion happens
at the representative rate on the **charge date**, which no build can know.

## SCOPE — files you may create or modify

- `src/projection/types.ts`, `src/projection/cost-model.ts`, `src/projection/fee-terms.ts`
- `src/projection/provenance.ts` — only to add the `UNIT_NOT_DETERMINABLE` reason
- `src/projection/index.ts` — exports only
- `test/**`

Nothing else. Do NOT touch `src/projection/project-cards.ts`, any gate, or any existing fixture.
`src/projection/fx.ts` and `waivers.ts` should need no change — FX legs are `PERCENT`/`ILS` only and
waivers carry no `unit` at all (both measured). **If you find they do need changing, stop and tell me
why rather than changing them.**

## CONSTRAINTS THAT STILL BIND

Everything from `TASK-BATCH1.md` still applies, in particular: pure functions, allowlist projection,
never infer unit or scale from magnitude, `value` structurally absent when `chip === UNKNOWN`, counts
state their scope, strict TS, no `any`, deterministic.

**Do not read** `C:\Users\ebrah\All application data\smartcard-canonical-v1\`. Everything you need
about the corpus is in this packet and the fixture.

## DEFINITION OF DONE — run each, paste verbatim output

1. `npx tsc --noEmit` exits 0
2. `npm run lint` exits 0
3. `npx jest --runInBand --ci` — **all 15 existing suites / 329 tests still pass, none weakened,
   none deleted**, plus your new ones
4. A test per unit in `{USD, EUR}` proving: value present, unit preserved, chip earned,
   `requiresFxConversion: true`, `ilsCalculationSafe: false`, and the row's own `calculationSafe`
   unchanged from the input
5. A test proving `unit: "OTHER"` **with** a value yields `chip: UNKNOWN`,
   `reason: UNIT_NOT_DETERMINABLE`, `'value' in record === false`, `valueText` preserved
6. A test proving the synthetic `GBP` row throws `UNIT_NOT_IN_SCHEMA` **and that the message names
   `GBP`** — assert on the message, not just that it throws
7. A test proving `ILS` and `PERCENT` rows do **not** carry `requiresFxConversion` /
   `ilsCalculationSafe` keys at all
8. A test proving `DECLARED_COST_UNITS` cannot be assigned a foreign currency (a `@ts-expect-error`
   assertion is the right tool)
9. `git status --short` shows only files inside SCOPE

## REQUIRED OUTPUT

Append to `reports/BATCH1.md` a section `## R1 — unit domain (ADR-010)`: what changed, every DoD
command with verbatim output, **every assumption not specified here**, and anything you believe is
still wrong. If you think any instruction above is mistaken, say so — the last one was.
