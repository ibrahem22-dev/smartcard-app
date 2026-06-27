# SmartCard — AGENTS.md
### Codex Build Instructions | Replaces Agents 1, 3, 4, 5, 7, 9
### Last updated: June 27, 2026 — M3 ✅ complete · Features A1–F1 + 22–27

> This file is your only instruction source. Read it fully before every task.
> Every rule is a hard DO or DO NOT. When two statements conflict, the
> **Conflict Hierarchy** at the bottom of §11 wins. Start each session at §13 (Task Queue).

---

## 1. Project Overview

SmartCard (final name candidate: **MyCard**) is an Israeli FinTech mobile app — a **pre-purchase decision assistant**, not a budget tracker. Before any purchase it answers: (1) Can I afford this? (2) Which card should I use? (3) Which card saves the most? Target market: Israeli adults with 2–4 credit cards, תשלומים, הוראות קבע, מינוס risk. Hebrew-primary + full Arabic RTL; English for technical terms. Manual-first — no Open Banking in MVP.

---

## 2. Tech Stack (Pinned — Do Not Upgrade)

| Dependency | Version | Note |
|---|---|---|
| Node | **20.20.2** | PINNED. v24 crashes SDK 52 — BANNED. |
| Expo SDK | **52** | PINNED. No upgrade without isolated session. |
| React Native | 0.76.9 | Tied to SDK 52 (React 18.3). |
| New Architecture | **ENABLED** | `newArchEnabled=true` — mandatory for MMKV v3. |
| react-native-mmkv | 3.3.3 | V3 Classic API. Requires New Arch. |
| TypeScript | strict | `strict: true`, no exceptions. |
| @noble/hashes | pure JS | Argon2id KDF. |
| @noble/ciphers | pure JS | AES-256-GCM for PIN envelope. |
| expo-secure-store | installed | Hardware keychain for DEK + pepper. |
| expo-crypto | installed | CSPRNG. |
| expo-localization | installed | Device language detection. |
| expo-local-authentication | — | Biometric. |
| expo-notifications | — | Local push notifications (M4 — discount reminders). |
| Zustand | — | State. Redux/MobX BANNED. |
| React Navigation | v7 | Stack + Tab. |
| NativeWind | v4 | Active from M3. `tailwind.config.js` + `global.css` committed. |
| Jest | — | Mandatory for all engine logic. |
| Detox | — | E2E, Phase 3+ only. |

**BANNED:** `AsyncStorage`, `redux`, `mobx`, `axios`, `moment`, `react-native-argon2`, `any` type, packages outside Expo managed workflow.

**Run command:** `npx expo run:android`. Device: Samsung S928B (physical).

---

## 3. Folder Structure & Ownership Rules

```
/src
  /engines    Pure financial logic. ZERO React/RN/Expo imports. ZERO network. ZERO async.
              Includes: purchaseGate, cardRoleEngine, installmentGate, cashflowRadar,
              benefitsMatcher (M4), loanEngine (M4), interestCalculator (M4).
  /types      All interfaces/types. Never define types inline in screens or engines.
  /security   keyVault.ts ONLY. DEK + all crypto. No network.
  /services   Network calls ONLY (Phase 4+). Empty until then.
  /store      Zustand + MMKV. keys.ts = ALL key constants. Includes useProfileStore (M3),
              useLoansStore (M4), useCardRatesStore (M4).
  /screens    UI only. Calls hooks, never engines directly.
  /components  FeatureGate.tsx, ProfileSwitcher.tsx (M3), GlossaryScreen components.
  /hooks      usePurchaseGate.ts ✅, useCashflowCalendar.ts ✅, useFeatureFlag.ts ✅.
  /data       Static JSON — benefits DB (M4) + card_rates.json (M4). READ ONLY at runtime.
  /utils      parseAmount.ts ✅, languageService.ts (M3), currency/date/formatting helpers.
  /i18n       he.ts + ar.ts + en.ts (M3) translation maps.
/docs         SEC-CONTRACT-001.md. READ ONLY.
/shims        react-native-reanimated.js ✅ (Metro shim).
```

**Ownership rules:**
- `/src/engines/` — zero React/RN/Expo/screens/store/security imports. Violation = CRITICAL.
- Engines never import from each other — flat dependency graph.
- `/src/security/` — only place touching keychain or DEK.
- MMKV keys = constants in `keys.ts`. Profile keys = `profile_{id}:field`. Never inline strings.
- Screens → hooks → engines. Never screen → engine directly (except pure type imports).

---

## 4. TypeScript Standards

- `strict: true`. No `any`, no `as any`. No unguarded `!`.
- Every parameter and return type explicitly typed.
- String-literal unions for fixed sets (verdicts, roles, categories, LoanType, LanguagePref).
- `readonly` on immutable parameters.
- No external libs in engines — native TS only.
- `import type { X } from '../types/x.types'`.
- **Clean = `npx tsc --noEmit` → zero errors before any commit.**

---

## 5. Israeli Financial Domain

- **תשלומים:** purchase split monthly. `{ totalAmount, numMonths, monthlyPayment, billingCard, billingDate, category }`.
- **חזרת חיוב:** bank balance insufficient on billing date. ≈₪80 fee + penalties. Always WARNING minimum.
- **מינוס:** negative bank balance. Track projected daily balance.
- **מסגרת אשראי:** per-card credit limit. >70% = warning, >90% = blocked.
- **הוראת קבע:** fixed monthly deduction. Certain future outflow.
- **הלוואה אישית:** personal loan. Fixed monthly payment + end date. Treated as obligation in cashflow.
- **משכנתא:** housing loan. MVP = fixed obligation with `type: 'mortgage'`. No מסלולים.
- **דמי כרטיס:** monthly card fee. Most users have discounts — often forgotten when they expire.
- **ריבית קרדיט:** interest on deferred credit payment. Typically prime + X%.
- **עמלת המרה:** foreign exchange commission (2–3% in Israel). Varies per issuer/club.
- **Load%:** (sum monthly installment payments / monthlyIncome) × 100.

**3 Israeli card issuers only:** `Max`, `Isracard`, `CAL`. No other value valid.

**Verdict thresholds (canonical):**
- `approved`: buffer > 20% income · `warning`: 5–20% OR load 25–35% OR utilization 70–90%
- `blocked`: < 5% OR load > 50% OR חזרת חיוב predicted OR utilization > 90%
- `wait_24h`: non-essential AND buffer 5–15%
- **חזרת חיוב:** `(currentBalance − obligations before billing date) < charge amount`

---

## 6. Engine Specifications

All engines: pure, synchronous, offline-first. Companion Jest file mandatory before any PR.

### 6.1 `purchaseGate.ts` ✅
```ts
function evaluatePurchase(input: PurchaseInput): PurchaseDecision
// verdict union, reason (He) + reasonAr (Ar). isInternational → exchange-fee warning.
```

### 6.2 `cardRoleEngine.ts` ✅
```ts
function assignCardRole(card: CardInput, userProfile: UserProfile): CardRole
function recommendCard(cards: CardInput[], purchaseCategory: PurchaseCategory,
  userProfile: UserProfile, isInternational: boolean): CardRecommendation
// isInternational=true → rank by foreignExchangeCommission (lowest first).
// If card has hasForeignCurrencyAccount=true AND currency matches → commission = 0, rank first.
// Feature 23 is an extension of this function, not a separate engine.
```

### 6.3 `installmentGate.ts` ✅
```ts
function evaluateInstallment(req: InstallmentRequest, existing: Installment[],
  monthlyIncome: number): InstallmentDecision
// PROD-INSTALL-01: exactly 35% = Warning (not Strong Warning).
```

### 6.4 `cashflowRadar.ts` ✅
```ts
function calculateMonthlyRisk(month: MonthInput): RiskScore
function predictChargeReturn(cards: CardInput[], obligations: Obligation[], balance: number): ChargeReturnRisk
function getDailyBalanceProjection(month: MonthInput): DayBalance[]
// Obligations include: הוראות קבע + installment payments + loan payments + mortgage payment.
```

### 6.5 `loanEngine.ts` (M4)
```ts
function calculateLoanSummary(loan: Loan): LoanSummary
// { remainingBalance, remainingMonths, totalInterestRemaining, monthlyPayment }
// Mortgage: same function, type='mortgage', no מסלולים.
function calculateLoanImpact(loans: Loan[], monthlyIncome: number): LoanImpact
// { totalMonthlyObligation, percentOfIncome, riskLevel: 'low'|'medium'|'high' }
```

### 6.6 `interestCalculator.ts` (M4 — Features 24 + 24.2)
```ts
function calculateInstallmentInterest(
  amount: number, months: number, annualRate: number
): InterestResult
// Feature 24: ריבית על עסקת קרדיט תשלומים

function calculateCardLoan(
  principal: number, months: number, annualRate: number
): InterestResult
// Feature 24.2: ריבית על הלוואה מתוך הכרטיס

type InterestResult = {
  totalInterest: number
  effectiveMonthlyPayment: number
  totalCost: number
  schedule: MonthlyPaymentBreakdown[]  // full amortization table
}
type MonthlyPaymentBreakdown = { month: number; principal: number; interest: number; balance: number }
// Uses Shpitzer (שפיצר) method: fixed monthly payment, decreasing interest portion.
// annualRate validation: 0–30% (Israeli legal max for consumer credit).
```

### 6.7 `benefitsMatcher.ts` (M4)
```ts
function findBestCard(cards: UserCard[], purchase: PurchaseContext,
  benefitsDB: BenefitsDatabase): BenefitMatch[]
function calculateMissedSavings(cards: UserCard[], transactions: Transaction[],
  benefitsDB: BenefitsDatabase): MissedSavings
```

**Mandatory Jest cases (10+ per function):** happy path · minimum input · extreme values · Israeli billing edge (31→Feb) · חזרת חיוב · מינוס · warning boundary · blocked boundary · multiple cards · zero income → `'blocked'`, never throw · empty arrays · ₪0.01 + ₪1,000,000 · negative inputs rejected. Factories required.

---

## 7. Types Specification (`/src/types/`)

Extend — do not rewrite existing files.

**Existing (all compile ✅):**
- `card.types.ts` · `purchase.types.ts` · `installment.types.ts` · `cashflow.types.ts`
- `benefit.types.ts` · `user.types.ts` · `feature.types.ts` · `decision.types.ts`
- `contact.types.ts` ✅ (committed — `ProblemType`, `IssuerContact`)

**Extensions to `card.types.ts` (M4 — CARD-RATES-TYPES-01):**
```ts
// Add to CardInput:
cardRates?: CardRates          // from card_rates.json (auto-filled) or manual entry
cardFee?: CardFeeInfo          // monthly fee + discount (Feature 27)
hasForeignCurrencyAccount?: boolean   // כרטיס מחובר לחשבון מט"ח
foreignCurrencyType?: 'USD' | 'EUR' | 'GBP' | 'other'
bankFxCommission?: number      // bank's FX rate (replaces issuer commission if מט"ח)
cardIssuanceDate?: string      // ISO date — used for discount reminder anniversary

type CardRates = {
  creditInterestRate: number         // ריבית קרדיט שנתית (%)
  installmentInterestRate: number    // ריבית תשלומים (%)
  cardLoanInterestRate: number       // ריבית הלוואה מהכרטיס (%)
  foreignExchangeCommission: number  // עמלת המרה (%)
  source: 'db' | 'manual'           // where did this data come from
  lastUpdated: string                // ISO date — shown in UI as disclaimer
}

type CardFeeInfo = {
  monthlyFeeOriginal: number         // original fee from card_rates.json or manual
  hasDiscount: boolean
  discountPercentage?: number        // 0–100
  effectiveMonthlyFee: number        // monthlyFeeOriginal × (1 - discount/100)
  discountEndDate?: string           // ISO date — triggers reminder
  discountSource: 'db' | 'manual' | 'document'
}
```

**New type files (M3–M4):**
- `loan.types.ts` (M4) — `LoanType`, `Loan`, `LoanSummary`, `LoanImpact`, `LoanDecision`
- `profile.types.ts` (M3) — `AppProfile`, `ProfileSummary`
- `interest.types.ts` (M4) — `InterestResult`, `MonthlyPaymentBreakdown`

**Updated `user.types.ts`:** add `languagePreference: 'device' | 'he' | 'ar' | 'en'`

**⚠️ VERDICT UNION:** `'approved' | 'warning' | 'blocked' | 'wait_24h'` — canonical. Legacy `'approve'|'warn'|'block'` BANNED.

---

## 8. Screen & Component Rules

**Core rules:** offline-first · RTL always · NativeWind active (M3 ✅) · screen→hook→engine · ₪ currency with `Intl.NumberFormat('he-IL')`.

**Verdict colors:** approved `#16A34A` · warning `#D97706` · blocked `#DC2626` · wait_24h `#2563EB`.
**Calendar risk:** safe `#DCFCE7` · tight `#FEF9C3` · danger `#FEE2E2`.
**Glossary accent:** `#1D4ED8` (informational blue).

**Open RTL issue:** `ISSUE-RTL-01` — Hebrew text displaying LTR. Deferred to standalone session. Do NOT attempt to fix inline during other tasks.

**FeatureGate.tsx ✅:** `'live'` render · `'soon'` grayed+"בקרוב" · `'pro_only'` grayed+"Pro בלבד"+modal.

**Committed screens (all live on device ✅):**
PurchaseGateScreen · DecisionScreen · CardsScreen · HomeScreen · ContactScreen · CalendarScreen · LockScreen

**New files committed in M3 session:**
`usePurchaseGate.ts` · `useCashflowCalendar.ts` · `parseAmount.ts` · `contact.types.ts` · `tailwind.config.js` · `global.css` · `shims/react-native-reanimated.js`

---

**LockScreen redesign (LOCK-UI-01 — M3 polish):**
Biometric [primary] + PIN [secondary] both visible. OTP = FeatureGate `'soon'`. Bank theme Layer 1 as background. No keyVault changes.

**Language (LANG-01 — M3 polish):**
`expo-localization` on first launch. Default Hebrew. Settings picker: 4 options. English = LTR → restart dialog. `app:language_preference` in MMKV.

**Existing Installments Import (INSTALL-IMPORT-01 — M3 polish):**
`InstallmentImportScreen` — merchantName, originalAmount, numMonths, monthsPaid, monthlyPayment, billingCardId, billingDay. `source: 'imported'`. Reflected immediately in cashflowRadar.

**Multi-Profile (PROFILE-01/02 — M3 polish):** `useProfileStore` · MMKV namespace `profile_{id}:*` · max 5 · ProfileSwitcher component · active ID in `app:active_profile_id`.

**Multi-User on Device (MULTI-USER-01 — M3 polish):** each profile = own PIN verifier in keyVault. LockScreen profile selector when >1 profile.

**Glossary Screen (GLOSSARY-01 — M3 polish, Feature 25):**
Static informational screen. No engine. Entry from Settings.
Terms: ריבית פריים · ריבית נומינלית · ריבית אפקטיבית · מחשבון שפיצר · עמלת המרה · חזרת חיוב · מסגרת אשראי · קרדיט · מינוס.
Each term: title + 2-3 sentence plain Hebrew explanation + "כיצד זה משפיע עליי?" button → opens example with user's own numbers.

**Card Detail Screen (CARD-DETAIL-01 — M4, Feature 22):**
Tapping a card in CardsScreen opens `CardDetailScreen`. Shows:
- Card info: issuer, club, last-4, billing date, credit limit
- Financial rates (from `CardRates` — auto-filled from `card_rates.json` or manual):
  ריבית קרדיט · ריבית תשלומים · ריבית הלוואה · עמלת המרה · דמי כרטיס
- Disclaimer: `"המידע מוצג לנוחות — בדוק מול חברת הכרטיסים לוידוא. עודכן: [lastUpdated]"`
- Discount section (Feature 27): current fee, discount %, effective fee, expiry date
- Edit button for all rate fields (manual override)
- Foreign account section: toggle `hasForeignCurrencyAccount` + currency + bankFxCommission
- Link to InterestCalculatorScreen

**Discount Reminder (DISCOUNT-REMINDER-01 — M4, Feature 27):**
- If `discountEndDate` known: local push notification 30 days before + 7 days before + on expiry
- If `discountEndDate` unknown + `cardIssuanceDate` known: annual reminder on anniversary (month 11)
- Global annual reminder every January 1: "בדוק את ההנחות על דמי הכרטיסים שלך"
- Manual entry UI in CardDetailScreen: discount %, end date, or "לא ידוע — תזכר שנתי"
- Uses `expo-notifications` (local only — no server)
- Notification text: `"הנחת דמי הכרטיס של [cardName] מסתיימת בעוד חודש — שקול להתקשר לחברת הכרטיסים"`

**FX Card Recommendation (FX-RECOMMEND-01 — M4, Feature 23):**
Extension of `cardRoleEngine.recommendCard` when `isInternational=true`:
- Rank cards by `foreignExchangeCommission` (lowest first)
- If `hasForeignCurrencyAccount=true` AND matching currency → commission = 0 → rank first
- If `hasForeignCurrencyAccount=true` AND different currency → use `bankFxCommission`
- Display comparison on DecisionScreen (international mode): all user cards with their commissions
- Only shown when user has ≥2 cards with `cardRates` defined

**Interest Calculator Screen (INTEREST-CALC-UI-01 — M4, Features 24 + 24.2):**
Two tabs: "ריבית תשלומים" + "הלוואה מהכרטיס"
Inputs: amount, months, interest rate (pre-filled from active card's CardRates)
Output: total interest, monthly payment, total cost, full amortization table (שפיצר)
Card selector: if user has multiple cards, shows rates per card for comparison
Disclaimer: "לצורך הדגמה בלבד — לא ייעוץ פיננסי"

**Dark Mode (UI-DARKMODE-01 — M3 polish):** bg `#141414` · brand on badges/cards only · NativeWind `dark:` utilities only.

**3-Layer Bank Theming (UI-THEME-01 — M3 polish):**
Layer 1: bank bg (לאומי=blue, הפועלים=red, דיסקונט=purple, מזרחי=orange, אחר=neutral)
Layer 2: company accent (Max=`#FF6B00`, Isracard=`#0057B7`, CAL=`#6B21A8`)
Layer 3: club badge chip on card components

**Onboarding (ONBOARD-IMPROVE-01 — M3 polish):** top 4 banks + expandable 12-bank list.

**No financial data in logs.** `babel-plugin-transform-remove-console` before M5.

---

## 9. Security Constraints (Hard Rules — Non-Negotiable)

Source of truth: `docs/SEC-CONTRACT-001.md`.

**AC-1…AC-8 (all passing ✅):** ciphertext at rest · auth-required keychain · no keys in logs · deep link → LOCKED · shared lockout counter · Argon2id PIN · 5-min auto-lock DEK wipe · no hardcoded keys.

**BIND-1…BIND-4 (✅ structurally in place):** auth before navigation · financial tabs inside AuthenticatedNavigator only · cold start always LOCKED · DEK and navigator transition together.

**PIN-1…PIN-7 (✅ implemented):** no plaintext PIN · Argon2id KDF · per-install salt · shared lockout counter · terminal action defined.

**HIGH-01 (✅ FIXED):** lockout backoff = `Math.min(monotonicDelta, wallClockDelta)`. Session timeout = `Math.max`. Do not conflate.

**HIGH-02:** app-switcher blur — deferred to M5.

**Terminal action (ratified):** recoverable extended lock + biometric recovery. `security:terminal_locked_until` in MMKV. No unconditional wipe.

**Logging:** NEVER log balance, income, cardNumber, userId, MMKV values, DEK, salt, PIN.

**Storage:** keyVault.ts = only MMKV crypto source. Card numbers = last-4 only. Profile namespaces encrypted via same DEK. CardRates and CardFeeInfo stored in profile namespace — not in logs.

**Input validation:** monetary ₪0.01–₪999,999 · interest rates 0–30% (legal max) · loan months 1–360 · discount 0–100% · FX commission 0–10%.

**M4 auto-BLOCK conditions:** `fetch()`/`axios` in `/src/engines/` · financial screen outside AuthenticatedNavigator · MMKV key from user input · `console.log` with financial data · interest rate input without 0–30% bound validation.

---

## 10. Known Errors & Permanent Fixes

**Pre-build checklist (every session):**
1. `node --version` → v20.x
2. `Get-ChildItem C:\Users\ebrah\package.json` → must NOT exist
3. `Get-Location` → project root
4. `Test-Path node_modules` → if False, `npm install` first
5. `newArchEnabled=true` in `android/gradle.properties`
6. `npx tsc --noEmit` → 0 errors
7. `npx expo-doctor` → all pass
8. `adb devices` → Samsung S928B listed

**Documented fixes:**
- `Uint8Array<ArrayBufferLike>` → `new Uint8Array(data)` before passing
- `adb not recognized` → add platform-tools to PATH
- Metro `EACCES /docker.sock` → stop Docker Desktop
- `expo-module-gradle-plugin not found` → `npm install` first
- Node v24 → `nvm use 20.20.2`
- MMKV compile fail → `newArchEnabled=true` + clean build
- UTF-16 corruption → re-save UTF-8; avoid PowerShell WriteAllText
- Ghost `package.json` → delete before `npm install`
- `ISSUE-RTL-01` (open): Hebrew text displaying LTR — deferred to standalone session

---

## 11. Finalized Decisions (Do Not Re-Open)

**✅ Core (ratified):**
Pre-purchase decision tool · FinGuard+הטבות combined · manual-first · Hebrew primary+Arabic RTL · Freemium ₪29/₪49 · React Native+Expo SDK 52 · TypeScript strict · MMKV+Zustand · NativeWind v4 (active M3) · Supabase Phase 4+ · offline-first · engines separated · benefits DB bundled JSON · 3 issuers only · verdict union `'approved'|'warning'|'blocked'|'wait_24h'` · DEK→keychain→biometric/PIN→memory-only · cold start LOCKED · AuthenticatedNavigator structural gate · terminal = recoverable extended lock + biometric recovery · PROD-INSTALL-01: 35%=Warning.

**✅ Multi-account + users (June 26):** max 5 profiles/device · MMKV namespace `profile_{id}:*` · single DEK · multiple users = separate AppProfile with own PIN verifier · QR profile share (local, M4) · shared account Phase 4.

**✅ Language (June 26):** auto-detect device locale · Hebrew default · LTR English = restart dialog · Settings picker: device/he/ar/en.

**✅ Loans + Mortgage (June 26):** Loan type M4 · mortgage simplified (no מסלולים) · loan refinancing alerts = Phase 5, informational only (not financial advice per חוק הייעוץ הפיננסי 2005).

**✅ Card rates + discount (June 27):**
- `card_rates.json` built by Agent 2 with rates per issuer/club — auto-fill + user editable
- Disclaimer mandatory: "בדוק מול חברת הכרטיסים. עודכן: [date]"
- Interest calculator uses שפיצר method (fixed payment, decreasing interest)
- Interest rate input validated: 0–30% (Israeli legal max)
- `CardFeeInfo.discountEndDate` triggers local push notification reminder
- Annual reminder on card anniversary if no known end date
- מט"ח account: `hasForeignCurrencyAccount=true` → use `bankFxCommission` instead of issuer FX rate
- FX card recommendation shown on DecisionScreen only when ≥2 cards with rates defined

**✅ Feature 25 — Glossary (June 27):** static informational screen · not financial advice · "כיצד זה משפיע עליי?" per term uses user's own numbers.

**✅ Feature 26 — Document parser (June 27):** deferred to Phase 5 pending sample document evaluation · if PDF is machine-readable → feasible · OCR adds Phase 6 complexity.

**✅ Feature 27 base (June 27):** discount reminder system in M4 · `expo-notifications` local only · notification 30 days + 7 days + on expiry if date known · annual anniversary reminder if date unknown.

**❌ Rejected:** budget-tracker · Open Banking · Redux/MobX/AsyncStorage/axios · full PAN storage · AI consultation before Phase 5 · unconditional wipe · OTP before Phase 4 · SMS OTP before Phase 5 · mortgage מסלולים in MVP · loan recommendations as binding advice · language picker on first launch · real-time shared account before Phase 4 · >5 profiles/device in MVP · financial advice (not compliant with חוק הייעוץ הפיננסי).

**Conflict Hierarchy:** (1) finalized decisions · (2) SEC-CONTRACT-001 · (3) this file's current state · (4) project history · (5) build plan · (6) original agent prompts.

---

## 12. Current Build Status

- **M0 — Setup + Types:** ✅ COMPLETE (`3cae95a`)
- **M1 — App Skeleton:** ✅ COMPLETE (all tasks, HIGH-01 fixed, Agent 5 approved)
- **M2 — Core Engines:** ✅ COMPLETE — 139 tests, 98.4% statements, 95.58% branches (`406531a`, `2ff1381`). Agent 5 APPROVED. Agent 1 VALIDATED (3 fixes: income-% model, חזרת חיוב formula, cashflowRadar functions).
- **M3 — UI + NativeWind:** ✅ COMPLETE — all 7 screens live on device. Agent 5 APPROVED (COND-M3-01..04 all resolved). Gate commit pending (`git commit --allow-empty`). `ISSUE-RTL-01` carried forward to standalone session.
  - Files committed: usePurchaseGate.ts · useCashflowCalendar.ts · parseAmount.ts · contact.types.ts · tailwind.config.js · global.css · shims/react-native-reanimated.js
- **M3 Polish** — ❌ not started. Scope: UI-THEME-01 · UI-DARKMODE-01 · LANG-01 · LOCK-UI-01 · INSTALL-IMPORT-01 · GLOSSARY-01 · PROFILE-01 · PROFILE-02 · MULTI-USER-01 · ONBOARD-IMPROVE-01
- **M4 — Full scope:** ❌ not started. Scope: loanEngine · LoansScreen · card_rates.json · CardDetailScreen · interestCalculator · DiscountReminder · FX recommendation · benefitsMatcher · BenefitsScreen · QR share.
- **M5 — Beta Release:** ❌ not started.
- **Phase 4 (post-Beta):** Email OTP · shared account real-time.
- **Phase 5:** Document parser · loan alerts · SMS OTP · AI.

---

## 13. Task Queue (Work in This Order)

Pick the first task not ✅ and whose blockers are clear.

### M3 GATE (immediate)
1. **M3 gate commit** — `git commit --allow-empty -m "feat: M3 complete — UI + NativeWind (COND-M3-01..04 resolved)"`. `ISSUE-RTL-01` carried forward. *Unblocks M3 polish.*

### M3 POLISH (after task #1)
2. **UI-THEME-01** — `src/hooks/useTheme.ts` (new) + all 7 screens. Done when: bank color changes on profile switch; company accent on CardsScreen; Layer 1 on LockScreen; tsc clean.
3. **UI-DARKMODE-01** — all 7 screens, NativeWind `dark:` utilities. Done when: dark mode toggle works; bg=`#141414`; brand on badges only; tsc clean.
4. **LANG-01** — `src/utils/languageService.ts` + `src/i18n/en.ts` + `src/store/keys.ts` + App.tsx + SettingsScreen. Done when: first launch sets language from device; 4-option Settings picker; English triggers restart dialog; tsc clean.
5. **GLOSSARY-01** — `src/screens/GlossaryScreen.tsx` + navigation entry in SettingsScreen. Done when: 9+ terms with Hebrew explanations; "כיצד זה משפיע עליי?" opens example with user numbers; tsc clean. *Static — no engine.*
6. **LOCK-UI-01** — `src/screens/LockScreen.tsx` redesign. Done when: biometric+PIN visible; OTP as FeatureGate `'soon'`; bank theme applied; no keyVault changes; tsc clean.
7. **INSTALL-IMPORT-01** — `src/screens/InstallmentImportScreen.tsx` + route + Settings entry. Done when: saves with `source:'imported'`; reflected in cashflowRadar; tsc clean.
8. **PROFILE-01** — `src/types/profile.types.ts` + `src/store/useProfileStore.ts` + `keys.ts`. Done when: CRUD works; MMKV namespace isolated; max 5 enforced; jest tests; tsc clean.
9. **PROFILE-02** — `src/components/ProfileSwitcher.tsx` + SettingsScreen + HomeScreen. Done when: switch profile updates all data; add profile → onboarding; tsc clean.
10. **MULTI-USER-01** — `keyVault.ts` (per-profile PIN verifier) + LockScreen (profile selector). Done when: each profile has independent PIN; selector shown when >1 profile; tsc clean.
11. **ONBOARD-IMPROVE-01** — `OnboardingScreen.tsx`. Done when: top 4 banks + expandable full 12-bank list; tsc clean.
12. **M3 polish close** — `npx tsc --noEmit` + device test all screens + Agent 5 M3 polish gate + `git commit -m "feat: M3 polish complete"`.

### M4 (after task #12)
13. **LOAN-TYPES-01** — `src/types/loan.types.ts`. Done when: LoanType, Loan, LoanSummary, LoanImpact, LoanDecision all defined; tsc clean.
14. **LOAN-ENGINE-01** — `src/engines/loanEngine.ts` + `__tests__/loanEngine.test.ts`. Done when: calculateLoanSummary + calculateLoanImpact; 10+ jest cases (mortgage type, zero balance, 360 months, zero income, rentalIncome offset); jest 100%; tsc clean; zero RN imports.
15. **LOAN-UI-01** — `src/screens/LoansScreen.tsx` + `src/store/useLoansStore.ts`. Done when: personal+mortgage tabs; CRUD; feeds cashflowRadar; monetary input validated; tsc clean.
16. **CARD-RATES-TYPES-01** — extend `src/types/card.types.ts` with `CardRates`, `CardFeeInfo`. Add `hasForeignCurrencyAccount`, `bankFxCommission`, `cardIssuanceDate` to CardInput. Add `src/types/interest.types.ts`. Done when: all new types defined; tsc clean.
17. **FX-CARD-01** — extend `cardRoleEngine.ts` logic for `hasForeignCurrencyAccount` + `bankFxCommission`. Done when: מט"ח card with matching currency → commission 0 → ranked first; different currency → bankFxCommission used; existing tests still pass; new FX cases added; jest 100%.
18. **CARD-DETAIL-01** — `src/screens/CardDetailScreen.tsx` (Feature 22). Done when: all CardRates fields displayed + editable; disclaimer shown with lastUpdated; CardFeeInfo section visible; link to InterestCalc; tsc clean.
19. **CARD-RATES-DB-01** — `src/data/card_rates.json` *(Agent 2 task — research Max/Isracard/CAL rates per club)*. Done when: JSON covers main clubs for all 3 issuers; rates + fees + FX commissions included; `lastUpdated` timestamp present.
20. **DISCOUNT-REMINDER-01** — `CardDetailScreen.tsx` (discount fields) + `src/utils/discountReminder.ts` (notification scheduler). Done when: discount fields in CardDetail; `expo-notifications` schedules 30d+7d+expiry notifications; annual anniversary fallback; manual entry UI works; tsc clean.
21. **INTEREST-ENGINE-01** — `src/engines/interestCalculator.ts` + `__tests__/interestCalculator.test.ts`. Done when: calculateInstallmentInterest + calculateCardLoan (שפיצר); 10+ jest cases (0%, max 30%, 1 month, 360 months, zero amount → blocked); jest 100%; tsc clean; zero RN imports.
22. **INTEREST-CALC-UI-01** — `src/screens/InterestCalculatorScreen.tsx` (Features 24+24.2). Done when: two tabs; card selector pre-fills rates; amortization table displayed; disclaimer shown; tsc clean.
23. **DATA-01** — `src/data/max_benefits.json` *(Agent 2 — research Max clubs)*.
24. **DATA-02** — `src/data/isracard_benefits.json` *(Agent 2)*.
25. **DATA-03** — `src/data/cal_benefits.json` *(Agent 2)*.
26. **ENGINE-05** — `src/engines/benefitsMatcher.ts` + tests. Done when: findBestCard + calculateMissedSavings; jest 100%; zero network; tsc clean.
27. **BENEFITS-UI-01** — BenefitsScreen + SavingsTracker (FeatureGate → `'live'`). Done when: renders with real benefitsDB; tsc clean.
28. **QR-SHARE-01** — `src/screens/ProfileShareScreen.tsx`. Done when: QR encodes encrypted profile; scan imports profile; no cloud; tsc clean.
29. **M4 close** — `npx jest --coverage` (target 90%+) + `npx tsc --noEmit` + Agent 5 M4 gate + Agent 1 financial validation + `git commit -m "feat: M4 complete"`.

### M5 (after task #29)
30. **EAS-01** — EAS build config + keystore. Done when: `eas build --platform android` succeeds.
31. **PAYWALL-01** — paywall screen + RevenueCat (Free/Plus/Pro). Done when: FeatureGate reads subscription status; tsc clean.
32. **LEGAL-01** — Privacy Policy HTML *(Agent 6 writes content → hosted GitHub Pages)*. Done when: URL live; linked in Play Console.
33. **STORE-01** — Play Store submission + Data Safety form. Done when: APK uploaded; Hebrew listing; Data Safety complete.

### Phase 4 (post-Beta — do NOT implement before M5 ships)
- **AUTH-OTP-01** — Email OTP via Supabase Auth
- **SHARED-01** — חשבון משותף real-time sync

### Phase 5
- **DOCUMENT-PARSER-01** — PDF card document analysis (Feature 26) — pending sample document evaluation
- **DISCOUNT-AUTO-01** — auto-extract discount info from document (Feature 27 + 26)
- **LOAN-ADVISOR-01** — high-interest loan alerts (informational only — never financial advice)
- **SMS-OTP-01** — SMS OTP via provider
- **AI-CONSULT-01** — AI consultation

---

## 14. Definition of Done

All of these must hold before any task is marked complete:
- `npx tsc --noEmit` → zero errors.
- `npx jest` → 100% for every engine touched (10+ cases each).
- No `fetch()`/`axios` in `/src/engines/`.
- No `console.*` with balance/income/cardNumber/userId/keys/salt/PIN/cardRates values.
- No financial screen outside `AuthenticatedNavigator`.
- Monetary inputs: ₪0.01–₪999,999. Interest: 0–30%. Loan months: 1–360. Discount: 0–100%.
- No `any`, no unguarded `!`, all params/returns typed.
- No hardcoded keys; MMKV encryptionKey from keyVault at runtime.
- New persistent data → MMKV key constant in `keys.ts`.
- Profile keys use `profile_{id}:` prefix — built only in useProfileStore.
- CardRates disclaimer shown wherever rates are displayed.
- No TODO in shipped logic. No security violation from §9.

**Codex must NOT:** open PRs with TODOs or `any` · violate §9 · make product decisions · upgrade Expo SDK · implement Phase 4/5 work early · implement unconditional data wipe · calculate mortgage מסלולים · give financial advice in loan/interest UI text.

*End of AGENTS.md — start each session at §13.*
