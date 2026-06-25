# SmartCard — AGENTS.md
### Codex Build Instructions | Replaces Agents 1, 3, 4, 5, 7, 9

> This file is your only instruction source. Read it fully before every task.
> Every rule is a hard DO or DO NOT. When two statements conflict, the
> **Conflict Hierarchy** at the bottom of §11 wins. Start each session at §13 (Task Queue).

---

## 1. Project Overview

SmartCard (final name candidate: **MyCard**) is an Israeli FinTech mobile app — a **pre-purchase decision assistant**, not a budget tracker. Before any purchase it answers three questions: (1) Can I afford this? (2) Which card should I use? (3) Which card saves the most on this purchase? Target market: Israeli adults with 2–4 credit cards, תשלומים (installments), הוראות קבע (standing orders), and מינוס (overdraft) risk. UI is Hebrew-primary + full Arabic RTL; English for technical terms only. Manual-first — no Open Banking in MVP.

---

## 2. Tech Stack (Pinned Versions — Do Not Upgrade)

| Dependency | Version | Note |
|---|---|---|
| Node | **20.20.2** | PINNED via nvm-windows. Node v24 crashes SDK 52 — BANNED. |
| Expo SDK | **52** | PINNED. No upgrade to 54/55 without a dedicated isolated session. |
| React Native | 0.76.9 | Tied to SDK 52 (React 18.3). |
| New Architecture | **ENABLED** | `newArchEnabled=true` in `android/gradle.properties` — mandatory for MMKV v3. |
| react-native-mmkv | 3.3.3 | V3 Classic API. Requires New Arch. |
| TypeScript | strict | `strict: true`, no exceptions. |
| @noble/hashes | pure JS | Argon2id KDF (Expo-managed-safe, no native build). |
| @noble/ciphers | pure JS | AES-256-GCM for PIN envelope. |
| expo-secure-store | installed | Hardware keychain for DEK + pepper. |
| expo-crypto | installed | CSPRNG (`getRandomBytesAsync`). |
| expo-local-authentication | — | Biometric. |
| Zustand | — | State. Redux/MobX BANNED. |
| React Navigation | v7 | Stack + Tab. |
| NativeWind | v4 | **Deferred to M3.** Use `StyleSheet.create` in M1/M2. |
| Jest | — | Mandatory for all engine logic. |
| Detox | — | E2E, Phase 3+ only — do not write now. |

**BANNED ENTIRELY:** `AsyncStorage`, `redux`, `mobx`, `axios` (use `fetch` for rare network), `moment`, `react-native-argon2` (native build fails — use @noble/hashes), the `any` type, and any package not in the Expo managed workflow.

**Run command:** `npx expo run:android` (never Expo Go — native modules are unsupported there).
**Device:** Samsung S928B (physical). `requireAuthentication: true` does not work on emulators.

---

## 3. Folder Structure & Ownership Rules

```
/src
  /engines    Pure financial + benefits logic. ZERO React/RN/Expo imports. ZERO network. ZERO async.
  /types      All interfaces/types. Engines and screens import from here; never define types inline.
  /security   keyVault.ts ONLY. Sole owner of the DEK + all crypto. No network. No imports from stores.
  /services   Network calls ONLY (Phase 4+). Empty until then.
  /store      Zustand + encrypted MMKV via keyVault handle. keys.ts holds ALL MMKV key constants.
  /screens    UI only. Calls hooks (which call engines). Never implements financial logic.
  /components  Reusable UI. Includes FeatureGate.tsx.
  /hooks      Custom hooks. Hooks may import engines; screens import hooks, not engines directly.
  /data       Static benefits JSON (Max/Isracard/CAL). READ ONLY at runtime. Bundled, not fetched.
  /utils      Pure helpers (currency, dates, formatting).
  /i18n       he.ts + ar.ts translation maps.
/docs         SEC-CONTRACT-001.md and architecture contracts. READ ONLY.
```

**Hard ownership rules:**
- `/src/engines/` imports **nothing** from React, React Native, Expo, `/src/screens/`, `/src/store/`, `/src/security/`, or `/src/services/`. Engines receive all state as typed parameters. Violation = CRITICAL.
- Engines NEVER import from another engine — flat dependency graph.
- `/src/security/` is the only place that touches the keychain or the DEK. Moving crypto out = HIGH finding.
- MMKV keys are constants in `/src/store/keys.ts`. No string literals for keys anywhere else. No key built dynamically from user input (e.g. `card_${userId}`) = HIGH.
- Screens import engines only via hooks. A screen importing an engine directly is allowed only for pure type imports; logic calls go through hooks.

---

## 4. TypeScript Standards

- `strict: true`. No `any`, no `as any`, ever.
- No non-null assertion (`!`) without a prior existence check guarding it.
- Every function parameter and return type explicitly typed.
- Use `enum` or a string-literal union for fixed sets (verdicts, roles, categories).
- Use `readonly` on input parameters not meant to be mutated.
- No external libraries inside engines (no lodash, no date-fns) — native TS only.
- Import types with `import type { X } from '../types/x.types'`.
- **Definition of clean:** `npx tsc --noEmit` returns zero errors before any commit.

Most common violations to self-check before committing: an inferred `any` on a destructured param; a missing return type on a hook; a key literal that should live in `keys.ts`; an engine file with a stray `import { useState }`.

---

## 5. Israeli Financial Domain

**Definitions:**
- **תשלומים (installments):** a purchase split into monthly payments. Each = `{ totalAmount, numMonths, monthlyPayment, billingCard, billingDate, category }`. Billing dates differ **per card**, not per bank. Load% = (sum of active monthly installment payments / monthlyIncome) × 100.
- **חזרת חיוב (bounced payment):** bank balance insufficient on a card's billing date. Cost ≈ ₪80 bank fee + merchant penalty + credit-score damage. Always surface at WARNING level minimum.
- **מינוס (overdraft):** negative bank balance. Track projected daily balance going negative at any future point in the month; severity scales with depth/duration.
- **מסגרת אשראי (credit limit):** per-card framework. Utilization > 70% = warning, > 90% = blocked from new charges.
- **הוראת קבע (standing order):** fixed monthly deduction (rent, loans, insurance, university). Certain future outflow = `{ amount, dayOfMonth, description, category }`. Always include in cashflow projections.

**The only 3 Israeli card issuers** (covers 100% of market): `Max` (מקס), `Isracard` (ישראכרט — also issues Amex), `CAL` (כ.א.ל — issues Visa + Diners). No other issuer value is valid. Each has multiple מועדונים (clubs) with different benefits; the benefits DB is keyed company → club → card type → benefit rules.

**Canonical verdict thresholds** (do not change without product sign-off):
- `approved`: buffer after purchase **> 20%** of income
- `warning`: buffer **5–20%** of income **OR** installment load **25–35%** **OR** credit utilization **70–90%**
- `blocked`: buffer **< 5%** **OR** installment load **> 50%** **OR** חזרת חיוב predicted **OR** utilization **> 90%**
- `wait_24h`: non-essential purchase **AND** buffer in the **5–15%** range
- **חזרת חיוב trigger:** `(currentBalance − obligations due before billing date) < card charge amount`

---

## 6. Engine Specifications

All engines are pure, synchronous, offline-first. Each ships with a companion Jest file at `/src/engines/__tests__/<name>.test.ts`. Tests are **mandatory before any PR** that touches an engine.

### 6.1 `/src/engines/purchaseGate.ts`
```ts
function evaluatePurchase(input: PurchaseInput): PurchaseDecision
// returns { verdict, reason, reasonAr, details }
// verdict: 'approved' | 'warning' | 'blocked' | 'wait_24h'
```
Logic: apply the §5 threshold table. `reason` in Hebrew AND `reasonAr` in Arabic — both must be non-empty. If `input.isInternational === true`, include an exchange-fee warning in the reason when relevant. Card scoring is NOT done here — that is `cardRoleEngine`.

### 6.2 `/src/engines/cardRoleEngine.ts`
```ts
function assignCardRole(card: CardInput, userProfile: UserProfile): CardRole
function recommendCard(
  cards: CardInput[], purchaseCategory: PurchaseCategory,
  userProfile: UserProfile, isInternational: boolean
): CardRecommendation
// CardRole: 'daily' | 'travel' | 'subscriptions' | 'installments' | 'education' | 'benefits'
```
Each card gets exactly ONE primary role. `recommendCard` returns a ranked result with a 0–100 `score` plus `scoreReason` (He) and `scoreReasonAr` (Ar). If `isInternational`, weight travel cards higher and apply an exchange-fee penalty in score. Cards with `unknownClub === true`: score on company defaults, flag `scoreReason = "מועדון לא ידוע — ייתכן הטבות נוספות"`. Cards valid for the user's `bankName` get a flat **+5** score bonus.

### 6.3 `/src/engines/installmentGate.ts`
```ts
function evaluateInstallment(
  installmentRequest: InstallmentRequest,
  existingInstallments: Installment[], monthlyIncome: number
): InstallmentDecision
```
Thresholds on resulting load: `< 25%` approved · `25–35%` warning (with monthly breakdown) · `35–50%` strong warning (+ 3-month cashflow impact) · `> 50%` blocked. Output: monthly addition, total cost, next-3-months impact, warning level.

### 6.4 `/src/engines/cashflowRadar.ts`
```ts
function calculateMonthlyRisk(month: MonthInput): RiskScore
function predictChargeReturn(cards: CardInput[], obligations: Obligation[], balance: number): ChargeReturnRisk
function getDailyBalanceProjection(month: MonthInput): DayBalance[]
```
Risk score 0–100 (0 safe, 100 critical). חזרת חיוב predicted when `(balance − upcoming obligations) < 0` within 7 days. מינוס predicted when projected balance goes negative at any point in the month. `DayBalance[]` powers the Cashflow Calendar UI.

### 6.5 `/src/engines/benefitsMatcher.ts` (M4)
```ts
function findBestCard(cards: UserCard[], purchase: PurchaseContext, benefitsDB: BenefitsDatabase): BenefitMatch[]
function calculateMissedSavings(cards: UserCard[], transactions: Transaction[], benefitsDB: BenefitsDatabase): MissedSavings
```
`benefitsDB` is always passed in by the caller (loaded from `/src/data/*.json` via the store). The engine never fetches its own data. Benefits matching content/rules are Agent 2's domain — this file owns the shell + matching mechanics only.

**Mandatory Jest cases for EVERY engine function (10 minimum):** (1) happy path; (2) minimum valid input; (3) maximum/extreme values; (4) Israeli edge — billing date = last day of month (31→Feb 28/29); (5) Israeli edge — חזרת חיוב scenario; (6) Israeli edge — מינוס scenario; (7) boundary exactly at the warning threshold; (8) boundary exactly at the blocked threshold; (9) multiple cards; (10) zero income / zero balance → must return `'blocked'`, never throw or divide-by-zero. Also cover empty arrays (`cards: []`, `installments: []`), ₪0.01 and ₪1,000,000 amounts, and negative inputs (rejected, not crashed). Use test-data factories (`makeUser`, `makeCard`, `makeInstallment`, `makeObligation`) at the top of each file — never repeat raw objects.

---

## 7. Types Specification (`/src/types/`)

All 8 type files exist and compile (committed `3cae95a`). Extend them — do not rewrite.

- `card.types.ts` — `CardInput`, `UserCard`, `CardRole`, `CardRecommendation`. `UserCard` includes `bankName?: string`, `unknownClub?: boolean`, `clubSuggestedByApp?: boolean`. `CardRecommendation` includes `score: number` (0–100), `scoreReason: string`, `scoreReasonAr: string`. `issuer` ∈ `'Max' | 'Isracard' | 'CAL'`.
- `purchase.types.ts` — `PurchaseInput` (includes **mandatory** `isInternational: boolean`), `PurchaseDecision`, `PurchaseCategory`, `DecisionDetails`.
- `installment.types.ts` — `Installment`, `InstallmentRequest`, `InstallmentDecision`.
- `cashflow.types.ts` — `MonthInput`, `RiskScore`, `DayBalance`, `ChargeReturnRisk`, `Obligation`.
- `benefit.types.ts` — `BenefitsDatabase`, `BenefitMatch` (includes `isValidForInternational: boolean`, `exchangeFeePercent?: number`), `MissedSavings`, `UserCard`, `Transaction`.
- `user.types.ts` — `UserProfile { bankName?, phoneNumber?, monthlyIncome, currentBalance, dangerThreshold }`.
- `feature.types.ts` — `FeatureStatus = 'live' | 'soon' | 'beta' | 'pro_only'`, `FeatureConfig`, `INITIAL_FEATURE_STATUS`.
- `decision.types.ts` — verdict union (see conflict note below).

**⚠️ VERDICT UNION — MUST FIX BEFORE M2:** the canonical union is `'approved' | 'warning' | 'blocked' | 'wait_24h'`. Any legacy `'approve' | 'warn' | 'block'` in `decision.types.ts` must be retired and all imports updated. `wait_24h` must not be dropped.

**INITIAL_FEATURE_STATUS naming note:** the committed code uses **UI-component keys** — `BenefitsScreen: 'soon'` (phase 4), `SavingsTracker: 'soon'` (3), `ScoreSection: 'soon'` (3), `InternationalMode: 'soon'` (3), `ProUpgrade: 'pro_only'` (5). Conceptual keys (`PURCHASE_GATE`, `CARD_ROLE`, `CASHFLOW_CALENDAR` = `'live'`; `CARD_SCORE`, `MONTHLY_REPORT`, `TRAVEL_RECOMMENDATIONS`, `MERCHANT_SEARCH`, `AI_CONSULTATION` = `'soon'`) are for engine gating. Do NOT rewrite the file to unify them — extend it. This map is the sole source of truth for all feature gates; no screen/store/engine hardcodes a gate state.

---

## 8. Screen & Component Rules

- **Offline-first:** every screen renders meaningfully with zero network. No spinner waits on network. Missing MMKV data → empty state, not loading state. Never call `fetch()`/`axios` inside a screen or inside a hook that blocks rendering. Subtle offline banner at top when network is down; the app keeps working.
- **RTL always:** support Hebrew + Arabic. Use `I18nManager.isRTL` for directional logic; prefer `ms-`/`me-` over `ml-`/`mr-`; `text-start` not `text-left`; flip directional icons with `scaleX: I18nManager.isRTL ? -1 : 1`. `I18nManager.forceRTL` is set globally in `App.tsx`. Test every screen in both languages before "done".
- **NativeWind:** deferred to M3 (`UI-07`). Until then use `StyleSheet.create`. Dark mode + 3-layer theming come **after** NativeWind is wired.
- **Screen pattern:** screen → hook → engine. Hooks call engines synchronously with local store data; screens hold no logic. Every screen must render correctly when `cards = []`.
- **Currency:** always show ₪; format with `Intl.NumberFormat('he-IL')` → `₪1,234.50`. Never show a bare minus — render overdraft as `"חריגה של ₪XXX"`.
- **Verdict colors:** approved `#16A34A`, warning `#D97706`, blocked `#DC2626`, wait_24h `#2563EB`. **Calendar risk colors:** safe `#DCFCE7`, tight `#FEF9C3`, danger `#FEE2E2`.
- **FeatureGate.tsx** (required pattern): `<FeatureGate featureId="CARD_SCORE">…</FeatureGate>`. `'live'` → render normally. `'soon'` → grayed children + "בקרוב" badge overlay. `'pro_only'` → grayed children + "Pro בלבד" badge + upgrade CTA. Tapping a locked overlay opens a modal with the feature description + release label. Reads status from `INITIAL_FEATURE_STATUS` via `useFeatureFlag(featureId)`.
- **Onboarding (4 steps):** Step 1 bank selection — 5 tappable boxes `לאומי | הפועלים | דיסקונט | מזרחי | אחר` (MVP; do NOT change to progressive disclosure until `ONBOARD-IMPROVE-01` in M3). Step 2 income + balance (validate both > 0 before advancing). Step 3 add first card — issuer selector + club dropdown + always-visible "אני לא יודע את המועדון" button opening a 3-question guided flow that suggests a club or sets `unknownClub=true`. Step 4 phone number (optional, label "מספר טלפון — לשחזור חשבון בעתיד (אופציונלי)", no OTP until Phase 4) + `isOnboardingComplete` wired to `useUserStore` + AuthGate handoff (authenticated & `!isOnboardingComplete` → show OnboardingScreen). **Status: Steps 1+2+3 ✅ done; Step 4 ❌ stub.** Also fix: `pending_card` migration in `debugUnlock`, and `onboarding_complete` writing via the wrong `new MMKV()` instead of `onboardingStorage`.
- **בארץ/חו"ל toggle:** top of PurchaseGateScreen, default בארץ 🇮🇱; switching to חו"ל ✈️ passes `isInternational=true`; if card has exchange-fee data, show `⚠️ עמלת המרה X%` in the result.
- **ContactScreen (M3):** static, per-company (Max/Isracard/CAL) contact data; issue-type selector → phone + what to say. No network. Entry from Settings and from DecisionScreen after a blocked/warning verdict.
- **Dynamic theming (M3, after NativeWind):** Layer 1 Bank = main-screen background brand color; Layer 2 Company accent (Max orange / Isracard blue / CAL purple); Layer 3 Club badge chip. **Dark mode:** background always `#141414`; brand color appears only on cards/badges/accents (never as background); HSL: reduce saturation, lightness 55–65%; use NativeWind `dark:` utilities, no manual `Platform.OS` color checks.
- **No financial data in logs** (see §9). Add `babel-plugin-transform-remove-console` to `babel.config.js` for production before M5.

---

## 9. Security Constraints (Hard Rules — Non-Negotiable)

Source of truth: `docs/SEC-CONTRACT-001.md`. The invariant the whole module defends: *without a fresh biometric or PIN success this session, the only thing on disk is ciphertext, and the key that decrypts it is not retrievable.*

**Acceptance Criteria — AC-1 … AC-8 (must all pass for STORE-01 / AUTH-01 / any financial merge):**
- **AC-1** With the app locked, the on-disk MMKV file is ciphertext; no plaintext balance/income/last-4 recoverable.
- **AC-2** Keychain item carries auth-required + this-device-only flags on **both** iOS and Android.
- **AC-3** No DEK, key bytes, salt, or PIN appears in any `console.*`, Sentry breadcrumb, or persisted store.
- **AC-4** Deep link / cold start into a financial route lands on `LOCKED` and forces auth.
- **AC-5** Switching biometric↔PIN does not reset the failure counter; the lockout schedule fires; the terminal action works.
- **AC-6** PIN verification uses Argon2id with recorded params; grep finds no MD5/SHA1/plain-SHA256 on the PIN.
- **AC-7** Background > 5 min wipes the in-memory DEK (post-timeout read fails until re-auth) and the app-switcher snapshot is blurred.
- **AC-8** No hardcoded key/seed in source; `keySchemeVersion` + `kdfVersion` present.

**Navigation binding — BIND-1 … BIND-4 (verbatim, permanent):**
- **BIND-1** Auth success MUST be the trigger that unwraps the DEK. No path may reach `UNLOCKED` (DEK in memory, navigator mounted) without it.
- **BIND-2** Financial screens MUST mount only inside the authenticated navigator. Per-screen `useEffect` auth checks are MUST NOT as the sole gate. (Hidden-but-mounted is not acceptable — verify at the component-tree level.)
- **BIND-3** Cold start via deep link or OS state-restoration MUST route to `LOCKED` and force auth before the authenticated navigator mounts.
- **BIND-4** There MUST be no app state in which the navigator is mounted but the DEK is absent (and vice versa) — they transition together.

**PIN hardening — PIN-1 … PIN-7 (verbatim):**
- **PIN-1** The PIN MUST NOT be stored in any form comparable in plaintext. Store only a verifier, or use the PIN solely to unwrap key access via a slow KDF.
- **PIN-2** KDF MUST be Argon2id (scrypt acceptable, documented). MUST NOT be MD5/SHA1/plain-SHA256.
- **PIN-3** Argon2id params tuned to ~250–500 ms on a mid-range device. Record params + `kdfVersion`.
- **PIN-4** Salt MUST be a per-install 16-byte CSPRNG value stored in the keychain (not bundled, not hardcoded).
- **PIN-5** Lockout MUST apply escalating backoff. The biometric and PIN paths share ONE counter — switching methods MUST NOT reset the count.
- **PIN-6** A terminal action MUST be defined and implemented after the final threshold (wipe local financial data OR enter extended lock).
- **PIN-7** The PIN MUST NOT unlock anything the biometric can't — equal scope, no backdoor.

**Implemented crypto (ground truth from committed code):** DEK = 256-bit CSPRNG → hardware keychain (`expo-secure-store`, auth-required, this-device-only) → retrieved memory-only per session. PIN KDF = **Argon2id via `@noble/hashes`** (pure JS); implemented params `t=2, m=19456 KiB, p=1`, `KDF_VERSION=2`; PIN envelope = **AES-256-GCM via `@noble/ciphers`**; pepper = 16-byte CSPRNG in keychain (device-bound). Contract minimum is `t=3, m=65536` — a calibration spike against a real mid-range Android device is an OPEN MEDIUM item; do not silently lower below contract without re-ratifying SEC-CONTRACT-001. The MMKV encryptionKey is derived at runtime from the DEK — never a string literal.

**Lockout schedule (single counter, owned by keyVault):** 1–4 no delay · 5 → 30s · 6 → 1min · 7 → 5min · 8 → 15min · 9 → 1h · 10 → terminal action.

**🚫 HIGH-01 — lockout backoff clock (still open; known bug — apply verbatim):** the backoff elapsed-time aggregation MUST use `Math.min`, NOT `Math.max`. `Math.max` was wrongly applied and blocks AUTH-01 merge.
```ts
const elapsed = Math.min(monotonicDelta, wallClockDelta); // backoff: trust the shorter reading
const clampedElapsed = Math.max(0, elapsed);              // clamp for monotonic resets
```
Rationale: for *backoff*, an attacker wants to inflate elapsed time to expire the lockout early; `Math.min` trusts the shorter reading (only one clock can be inflated at a time). **Session timeout is the opposite** — it correctly uses `Math.max` (lock at the shorter elapsed = fail-safe). These are two separate aggregations with opposite correct directions; do not conflate them.

**RATIFIED terminal action (resolves the project's "PIN-7" terminal-action item + HIGH-REC-01):** the terminal tier is a **rate-limited but recoverable extended lock**, with **biometric as the recovery path** — not an unconditional data wipe. Persist the terminal lockout via a **wall-clock timestamp** in MMKV under key `security:terminal_locked_until` (so a monotonic-clock reset on app restart cannot strand the user permanently), and **exempt biometric from terminal-tier checks** so the user can always recover via biometric. Do not implement an unrecoverable wipe as the default.

**Logging — NEVER allowed in `console.*` (or Sentry breadcrumbs):** `balance`, `income`, `cardNumber`, `userId`, any MMKV value, DEK/key bytes, salt, or PIN. Dev-only structural logs (`'[onboarding] step completed'`) are tolerable but stripped in production. There are leftover diagnostic `console.log` lines in `src/navigation/authContext.tsx` — remove them.

**Storage:** `keyVault.ts` is the only source of MMKV keys/encryption. Card numbers are stored as **last-4-digits only** — never the full PAN. `keyVault.initializeOnFirstLaunch()` MUST be called in `App.tsx` before `<AuthProvider>` (currently a workaround lives in `debugUnlock` — move it).

**Input validation (enforce on every financial input):** monetary numeric only, **₪0.01–₪999,999**; percentages 0–100; card billing date 1–31; month/year validated against the real calendar; Hebrew/Arabic text inputs checked for script injection.

**M2 auto-BLOCK conditions (any one = immediate block):** `fetch()`/`axios` inside `/src/engines/` (CRITICAL) · financial screen added outside `AuthenticatedNavigator` (CRITICAL) · network response stored to MMKV without a DEK retrieved from keyVault (CRITICAL) · MMKV key built from user input (HIGH) · `console.log` with balance/income/cardNumber/userId (HIGH) · monetary input without the validation contract (HIGH) · benefits JSON downloaded without checksum verification (HIGH).

**Confirmed passing (do not regress):** BIND-1..4 structurally in place; PIN-1 no plaintext PIN; single lockout counter in keyVault; session timeout `Math.max` correct; `initializeOnFirstLaunch()` ordering verified in App.tsx code review. **Deferred to before M5:** HIGH-02 app-switcher privacy blur (app-shell scope). **Out of scope here:** Supabase RLS, JWT-in-keychain, cert pinning (Phase 4+ separate contract).

---

## 10. Known Errors & Permanent Fixes

**Environment (run the pre-build checklist every session):**
1. `node --version` → must be v20.x (v24 BANNED with SDK 52).
2. Ghost `package.json`: `Get-ChildItem C:\Users\ebrah\package.json` → must NOT exist (a stale SDK-56 file there hijacks npm root). Delete it before every `npm install`.
3. `Get-Location` → must be the project root before `git init`/installs.
4. `Test-Path node_modules` → if False, run `npm install` **before** any `npx expo` command (reverse order → `expo-module-gradle-plugin not found`).
5. `newArchEnabled=true` in `android/gradle.properties` (required by MMKV 3.3.3).
6. `npx tsc --noEmit` → zero errors.
7. `npx expo-doctor` → all checks pass (the **only** authority on SDK-52-compatible versions; never `npm install <pkg>@latest`, use `npx expo install`).
8. `adb devices` → Samsung S928B listed.

**Documented errors and their exact fixes:**
- **BufferSource TS error** (`Uint8Array<ArrayBufferLike>` not assignable) in keyVault `sha256` (TS 5.7+ generic on typed arrays) → wrap the value in `new Uint8Array(data)` before passing.
- **`adb not recognized`** → add `%LOCALAPPDATA%\Android\Sdk\platform-tools` to PATH.
- **Metro `EACCES /var/run/docker.sock`** → stop Docker Desktop (or `npx expo start --clear` after restarting the terminal).
- **`expo-module-gradle-plugin not found`** → `npm install` first to restore local `expo`, then `npx expo run:android`.
- **Node v24 crash** → `nvm use 20.20.2`.
- **MMKV compile fail (New Arch required)** → set `newArchEnabled=true` + clean build.
- **Unlock not responding** → `keyVault.initializeOnFirstLaunch()` was missing before mount; move it to `App.tsx` before `<AuthProvider>` (architectural fix still pending).
- **UTF-16 corruption** (`ÿþ`/`\x00` prefixes from PowerShell `WriteAllText`/`Set-Content`) → re-save UTF-8 in VS Code or `git checkout`; always `git commit` before any batch file operation; avoid PowerShell `WriteAllText` without `-Encoding UTF8`.
- **SDK 54 peer conflicts** (React 19 vs RN 0.76) → stay on SDK 52; use `npx expo install`, not `@latest`.
- **Argon2id native build failure** (`react-native-argon2` incompatible with managed workflow) → use `@noble/hashes` (pure JS). (An earlier interim used PBKDF2 100k via expo-crypto; the @noble/hashes Argon2id path is the current state.)
- **Ghost `package.json`** → see env step 2.
- **Copilot Chat extension corruption** → delete `%USERPROFILE%\.vscode\extensions\github.copilot-chat-*` and reinstall from Marketplace.

**Permanent rules:** Node 20 always · `npx expo run:android` (never Expo Go) · `npx expo-doctor` is the version authority · `npx expo install` for native packages · `npm install` before `npx expo` after deleting node_modules · New Arch always on · `requireAuthentication: true` needs a physical device · UTF-8 + commit before batch ops · verify working dir before `git init` · `.gitignore` (`node_modules/`, `.expo/`, `.env`, `*.keystore`, `build/`, `dist/`) before first `git add` · SDK 52 pinned.

---

## 11. Finalized Decisions (Do Not Re-Open)

**✅ Ratified — treat as inviolable:** pre-purchase decision tool (not a budget tracker) · FinGuard + הטבות combined in one app · manual-first, no Open Banking in MVP (2+ years minimum) · Hebrew primary + full Arabic RTL · Freemium Free / Plus ₪29 / Pro ₪49, primary conversion = "Missed Savings" screen · React Native + Expo (not Next.js PWA) · TypeScript strict · MMKV (not AsyncStorage) · Zustand (not Redux) · NativeWind v4 (deferred to M3) · Supabase Phase 4+ only · offline-first from day 1 · biometric in M1 · engines strictly separated from UI · benefits DB bundled as JSON, updated in background · 3 issuers only (Max/Isracard/CAL) · club selection cascading dropdown (Company → Card Type → מועדון) · canonical verdict union `'approved' | 'warning' | 'blocked' | 'wait_24h'` · key lifecycle CSPRNG → hardware keychain → biometric/PIN-gated → memory-only · cold start always LOCKED · PIN mandatory, set in onboarding · session 5-min background auto-lock · PIN-forgotten has NO recovery beyond local wipe by design · AuthenticatedNavigator structural gate (no per-screen checks) · `ONBOARD-01` keeps the 5-bank grid; progressive disclosure (12 banks) is `ONBOARD-IMPROVE-01` in M3 · terminal action = recoverable extended lock with biometric recovery (see §9).

**❌ Rejected — do NOT propose:** budget-tracker framing · separate apps for FinGuard vs benefits · Open Banking in MVP · Redux/MobX/AsyncStorage/axios/moment · dropdown for bank selection (too cold) · full 12-bank grid (cluttered) · storing full PAN · AI/LLM consultation (Phase 5) · ticket/admin systems (need scale) · points gamification (Phase 5) · OCR/PDF upload (Phase 6) · family/couple mode (later) · legacy verdict union `'approve' | 'warn' | 'block'` · unconditional data-wipe as the default terminal action · OTP required for normal use (breaks offline-first).

**Open product items that can block code:** Argon2id param calibration vs contract minimum (MEDIUM); HIGH-02 app-switcher blur (before M5); COND-A MMKV KDF ~112-bit entropy (MEDIUM); COND-B pepper integration verification (MEDIUM).

**Conflict Hierarchy (when sources disagree):** (1) finalized decisions · (2) `SEC-CONTRACT-001.md` · (3) the four status summaries / this file's stated current state · (4) project history (committed code) · (5) build plan · (6) original agent prompts. Higher wins.

---

## 12. Current Build Status

- **M0 — Setup + Types:** ✅ COMPLETE. All 8 type files compile, zero TS errors (`3cae95a`, `TYPES-04`).
- **M1 — App Skeleton (~80%):**
  - `NAV-01` AuthGate + Tab + 5 screens ✅ (`6297b76`)
  - `NAV-02` per-tab stacks ✅ (`2863b76`)
  - `SEC-IMPL-01` keyVault.ts ✅ (`1c9a40b`, approved with conditions)
  - `AUTH-01` biometric + PIN ✅ committed (`40ffa33`) — but **🚫 HIGH-01 (`Math.min`) re-fix still required before this counts as merge-clean**
  - `STORE-01` useUserStore ✅ · `STORE-02` useCardsStore ✅ (`65f6a5b`)
  - `ONBOARD-01` ⚠️ Steps 1+2+3 ✅, **Step 4 ❌ stub**; `pending_card` migration + `onboarding_complete` MMKV-instance fix outstanding
  - `FEATURE-01` FeatureGate.tsx + useFeatureFlag.ts ❌ not started
- **M2 — Core Engines:** ❌ not started. Scope: the 4 engines (cardRole, purchaseGate, installmentGate, cashflowRadar) + Jest, `npx jest` 100%, zero network in engines, Agent-5-style security review.
- **M3+ — deferred, do NOT implement now:** M3 = 7 screens + NativeWind (`UI-07`) + theming/dark mode + ContactScreen + ONBOARD-IMPROVE-01. M4 = benefits engine/DB + feature unlocks. M5 = Supabase auth + paywall + EAS. Phase 4 = OTP + cloud sync. Phase 5/6 = AI, OCR, PDF.

---

## 13. Task Queue (Work in This Order)

Pick the first task that is not ✅ and whose blockers are clear. Do not start a BLOCKED task.

1. **HIGH-01 re-fix** — `/src/security/keyVault.ts`. Replace the `Math.max` backoff aggregation with the `Math.min` form in §9 (+ zero clamp). AC: lockout cannot be expired early by advancing either clock; session-timeout `Math.max` left untouched. *Blocks AUTH-01 merge-clean.*
2. **AUTH cleanup** — `src/navigation/authContext.tsx`. Remove diagnostic `console.log`s; implement the `pending_card` migration TODO in `debugUnlock`. AC: no financial-field logs; pending card migrates to encrypted storage on first unlock.
3. **initializeOnFirstLaunch move** — `App.tsx`. Call `keyVault.initializeOnFirstLaunch()` before `<AuthProvider>`; remove the workaround. AC: cold-start unlock works without the debug workaround.
4. **ONBOARD-01 Step 4** — `src/screens/onboarding/OnboardingScreen.tsx`. Optional phone field; always-enabled "סיום"; wire `isOnboardingComplete` to `useUserStore`; AuthGate handoff (authenticated & `!isOnboardingComplete` → Onboarding). Fix `onboarding_complete` to use `onboardingStorage`, not a fresh `new MMKV()`. AC: full 4-step flow end-to-end on device; flag persists.
5. **FEATURE-01** — `src/components/FeatureGate.tsx` + `src/hooks/useFeatureFlag.ts`. Badge overlay per `INITIAL_FEATURE_STATUS`; `useFeatureFlag(featureId)` returns the config (lookup only). AC: `'soon'`→"בקרוב", `'pro_only'`→"Pro בלבד", `'live'`→passthrough. *Completes M1.*
6. **M1 completion check** — `npx tsc --noEmit` zero errors; manual cold-launch → biometric → onboarding → Home. `git commit -m "feat: M1 complete"`.
7. **ENGINE-01** `cardRoleEngine.ts` (+ verdict-union canonicalization in `decision.types.ts` if not already done) → **TEST-01** (incl. חו"ל + unknownClub).
8. **ENGINE-02** `purchaseGate.ts` (isInternational exchange-fee branch) → **TEST-02**.
9. **ENGINE-03** `installmentGate.ts` (+ TEST).
10. **ENGINE-04** `cashflowRadar.ts` (4 functions) → **TEST-03**. Then `npx jest --coverage` (target 90%+) and a full offline-first/security self-audit of all engines. *Completes M2.*

Everything M3 and later is deferred until M2 is green.

---

## 14. Definition of Done

A task is complete only when **all** of these hold:
- `npx tsc --noEmit` returns zero errors.
- `npx jest` passes 100% for every engine touched (10+ mandatory cases each, incl. Israeli edge cases and the zero-income guard).
- No `fetch()`/`axios` anywhere in `/src/engines/`; no engine imports React/RN/Expo/screens/store/security.
- No `console.*` containing balance/income/cardNumber/userId/MMKV values/keys/salt/PIN.
- No new financial screen outside `AuthenticatedNavigator`; BIND-1..4 intact.
- All monetary inputs validated (numeric, ₪0.01–₪999,999).
- No `any`, no unguarded `!`, all params/returns typed.
- No hardcoded keys/seeds; MMKV encryptionKey comes from keyVault at runtime.
- New persistent data uses an MMKV key constant in `/src/store/keys.ts`.
- The PR contains no TODO left in shipped logic, no `any`, and no security violation from §9.

**Codex must NOT:** open PRs with TODOs in shipped logic, `any` types, or §9 security violations; make product decisions (route those to the human); upgrade Expo SDK or any pinned dependency; implement deferred M3+ work early; or implement an unrecoverable terminal wipe.

*End of AGENTS.md — start each session at §13.*
