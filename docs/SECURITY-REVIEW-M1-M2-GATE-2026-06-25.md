## Security Review — M1→M2 Gate (engines 1–2 + M1 close items)
**Date:** 2026-06-25
**Reviewer:** Security Agent (Opus 4)
**Scope:** keyVault.ts, keyVault.terminal.test.ts, authContext.tsx, OnboardingScreen.tsx, purchaseGate.ts, App.tsx, SEC-CONTRACT-001.md, HEAD b2fcf43
**Verdict:** 🚫 **BLOCKED** — ENGINE-03 must NOT start.

The gate is blocked on two independent grounds: (1) the stated M2 deliverable does not exist, and (2) M1 audit item 36 is reported closed but is not actually verified — its test passes for the wrong reason.

---

### CRITICAL Issues (1)

**[CRIT-001] M2 "engines 1–2 complete with 100% Jest coverage" is false — deliverable and test harness do not exist**
- File: repo-wide
- Evidence:
  - `src/engines/cardRoleEngine.ts` — **does not exist** (only `purchaseGate.ts` + empty `index.ts`). Engine 1 is missing entirely. `cashflowRadar` (referenced by `cashflow.types.ts`) also absent.
  - `src/engines/__tests__/cardRoleEngine.test.ts` and `purchaseGate.test.ts` — **do not exist**.
  - Jest is **not installed and not configured**: no `jest`/`ts-jest` in `package.json`, no `test` script, no jest config, no `node_modules/.bin/jest`. Engine test coverage is **0%**, not 100%.
  - The single test file in the repo (`keyVault.terminal.test.ts`) is a hand-rolled harness with `declare const describe/test/jest` — it is not wired to any runner the repo can execute.
- Risk: The gate is being asked to sign off on code and coverage that are not present. No engine logic that touches financial decisions has any executed test behind it.
- Fix: Land `cardRoleEngine.ts` + both engine test files; add `jest` + `ts-jest` + a `test` script and config; produce a real coverage report. Re-submit for review.

---

### HIGH Issues (3)

**[HIGH-A] Audit item 36 NOT genuinely closed — terminal-lock test passes for the wrong reason; terminal lock actually expires after 24h**
- File: `src/security/__tests__/keyVault.terminal.test.ts` (test "terminal lock persists across restart until vault wipe", lines 228–250) + `src/security/keyVault.ts` (`activeLockout`, lines 391–415; `recordFailure`, 445–456)
- Issue: The test seeds SecureStore with keys `sc.pinSalt` / `sc.pinPepper` / `sc.pinEnvelope`, but keyVault actually reads `sc.pin.salt` / `sc.pin.pepper` / `sc.dek.pinEnvelope` (see `SS` map, lines 117–126). The seeded credentials therefore resolve to **null**, so `unlockWithPin` never exercises the real unwrap path — it falls into `recordFailure()`, which (because the counter was pre-seeded at 10) re-arms terminal and returns `locked_out`. The assertion `ok === false` is satisfied by the key-name typo, **not** by terminal-lock persistence.
- Proven at runtime: with the correct key names and the same `now > lockedUntilMs`, `unlockWithPin` returns `{ ok: true }`. The terminal branch computes `remaining = lockedUntilMs - (lastFailureWallMs + elapsed) = -1` and returns `null`, so the lock has **expired**.
- Root cause in product behavior: `recordFailure` sets `lockedUntilMs = Date.now() + EXTENDED_LOCK_MS` (24h, line 446) and `activeLockout` releases once that passes. This directly contradicts audit item 36 / the requirement that terminal lock persists until `wipeVault()` and does **not** expire on its own.
- Risk: An attacker who reaches the terminal tier regains PIN attempts after 24 hours (clock-set forward shortens the wait toward that ceiling). Worse, the regression test that is supposed to catch this is inert — the entire terminal test file never executes the real PIN unwrap path.
- Fix: (1) Correct the SecureStore key names in the test to match `SS`. (2) Decide PIN-7 (see HIGH-C) and make `activeLockout` honor it — for "persist until wipe", terminal must return `locked_out` regardless of elapsed time until `wipeVault()` clears `sc.lockout`. (3) Re-verify item 36 against corrected behavior.

**[HIGH-B] No validation on monetary inputs in the M2 engine path (₪0.01–₪999,999)**
- File: `src/engines/purchaseGate.ts` (`evaluatePurchase`, lines 48–116); `src/types/purchase.types.ts` (`amount: number`)
- Issue: `input.amount` is consumed with no range/numeric guard. No min (₪0.01), no max (₪999,999), no negative/NaN rejection anywhere in the engine or at a boundary (grep found zero validation constants). A negative amount (e.g. −100) returns `approved`; amounts above the cap pass through unbounded.
- Risk: M2 auto-block condition — monetary input without validation. Garbage or adversarial amounts drive financial verdicts.
- Fix: Validate at the engine boundary (or a shared validator the engine calls): numeric, finite, `0.01 ≤ amount ≤ 999999`; reject otherwise before producing a verdict.

**[HIGH-C] PIN-7 terminal action defaulted without the required product + security sign-off**
- File: `src/security/keyVault.ts` lines 110, 445–456
- Issue: Open finding PIN-7 explicitly states: *"Do NOT implement a default without explicit product + security sign-off."* The code silently implements "24h extended lock" (`EXTENDED_LOCK_MS`) as the terminal action. A default was shipped.
- Risk: A security-significant behavior (data wipe vs. indefinite lock vs. 24h lock) was decided implicitly in code, bypassing the required ratification.
- Fix: Ibrahim ratifies `wipeVault()` vs. indefinite lock; implement the ratified choice; record the decision. Until then this is an unresolved open decision, not a closed item.

---

### MEDIUM Issues (3)

**[MED-1] COND-A unremediated — MMKV key effective entropy ~112-bit**
- File: `src/security/keyVault.ts` `deriveMmkvKey` (lines 496–500). 256-bit DEK is mapped to 16 UTF-8-safe bytes via `1 + (b % 0x7f)`, capping effective key strength. Known/tracked; still present. Document the accepted risk or migrate to a binary-key MMKV path when available.

**[MED-2] COND-B still unverified — pepper integration tested only against a mock**
- File: `keyVault.terminal.test.ts` test "different pepper changes derived envelope key" (lines 253–268). It exercises the local `mockArgon2idAsync` XOR stub, not `@noble/hashes` `argon2idAsync`. It proves nothing about real pepper passthrough. COND-B's required verification spike (pepper actually incorporated into the real hash output) remains outstanding.

**[MED-3] HIGH-02 app-switcher privacy blur absent (deferred, required before M5)**
- File: `App.tsx` — no AppState blur/overlay; keyVault explicitly notes this must live in the app shell (lines 704–708). Financial screens remain capturable in the OS app switcher. Not in auth-module scope but must land before any financial screen ships.

---

### LOW Issues (1)

**[LOW-1] `debugUnlock` present in production auth context**
- File: `src/navigation/authContext.tsx` lines 35–36, 66–69. It delegates to real `unlockWithBiometric` (no backdoor — BIND-1 holds), but a debug-labeled unlock path in the shipping provider is M10 (extraneous functionality). Strip or `__DEV__`-guard before production.

---

### Passed Checks
- ✅ AC-2 — DEK keychain item: `requireAuthentication: true` + `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (DEK_OPTS, lines 132–137).
- ✅ AC-3 — no balance/income/cardNumber/userId/keys in `console.*`; no Sentry/Crashlytics in repo.
- ✅ AC-5 — single shared `sc.lockout` counter; biometric failures do not call `recordFailure`; biometric path honors `activeLockout`; counter reset only on success. Switching method does not reset failures.
- ✅ AC-6 — PIN KDF is Argon2id (@noble/hashes); no MD5/SHA1/plain-SHA256 in use (SHA-256 appears only as a comment describing the retired kdfVersion 1).
- ✅ AC-7 — `startSessionGuard` self-wires at import; foreground uses `Math.max(monotonic, wall) > 5min` then `lock()` (zeroes DEK, drops MMKV handle).
- ✅ AC-8 — no hardcoded key/seed (KGEN-4); `keySchemeVersion` + `kdfVersion` persisted.
- ✅ HIGH-01 — lockout backoff uses `Math.max(0, Math.min(monotonicDelta, wallClockDelta))` (line 432). Correct direction. Session-timeout aggregation correctly uses `Math.max` (line 729). Verified.
- ✅ Audit 16+17 (onboarding MMKV unified) — exactly one instance (`onboardingStorage`, id `onboarding-temp`) owns `onboarding_complete`; `completeOnboarding()` writes to it (authContext lines 43, 76–79); **no `new MMKV()` in OnboardingScreen.tsx** (uses `useAuth().completeOnboarding`).
- ✅ BIND-1..4 — `canMountSecureNavigator()` gates on DEK+MMKV present; authContext cold start defaults `UNKNOWN`→evaluate, drops to `UNKNOWN` on background.
- ✅ AC-4 — cold-start/deep-link captured and deferred while LOCKED (`captureDeepLink`/`consumePendingDeepLink`), never auto-followed.
- ✅ Engine purity — `purchaseGate.ts`: zero `fetch`/`axios`; no React/RN/Expo/screen/store/security imports (type imports + `Currency` enum only); no `console.*`; zero `any`; pure function, all state via typed params.
- ✅ Verdict union canonical — `DecisionVerdict = 'approved' | 'warning' | 'blocked' | 'wait_24h'` (decision.types.ts).

---

### Summary
The cryptographic and auth core (keyVault) is solid: HIGH-01 is correctly fixed, AC-2/3/5/6/7/8 pass, and the onboarding MMKV unification (items 16+17) is genuinely closed. However the gate cannot pass. The M2 deliverable does not exist — `cardRoleEngine.ts` and both engine test files are absent, and Jest is not even installed, so the "engines 1–2 complete, 100% coverage" claim is false. Separately, M1 audit item 36 is reported closed but its test passes only because of a SecureStore key-name mismatch; the actual terminal lock expires after 24h, contradicting the "persists until wipeVault" requirement, and PIN-7's terminal action was defaulted in code without the mandated sign-off. Resolve CRIT-001, HIGH-A, HIGH-B, and HIGH-C, then re-submit. ENGINE-03 remains blocked.
