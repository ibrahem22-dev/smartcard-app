# ADR-P2-001 — The legacy bundled data path is removed, and what that does to the regression net

**Status:** ACCEPTED · **Date:** 2026-08-24 · **Phase:** P2 / Phase 2 · **Work packages:** WP-2.1, WP-2.2
**Criteria:** B9 (fenced surfaces) · D3 (legacy path absent) · E3 (regression net)
**Append-only.** This file is never edited after acceptance; a later ruling supersedes it by its own
ADR. (Criterion F9.)

---

## Context

The inherited app answered card-rate and foreign-exchange questions from three bundled JSON files
shipped inside `src/data/`:

```
src/data/card_rates.json          per-issuer, per-club rates
src/data/fxAbroad.v2.json         the FX triples — the single production-approved dataset of the old world
src/data/fxAbroadCardMap.json     card → FX slug matching
```

`P2_COMPLETION_CONTRACT.md` **D3** requires all three out of the runtime, together with
`useCardRatesDatabase.ts`, `useFxAbroad.ts`, `nonAuthorityDataAccess.ts` and the
`DisabledDataAuthorityAdapter` singleton. The forensic's §5 finding is the reason: **three coexisting
FX implementations**, of which these were one.

The replacement is the Data Authority Adapter — criterion **D1**, Phase 7. It does not exist yet.

## Decision

**Remove the legacy path now, and answer UNKNOWN in the gap.**

A single seam, `src/authority/noSource.ts`, answers every question the bundled datasets used to
answer, and answers all of them the same way: `{ status: 'unknown', reason: 'no_authority_source_wired' }`.

`P2_CAMPAIGN_PLAN.md` WP-2.2 asks for exactly this shape — *"keep the seam idea, drop the
singleton"*.

### Why not keep the data until the adapter lands

Because two answers to one question is the defect. A card whose FX rate comes from a JSON file
nobody maintains, sitting next to an adapter that will give a different one, is how the project got
three FX implementations in the first place. The gap between removal and D1 is visible and
bounded; the alternative is invisible and open-ended.

### Why not a stub adapter

`P1_TO_P2_HANDOFF.md` §2 lists eight interfaces P2 **must not re-derive**. A stub returning
plausible shapes would be a second implementation of one of them, and every consumer would end up
written against the stub's behaviour rather than the adapter's.

### Why UNKNOWN rather than zero, or a default, or a remembered value

`ResolvedFxAbroad` has carried `{ status: 'unknown', reason }` since before P2, and the original
`resolveFxAbroad` documented why:

> *"There is deliberately NO silent fallback to an issuer-wide rate: a card with no verified,
> Tier-A triple resolves to `unknown` so the UI can show 'not yet confirmed' instead of an inferred
> number."*

The refusal path already existed and was already the right one. D3 widens it from *some* cards to
*all* cards, and nothing else about it changes.

---

## Consequences for the regression net — the part E3 requires be written down

**Eight tests failed the moment the datasets left the runtime.** E3:

> The inherited regression net is green, **or** every failure is a deliberate, ADR-recorded
> consequence of a spec change. **A green suite after a spec change is treated as more suspicious
> than a red one.**

### Deleted, with their subject

| file | why |
|---|---|
| `src/authority/__tests__/bundledDataNonAuthority.test.ts` | tested `nonAuthorityDataAccess`, which is removed by D3 |
| `src/authority/__tests__/wave1Integration.test.ts` | integration over `fxAbroad.v2.json` + `fxAbroadCardMap.json` |
| `src/hooks/__tests__/useCardRatesDatabase.test.ts` | tested `useCardRatesDatabase`, removed by D3 |

Keeping any of them would have meant keeping the datasets to satisfy them — the test holding the
production defect in place.

### Rewritten, not loosened — `src/engines/__tests__/fxAbroadEngine.test.ts`

Six of its nine tests asserted concrete figures. **The figures are recorded here** so Phase 7 can
check the adapter reproduces them rather than re-deriving them from memory:

| card | assertion before D3 |
|---|---|
| CAL, `שופרסל` | resolves `cal-shufersal-visa`, tier A, `fxPurchasePct` **3**, `withdrawalSameCurrency` **16 ils** |
| Isracard, `American Express Platinum` | resolves `card-amex-platinacard`, `fxPurchasePct` **2.5** |
| Amex Platinum, cash withdrawal | leg value **3.5** |
| any resolved leg | carries source provenance — url + hash + date |
| ranking | Tier-A only, cheapest purchase fee first |

They are rewritten to assert what is now true, which is a **stronger** claim than before: with no
source wired, the engine refuses for **every** card, and the refusal names its reason so `unknown`
is distinguishable from `broken`.

**One test survived unchanged** — *"an all-unknown card list yields an empty ranking, never a
default"*. It was the only test in the file that asserted a refusal rather than a figure, and it is
the only one the removal did not touch. That is the argument for writing more tests like it.

### One failure that was NOT a deliberate consequence

`src/i18n/__tests__/arabicCoverage.test.ts` failed because the refusal message added to
`SettingsScreen` was Hebrew-only. **That was a defect introduced by this work package, not a
consequence of it**, and the coverage test caught it within minutes — which is what criterion A7's
fall-through audit exists to do. Arabic and English were added; the test is green.

The distinction matters: three suites failed because their subject was removed, and one failed
because the change was wrong. Recording them together as "expected fallout" would have buried the
second.

---

## Consequences for B9

`react-native-purchases` was reachable from `SettingsScreen` through `services/revenueCat.ts`, so
removing it required unmounting the paywall, deleting the RevenueCat services, and making
`useSubscriptionStore.refreshTier` an explicit no-op that keeps the persisted tier rather than
inventing one. Billing is P4 (contract §9).

Measured on the import graph from `index.js` and `App.tsx`, before and after:

```
before   106 project files reachable · 21 external packages · 8 fenced modules REACHABLE
after     97 project files reachable · 20 external packages · 0 fenced modules reachable
                                                            · 0 fenced packages reached
```

---

## What this ADR does not decide

- **When the adapter lands.** D1, Phase 7.
- **What the screens show in the meantime.** They already branched on `null` / `unknown`; that is
  why the seam returns those shapes and not new ones.
- **Whether any fenced surface returns.** Contract §9 sends onboarding, Add Card, Check Input,
  Check Verdict, the FX Compare sheet and purchase logging to **P4**, and Wallet, Card DNA, Plan
  and Home content to **P5a/P5b**. Anything that returns is rebuilt against the adapter, not
  restored from `docs/archive/`.
