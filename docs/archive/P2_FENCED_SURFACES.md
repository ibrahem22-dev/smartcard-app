# ARCHIVED BY P2 — WHAT WAS FENCED, AND WHY IT IS NOT SIMPLY DELETED

**Criteria:** B9 (fenced surfaces) · D3 (legacy data path) · **Work packages:** WP-2.1, WP-2.2
**Date:** 2026-08-24

> `P2_COMPLETION_CONTRACT.md` B9: *"Paywall unmounted; Register/OTP removed; Supabase and RevenueCat
> **archived** out of the dependency manifest; dead routes (`SavingsTracker`, `ProfileShare`,
> `Loans`, `Benefits`) and their deps removed."*
>
> The word is **archived**, not deleted. A dependency that disappears without a record leaves the
> next person to wonder whether it was removed deliberately or lost in a merge — and in one case
> here the file is the only surviving evidence of a data decision the project paid for.

---

## 1. WHAT WAS REACHABLE, MEASURED RATHER THAN ASSUMED

Before any removal, the import graph was built from the real entry points (`index.js`, `App.tsx`)
and walked through every static import. **106 project files were reachable and 21 external packages.**

| Fenced module | reachable before? |
|---|---|
| `src/screens/PaywallScreen.tsx` | **REACHABLE** — via `navigation/AuthGate.tsx` |
| `src/services/revenueCat.ts` | **REACHABLE** — via `screens/SettingsScreen.tsx` |
| `src/services/revenueCatClient.ts` | **REACHABLE** — via `store/useSubscriptionStore.ts` |
| `src/data/card_rates.json` | **REACHABLE** — via `hooks/useCardRatesDatabase.ts` |
| `src/data/fxAbroad.v2.json` | **REACHABLE** |
| `src/data/fxAbroadCardMap.json` | **REACHABLE** |
| `src/hooks/useCardRatesDatabase.ts` | **REACHABLE** — via `screens/CardDetailScreen.tsx` |
| `src/hooks/useFxAbroad.ts` | **REACHABLE** — via `hooks/usePurchaseGate.ts` |
| `src/services/supabase.ts` | not reached |
| `src/screens/auth/RegisterScreen.tsx`, `OTPVerifyScreen.tsx` | not reached |
| `SavingsTrackerScreen`, `ProfileShareScreen`, `LoansScreen`, `BenefitsScreen` | not reached |
| `src/authority/nonAuthorityDataAccess.ts` | not reached |

**The inherited test asserted the second group and never looked at the first.** It read
`expect(source).not.toContain('BenefitsScreen')` over a hand-written list of seven files — so a
module reached from a file that was not on that list was invisible to it, and every one of the eight
REACHABLE rows above sat outside its view. B9 does not say *"the name does not appear"*; it says
**`0 reachable`**, which is a property of the graph.

---

## 2. DEPENDENCIES REMOVED FROM `package.json`

| package | why it was there | why it goes |
|---|---|---|
| `@supabase/supabase-js` | remote account / OTP sign-in | B9. The MVP is local-vault only; `src/screens/auth/**` is removed with it |
| `react-native-purchases` | RevenueCat billing | B9. The paywall is unmounted, and P2 ships no purchase path |
| `expo-camera` | QR scanning for profile transfer | B9 — a dependency of `ProfileShareScreen`, a dead route |
| `react-native-qrcode-svg` | QR rendering for profile transfer | B9 — same |

**None was reachable from the entry point at the moment of removal except `react-native-purchases`**,
which `SettingsScreen` reached through `services/revenueCat.ts`.

Restoring any of them is a dependency install plus the file listed in §3 — deliberately, so that
the decision to bring one back is visible rather than incidental.

---

## 3. FILES REMOVED FROM THE RUNTIME

```
src/screens/PaywallScreen.tsx              subscription paywall — unmounted from AuthGate
src/screens/auth/RegisterScreen.tsx        remote account creation
src/screens/auth/OTPVerifyScreen.tsx       email OTP verification
src/screens/SavingsTrackerScreen.tsx       dead route
src/screens/ProfileShareScreen.tsx         dead route (QR profile transfer)
src/screens/LoansScreen.tsx                dead route
src/screens/BenefitsScreen.tsx             dead route
src/services/supabase.ts                   Supabase client
src/services/revenueCat.ts                 RevenueCat wrapper
src/services/revenueCatClient.ts           RevenueCat tier fetch
```

### 3.1 ONE FILE THIS LIST MISSED, AND WHAT CAUGHT IT

```
src/hooks/useProfileShare.ts               the ProfileShare route's other half
```

The list above removed `ProfileShareScreen.tsx` and left the hook behind. B9's own words are *"dead
routes (SavingsTracker, **ProfileShare**, Loans, Benefits) **and their deps removed**"*, and the
hook's second line was `import { Camera } from 'expo-camera'` — a package archived out of the
manifest in the same commit that was supposed to have removed everything that used it.

**FOUR CHECKS LOOKED STRAIGHT AT IT AND ALL FOUR WERE RIGHT TO SAY NOTHING.**

| check | what it said | why it was right |
|---|---|---|
| `FENCED OK — 0 reachable` | the fenced packages are unreached | nothing imports the hook, so it is genuinely outside the runtime graph |
| `expo-camera` not in manifest | true | it was removed from `package.json` correctly |
| `npx tsc --noEmit` locally | clean | a stale `node_modules` on that machine still had `expo-camera` on disk from before the removal |
| the test suite | 409 passing | nothing imported the hook, so nothing exercised it |

It took `npm ci` on CI — a clean install that has only what the manifest declares — to compile the
file and fail. **UNREACHABLE IS NOT ABSENT.** A file outside the runtime graph is still compiled and
still shipped, and reachability was never the question B9 asked about the manifest.

Two things changed so this class cannot recur:

1. `tools/p2/lib/undeclared-imports.mjs` derives every package `src/**` imports and compares it to
   `package.json`. It reads the DECLARATION, never `node_modules`, so its answer cannot depend on
   what somebody installed months ago and never cleaned up. It is wired into this gate, and its
   negative control is the defect above: run at the parent commit, it fails.
2. The verification method itself. Every "typecheck clean" recorded in Phase 2 was measured against
   a polluted install, which made it a statement about one machine rather than about the tree. The
   record for Gate 2 is corrected rather than left standing.

### 3.2 A contradiction found on the way, and corrected here

`.gitignore` carries this block:

> **INTENTIONAL MANUAL EXCLUSION (no ignore patterns — do not auto-gitignore):**
> `src/screens/auth/`, `src/services/supabase.ts` — *"Kept untracked on purpose until an explicit
> Project Owner decision to commit them when the Supabase phase opens."*

**Those three files were tracked.** `git ls-files` listed all of them. The comment described an
intention the repository had already departed from — for how long, nothing records. It is corrected
rather than quietly dropped, because a stale instruction that reads as deliberate is worse than none.

---

## 4. `fxAbroad.v2.json` IS KEPT, AND THAT IS THE POINT

`P2_CAMPAIGN_PLAN.md` §2, on WP-2.2:

> *"`fxAbroad.v2.json` is **archived as a data lesson, removed from runtime** (forensic §6). It was
> the single production-approved dataset of the old world. Deleting it without archiving loses the
> lesson; leaving it in runtime keeps a second FX answer alive."*

The file is preserved verbatim at **`docs/archive/data/fxAbroad.v2.json`**, outside `src/`, imported
by nothing. Both halves of the instruction are satisfied at once: the second FX answer is out of the
runtime, and the artifact that shows what the old world shipped survives.

`card_rates.json` and `fxAbroadCardMap.json` are archived beside it under the same reasoning — they
are the other two members of the legacy path D3 names, and a partial archive would leave the lesson
half-told.

---

## 5. WHAT THIS ARCHIVE IS NOT

It is **not** a deferral register. Nothing here is coming back in a later phase by default:
`P2_COMPLETION_CONTRACT.md` §9 sends onboarding, the Add Card wizard, Check Input, Check Verdict,
the FX Compare sheet and purchase logging to **P4**, and the Wallet, Card DNA, Plan and Home content
surfaces to **P5a/P5b**. If a surface returns it will be rebuilt against the adapter, not restored
from here.

The one thing this archive guarantees is that **removing it was a decision somebody made, and the
record says which one**.
