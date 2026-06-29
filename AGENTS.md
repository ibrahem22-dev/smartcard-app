# SmartCard — AGENTS.md
### Codex Build Instructions | Replaces Agents 1, 3, 4, 5, 7, 9
### Last updated: June 29, 2026 — M3 ✅ complete · Features A1–F1 + 22–29 · RTL/LTR Strategy ratified · Tiers finalized · MULTI-USER-01 Option B · Marketing & GTM Agent10 added

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
  /store      Zustand + MMKV. keys.ts = ALL key constants. Includes useProfileStore (M3 ✅),
              useThemeStore (M3 ✅), useLoansStore (M4), useCardRatesStore (M4).
  /screens    UI only. Calls hooks, never engines directly.
  /components  FeatureGate.tsx ✅, ProfileSwitcher.tsx (M3 ✅), GlossaryScreen components ✅.
  /hooks      usePurchaseGate.ts ✅, useCashflowCalendar.ts ✅, useFeatureFlag.ts ✅,
              useTheme.ts (M3 ✅), useLanguage.ts (M3 ✅).
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
- **Max profiles per tier:** Free = 1, Plus = 3, Pro = 5 (ratified June 29 — tier-based, not flat limit).
- `useThemeStore` owns ThemePreference (`'system' | 'light' | 'dark' | 'bank'`) in MMKV key `app:theme_preference`.
- `/src/data/categories.json` — static category DB (Agent 2 task DATA-CATEGORIES-01).
- `/src/data/merchants.json` — confirmed merchant discount DB Tier 1 (Agent 2 task DATA-MERCHANTS-01).
- `/src/security/migrations/` — DEK migration scripts. `2026-06-M5-profiles.ts` handles keySchemeVersion 1→2 for per-profile DEK.

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
  userProfile: UserProfile, isInternational: boolean,
  mode?: PaymentMode): CardRecommendation
// mode='credit_installment' → rank by cardRates.installmentInterestRate ASC (lowest rate first).
//   If no card has installmentInterestRate defined → fallback to standard ranking + show advisory.
// mode='regular' or undefined → existing standard ranking logic.
// isInternational=true → rank by foreignExchangeCommission (lowest first) — overrides mode.
// If card has hasForeignCurrencyAccount=true AND currency matches → commission = 0, rank first.
// Feature 23 is an extension of this function, not a separate engine.
// Feature 28 (CREDIT-INSTALL-01) adds mode parameter — extend, do NOT rewrite.
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

**Updated `purchase.types.ts` (M4 — CREDIT-INSTALL-01):** add `PaymentMode = 'regular' | 'credit_installment'`

**New `wallet.types.ts` (M4 — PAY-NOW-01):** `WalletStatus = 'added' | 'not_added' | 'unknown'`; MMKV key: `card:wallet_status:{cardId}`

**Updated `card.types.ts` (M4 — CARD-NICKNAME-01):** add to CardInput:
```ts
nickname?: string              // כינוי — user-defined label (always optional)
last4?: string                 // last 4 digits (optional, not required)
// Display priority: nickname → nickname + "••••" + last4 → issuer + club name
```

**New `merchant.types.ts` (M4 — MERCHANT-CONTRIB-01):**
```ts
type MerchantBenefit = {
  merchantName: string
  cardIssuer: 'Max' | 'Isracard' | 'CAL'
  club: string
  benefitType: 'discount' | 'cashback' | 'points'
  value: number                // percent or points multiplier
  conditions?: string          // e.g., "בקנייה מעל ₪200"
  validFrom?: string           // ISO date — seasonal benefits
  validUntil?: string          // ISO date
  tier: 'official' | 'community_verified' | 'community_pending'
  confirmations?: number       // community confirmation count
  lastUpdated: string          // ISO date
}

type BenefitSubmission = {
  merchantName: string
  cardIssuer: 'Max' | 'Isracard' | 'CAL'
  club: string
  benefitType: 'discount' | 'cashback' | 'points'
  value: number
  conditions?: string
  sourceUrl?: string
  submittedBy: string          // user ID (internal only)
  status: 'pending' | 'community_verified' | 'official_verified' | 'rejected'
  confirmations: number
  submittedAt: string
}
```

**⚠️ VERDICT UNION:** `'approved' | 'warning' | 'blocked' | 'wait_24h'` — canonical. Legacy `'approve'|'warn'|'block'` BANNED.

---

## 8. Screen & Component Rules

**Core rules:** offline-first · RTL-aware · NativeWind active (M3 ✅) · screen→hook→engine · ₪ currency with `Intl.NumberFormat('he-IL')`.

**Verdict colors:** approved `#16A34A` · warning `#D97706` · blocked `#DC2626` · wait_24h `#2563EB`.
**Calendar risk:** safe `#DCFCE7` · tight `#FEF9C3` · danger `#FEE2E2`.
**Glossary accent:** `#1D4ED8` (informational blue).

---

### RTL/LTR Strategy — SmartCard Manual Dynamic RTL/LTR (ratified June 28, 2026)

**Architecture:** SmartCard does NOT use native `I18nManager.forceRTL()` for runtime switching. Direction is determined at render time from the store.

| Item | Value |
|---|---|
| Source of truth | `useLanguageStore.resolvedLanguage` |
| Direction hook | `useAppDirection()` → `{ isRTL: boolean, dir: 'rtl' \| 'ltr' }` |
| Switch behavior | Instant — no reload, no restart, no dialog |
| Hebrew mode | RTL immediately |
| English mode | LTR immediately |

**Required RTL-aware primitives (create once, use everywhere):**
```tsx
// src/components/RtlRow.tsx — row direction only
<RtlRow>   // flexDirection: isRTL ? 'row-reverse' : 'row'

// src/components/AppText.tsx — text alignment only
<AppText>  // textAlign: isRTL ? 'right' : 'left'
           // writingDirection: isRTL ? 'rtl' : 'ltr'

// src/hooks/useAppDirection.ts
const { isRTL } = useAppDirection()
```

**Root cause of previous RTL bug:** double RTL flip — using BOTH `direction: 'rtl'` on a container AND `flexDirection: 'row-reverse'` on its children. In React Native's Yoga layout engine, `direction: 'rtl'` already flips row direction. Adding `row-reverse` on top cancels it. Result: Hebrew screens looked LTR even though all state flags said RTL.

**Mandatory rule: use exactly ONE layout mechanism per axis.**
- Row direction → `<RtlRow>` only.
- Text direction → `<AppText>` only.
- NO `direction: 'rtl'` on root, screen, scroll, or generic view containers. Ever.

**Forbidden patterns (banned unless documented `rtl-ok` comment present):**
```tsx
style={{ direction: 'rtl' }}                          // BANNED on containers
style={{ flexDirection: 'row-reverse', direction: 'rtl' }} // DOUBLE-FLIP — BANNED
className="flex-row-reverse"                          // use <RtlRow> instead
className="text-left"  className="text-right"         // use <AppText> instead
className="items-start"  className="items-end"        // use dir-aware primitives
className="ml-*"  className="mr-*"                    // use ms-*/me-* or dir-aware
className="pl-*"  className="pr-*"                    // same
```

**Dependency rules (enforced):**
```
screens / components / navigation
  → hooks
    → store
    → pure utils / types

BANNED: store → hooks · utils → store · utils → hooks
```

**Runtime rules — NEVER call on language switch:**
`I18nManager.forceRTL()` · `DevSettings.reload()` · `Updates.reloadAsync()` · `RNRestart.Restart()`

**Verification checklist after any UI change:**

| Check | Hebrew | English |
|---|---|---|
| Text alignment | right ✓ | left ✓ |
| Row flow | right-to-left ✓ | left-to-right ✓ |
| Reload required | NO ✓ | NO ✓ |

Screens to verify: Home · Cards · Purchase Gate · Calendar · Settings · Glossary · Bottom tabs.

---

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

**Purchase Gate Credit Installment Mode (CREDIT-INSTALL-01 — M4, Feature 28):**
Extension to `PurchaseGateScreen` and `cardRoleEngine.ts`:
- Transaction type selector in PurchaseGate (below amount input):
  `○ תשלומים רגילים` (default) | `○ תשלומים קרדיט`
- When `credit_installment` selected: `recommendCard()` called with `mode: 'credit_installment'`
  → ranks cards by `cardRates.installmentInterestRate` ASC (lowest interest = best)
- Result shows: recommended card name + rate + "חוסך לך X% ריבית לעומת כרטיס Y"
- If no `cardRates.installmentInterestRate` on any card: advisory "הוסף ריבית תשלומים לכרטיסיך לקבלת המלצה" (no block)
- `PaymentMode = 'regular' | 'credit_installment'` added to `purchase.types.ts`
- CardRates prerequisite: CARD-RATES-TYPES-01 must be done first.

**"לשלם עכשיו" — Wallet Launch (PAY-NOW-01 — M4, Feature 29):**
Button on DecisionScreen after card recommendation is shown:
- Button: `"לשלם עכשיו 📲"` (visible only when a card is recommended AND user has cards)
- On tap: show bottom sheet confirmation: `"פותח את [Google Wallet / Apple Wallet] — בחר את כרטיס [cardName] לתשלום קרוב"`
- Android launch: `Linking.openURL('googlepay://')` fallback `Linking.openURL('https://pay.google.com')`
- iOS launch: `Linking.openURL('shoebox://')` fallback `Linking.openURL('https://wallet.apple.com')`
- Wallet opens to HOME — user selects card manually (platform restriction — cannot pre-select card)
- Wallet presence tracking (MMKV `card:wallet_status:{cardId}` = `'added' | 'not_added' | 'unknown'`):
  - `'unknown'` (first tap for this card): dialog "הוסיפת כרטיס זה ל-Wallet?" → Yes → `'added'` / No → `'not_added'`
  - `'not_added'`: advisory "כרטיס זה לא נמצא ב-Wallet. רצונך להוסיפו?" → open Wallet
  - `'added'`: open Wallet directly with reminder message
- HARD LIMIT: cannot programmatically pre-select a specific card in any Wallet app (iOS + Android API restriction). UI must state this clearly in the bottom sheet.
- FeatureGate: `'live'` — built fully in M4. Not a 'soon' feature.

**Interest Calculator Screen (INTEREST-CALC-UI-01 — M4, Features 24 + 24.2):**
Two tabs: "ריבית תשלומים" + "הלוואה מהכרטיס"
Inputs: amount, months, interest rate (pre-filled from active card's CardRates)
Output: total interest, monthly payment, total cost, full amortization table (שפיצר)
Card selector: if user has multiple cards, shows rates per card for comparison
Disclaimer: "לצורך הדגמה בלבד — לא ייעוץ פיננסי"

**Dark Mode (UI-DARKMODE-01 ✅ M3 done):** bg `#141414` · surfaces `#1E1E1E` · brand on badges/cards only · NativeWind `dark:` utilities. `tailwind.config.js` uses `darkMode: 'class'` (not `'media'`) so `useThemeStore` controls the active class on root.

**Dark Mode User Preference (DARKMODE-PREF-01 — M3 polish, pending):**
`useThemeStore` exposes `ThemePreference: 'system' | 'light' | 'dark' | 'bank'`. Default = `'system'`.
Logic in App.tsx:
```ts
const systemScheme = useColorScheme()
const { themePreference } = useThemeStore()
const { subscriptionTier } = useSubscriptionStore()   // 'free' | 'plus' | 'pro'

const isBankThemeAllowed = subscriptionTier === 'plus' || subscriptionTier === 'pro'

const activeTheme =
  themePreference === 'bank' && isBankThemeAllowed ? 'bank' :
  themePreference === 'bank' && !isBankThemeAllowed ? systemScheme ?? 'light' :
  themePreference === 'system' ? systemScheme :
  themePreference === 'light'  ? 'light' : 'dark'
```
SettingsScreen picker: **4 options** —
- `תלוי מכשיר (אוטומטי)` (default)
- `בהיר`
- `כהה`
- `מראה הבנק 👑` — FeatureGate `'pro_only'` for Free users (grayed + "Plus/Pro בלבד" badge)

Free users with 'bank' selected: bank accent visible on cards/badges ONLY (Layer 2+3) — NOT as full background.
MMKV key: `app:theme_preference`. On first install: `'system'` default.

**Cross-Platform iOS/Android Rules (apply from M3 polish onwards):**

| Rule | Requirement |
|---|---|
| Safe Area | Every screen root = `<SafeAreaView>` or `useSafeAreaInsets()`. Never hardcode top padding. |
| Face ID | `app.json` → `infoPlist.NSFaceIDUsageDescription` = `"לזיהוי ביומטרי מאובטח"`. Expo managed handles this. |
| Notifications (iOS) | Call `Notifications.requestPermissionsAsync()` before scheduling ANY notification. Android = automatic. |
| Back navigation | Never hardcode Android back button logic. Use React Navigation's built-in behavior only. |
| Platform checks | `Platform.OS` allowed ONLY for visual differences (shadow, keyboard). NEVER for business logic. |
| Fonts | Do not hardcode font family — use `System` default (SF Pro on iOS, Roboto on Android). |
| Shadow | Use NativeWind `shadow-*` classes — NativeWind maps to `elevation` (Android) and `shadow*` (iOS). |
| Keyboard | Use `KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`. |
| Biometric | `expo-local-authentication` works on both. Face ID on iPhone = same API as fingerprint. |
| Expo build | iOS builds require EAS (`eas build --platform ios`) — `npx expo run:ios` needs macOS/Xcode. Planned: M5 EAS-01. |

**OPEN: ISSUE-RTL-01** — Hebrew text displaying LTR — fix before any iOS TestFlight build. RTL behavior can differ between platforms; resolving on Android first resolves both.

**3-Layer Bank Theming (UI-THEME-01 ✅ M3 done):**
Layer 1: bank bg (לאומי=blue, הפועלים=red, דיסקונט=purple, מזרחי=orange, אחר=neutral)
Layer 2: company accent (Max=`#FF6B00`, Isracard=`#0057B7`, CAL=`#6B21A8`)
Layer 3: club badge chip on card components

**Onboarding (ONBOARD-IMPROVE-01 — M3 polish ✅ + updated June 29):**
- top 4 banks + expandable 12-bank list ✅ (done)
- **Updated minimum for registration:** bank selection + income ONLY — app opens immediately after these two.
- All other onboarding questions (cards, הוראות קבע, etc.) → appear as contextual CTAs inside the app post-login.
- Progress bar visible from Home showing setup completion %.
- "הוסף עכשיו" / "מאוחר יותר" buttons on each contextual CTA.

**Registration & Auth Flow (AUTH-REGISTER-01 — M5):**
Full registration screen sequence (replaces anonymous local-only flow from M3):
```
Step 1: Name + Email + Phone (phone optional at reg, required for SMS OTP upgrade)
Step 2: Email OTP verification (6-digit code, 10-min expiry)
Step 3: PIN setup (6-digit)
Step 4: Biometric prompt (optional — "הפעל זיהוי ביומטרי?")
→ App opens
```
- "המשך ללא חשבון" button on Step 1 → local-only mode (no cloud, no recovery)
- Account recovery via Email OTP → PIN reset only. Financial data stays local until Cloud Sync (Phase 4).
- SMS OTP: Plus + Pro only (shown as FeatureGate 'pro_only' for Free users in Settings).
- Implementation: Supabase Auth (Email OTP provider). Phase 4+ for full cloud sync.

**Card Nickname & Last 4 Digits (CARD-NICKNAME-01 — M4):**
- `nickname?: string` — always available to all tiers, always optional.
- Auto-suggest options on first add: "כרטיס המזומן" / "כרטיס הקניות" / "כרטיס הצבור".
- `last4?: string` — optional 4-digit string, not validated as real card number.
- Display priority on all cards/screens:
  1. `nickname` only (if no last4)
  2. `"[nickname] ••••[last4]"` (if both)
  3. `"כרטיס [issuer] [club]"` (if neither)
- Optional card color picker: 6 preset colors stored in `card:color:{cardId}` MMKV key.
- Files: extend `card.types.ts` (nickname, last4, color), update `CardsScreen.tsx` + `CardDetailScreen.tsx`.

**Club Not Found / אחר (CLUB-OTHER-01 — M4):**
Three-layer handling when user's club is not in the list:
- **Layer 1 — Immediate fallback:** "אחר +" option in club picker. User types club name freely.
  Recommendations: generic Visa/Mastercard/Amex logic with advisory "הוסף מועדון ספציפי לקבלת המלצות מדויקות".
- **Layer 2 — Request form:** "לא מצאת את המועדון שלך?" → form: club name + card name + optional URL.
  Goes to admin queue (Supabase table `club_requests`).
- **Layer 3 — Auto-threshold:** 10 unique users request same club → Agent 2 researches → Ibrahim reviews → all requesters notified "המועדון שלך נוסף! 🎉".
- **Fuzzy search:** club picker uses fuzzy match — "מקס" → "Max", "ויזה כאל" → "CAL Visa".
- MMKV key for custom club name: `card:custom_club:{cardId}`.

**Cloud Sync (CLOUD-SYNC-01 — M4/Phase 4):**
- Backend: Supabase (Phase 4+). Available to Plus + Pro tiers only.
- Sync scope: cards list, user profile, installments, הוראות קבע, loans. Does NOT sync DEK, PIN, or raw balance.
- Prerequisite for SHARED-01 (חשבון משותף) — CLOUD-SYNC-01 must be complete before SHARED-01 starts.
- UI: Settings → "גיבוי ענן" — toggle on/off + last sync timestamp.
- On first enable: full local→cloud push. On subsequent launches: delta sync.
- FeatureGate 'pro_only' for Free users.

**Merchant Contribution (MERCHANT-CONTRIB-01 — M5):**
Community-driven merchant discount database. Three-stage validation pipeline:

Stage 1 — Instant algorithmic filter:
- Submitter is Plus/Pro user? (rejects anonymous spam)
- Card exists in DB?
- Benefit value is plausible (0–50%)?
- Fails any check → rejected immediately with feedback.

Stage 2 — Community confirmation:
- 3 independent Plus/Pro users with same card confirm → status = `'community_verified'`
- Only Plus/Pro users can confirm others' submissions.

Stage 3 — Ibrahim manual review:
- Weekly digest email → approve/reject → status = `'official_verified'`

Contributor gamification:
- 1st verified submission → "SmartCard Contributor" badge (stored in `user:badges` MMKV key)
- 5 verified submissions → 1 month Plus free (via RevenueCat promotional entitlement)
- 10 verified submissions → "Top Contributor" badge + 2 months Plus free

Submission UI: "חסר מידע?" button on BenefitsScreen/DecisionScreen.
Form fields: merchant name (searchable) · card/club · benefit type · value · conditions (optional) · source URL (optional).
After submit: "תודה! נבדוק ונעדכן תוך 7 ימים" toast.

Display in app:
- `tier: 'official'` → ✅ מאומת (green)
- `tier: 'community_verified'` (3–4 confirmations) → ⭐⭐ מדווח
- `tier: 'community_verified'` (5+ confirmations) → ⭐⭐⭐ מאומת מקהילה
- `tier: 'community_pending'` → ⏳ בבדיקה

Seasonal benefits: `validFrom` + `validUntil` stored per entry. App shows "בתוקף עד [date]" badge.
Supabase tables needed: `benefit_submissions`, `merchant_confirmations`, `contributor_stats`.

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

**✅ Feature 25 — Glossary (June 27):** static informational screen ✅ BUILT · not financial advice · 9 terms with "כיצד זה משפיע עליי?" per term.

**✅ Dark mode preference (June 27):** `darkMode: 'class'` in tailwind.config · `useThemeStore` with `ThemePreference: 'system'|'light'|'dark'` · Settings 3-option picker (DARKMODE-PREF-01 — pending) · default = `'system'` auto-follows device.

**✅ Max profiles = 3 (June 27):** Reduced from 5 to 3 during M3 polish implementation. Simpler UX, sufficient for Israeli family/couple use case.

**⚠️ MULTI-USER-01 deferred (June 27):** Per-profile PIN requires separate PIN envelope per profile — conflicts with single DEK architecture. Needs Agent 6 architecture decision before Codex can implement. Not a bug — a product/security design decision.

**✅ iOS compatibility (June 27):** SafeAreaView mandatory on all screens · `NSFaceIDUsageDescription` in app.json · expo-notifications requires `requestPermissionsAsync()` on iOS · EAS Build required for iOS testing (planned M5) · no platform-specific engine logic · ISSUE-RTL-01 must be resolved before iOS TestFlight.

**✅ RTL/LTR Strategy (June 28):** Manual Dynamic RTL/LTR — no `I18nManager.forceRTL()` at runtime · source of truth = `useLanguageStore.resolvedLanguage` · `useAppDirection()` hook · `<RtlRow>` + `<AppText>` primitives · instant switch no reload · `direction: 'rtl'` on containers BANNED · double-RTL-flip BANNED (was root cause of ISSUE-RTL-01).

**✅ Feature 28 — CREDIT-INSTALL-01 (June 28):** תשלומים קרדיט mode in PurchaseGate · extends `recommendCard()` with `mode?: PaymentMode` · ranks by `installmentInterestRate` ASC · M4 task after FX-RECOMMEND-01.

**✅ Feature 29 — PAY-NOW-01 (June 28):** "לשלם עכשיו" button on DecisionScreen · opens Google Wallet (Android) or Apple Wallet (iOS) via `Linking.openURL` · cannot pre-select specific card (platform API restriction) · MMKV `card:wallet_status:{cardId}` tracks presence · M4 task.

**✅ Dark Mode 4-option picker (June 29):** ThemePreference = `'system' | 'light' | 'dark' | 'bank'` · Bank Theme = Plus + Pro exclusive (FeatureGate 'pro_only' for Free) · Free users see bank accent on badges/cards only (Layer 2+3, not full bg) · default = `'system'` · Settings picker shows 4 rows · DARKMODE-PREF-01 task updated.

**✅ Subscription tiers final table (June 29):**
- Free: 5 checks/month, 2 cards, 1 profile, Email OTP only.
- Plus ₪29/month: unlimited checks, 5 cards, 3 profiles, SMS OTP, Cloud Backup, Bank Theme, Benefits, QR Share, Per-Profile PIN, Interest Calculator, Discount Reminders.
- Pro ₪49/month: everything in Plus + 5 profiles, חשבון משותף, Document Parser (Phase 5), Data Export, Priority Support.

**✅ MULTI-USER-01 Architecture — Option B per-profile DEK (June 29):**
Each profile gets independent DEK + PIN verifier:
- MMKV keys: `profile_{id}:dek` + `profile_{id}:pin_verifier` per profile.
- `keySchemeVersion` 1 → 2 migration on upgrade.
- `profiles.json` registry (encrypted, in secure store).
- Re-auth required on EVERY profile switch — no grace period.
- DEK zeroed in memory before loading next profile's DEK.
- Migration file: `src/security/migrations/2026-06-M5-profiles.ts`.
- Per-profile biometric: deferred to Phase 4.
- MULTI-USER-01 task is now UNBLOCKED — Codex can implement.

**✅ Cloud Sync prerequisite (June 29):** CLOUD-SYNC-01 must be completed before SHARED-01 can start. Cloud Sync = Plus + Pro. חשבון משותף = Pro only.

**✅ Card Nickname + optional last 4 (June 29):** כינוי always available to all tiers, always optional. Last 4 optional. Display priority: nickname → nickname+last4 → issuer+club. Auto-suggest on first add. Color picker optional.

**✅ Club "אחר" + Request Club (June 29):** 3-layer: immediate "אחר" fallback with generic recommendations → Request form → auto-threshold at 10 unique requests triggers Agent 2 research. Fuzzy search on club picker.

**✅ MERCHANT-CONTRIB-01 community pipeline (June 29):** 3-stage: algorithmic filter → community confirmation (3 Plus/Pro) → Ibrahim weekly review. Gamification: badge + free Plus months. Seasonal benefit dates. Supabase-backed.

**✅ Progressive onboarding minimum (June 29):** Minimum mandatory at registration = bank + income ONLY. App opens immediately. All other data collected via contextual CTAs post-login with progress bar.

**✅ AUTH-REGISTER-01 (June 29):** Name+Email+Phone → Email OTP → PIN → Biometric → App. "המשך ללא חשבון" for local-only mode. SMS OTP = Plus+Pro. Account recovery via Email OTP (PIN reset only). Supabase Auth. M5 task.

**✅ Promo codes — PROMO-CODE-01 (June 29):**
- `SMARTCARD-TEAM`: Plus 6 months free, max 150 uses, for work colleagues.
- `SMARTCARD-IL`: Plus 1 month free, max 500 uses, for LinkedIn audience.
- Implementation: RevenueCat Promotional Entitlements (Ibrahim creates in RevenueCat dashboard).
- M5 task.

**✅ Tier feature placement (June 29):** QR-SHARE-01 → Plus only · MULTI-USER-01 (multi-profile) → Plus (3 profiles) / Pro (5 profiles) · חשבון משותף → Pro only · CLOUD-SYNC-01 → Plus + Pro · Bank Theme → Plus + Pro · SMS OTP → Plus + Pro · Contributor gamification (free months) → any tier can submit, Plus/Pro can confirm.

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
- **M3 Polish** — 🟡 95% complete (June 27 extended session):
  ✅ ONBOARD-IMPROVE-01 · LANG-01 · GLOSSARY-01 · LOCK-UI-01 · UI-THEME-01 (hook + visual)
  ✅ PROFILE-01 · PROFILE-02 · UI-DARKMODE-01 · INSTALL-IMPORT-01
  ⏳ DARKMODE-PREF-01 — 3-option picker (system/light/dark) — pending
  ✅ MULTI-USER-01 — architecture decision: Option B (per-profile DEK). Codex task now UNBLOCKED.
  ⏳ M3 polish close commit — pending Blocks 13-15 completion
- **M4 — Full scope:** ❌ not started. Scope: loanEngine · LoansScreen · card_rates.json · CardDetailScreen · interestCalculator · DiscountReminder · FX recommendation · benefitsMatcher · BenefitsScreen · QR share.
- **M5 — Beta Release:** ❌ not started.
- **Phase 4 (post-Beta):** Email OTP · shared account real-time.
- **Phase 5:** Document parser · loan alerts · SMS OTP · AI.

---

## 13. Task Queue (Work in This Order)

Pick the first task not ✅ and whose blockers are clear.

### M3 GATE
1. ✅ **M3 gate commit** — done (`git commit --allow-empty`). ISSUE-RTL-01 carried forward.

### M3 POLISH (June 27 extended session)
2. ✅ **ONBOARD-IMPROVE-01** — top 4 + expandable 12-bank list. Done.
3. ✅ **LANG-01** — expo-localization + language picker + en.ts + MMKV key. Done.
4. ✅ **GLOSSARY-01** — 9 terms + "כיצד זה משפיע עליי?" + Settings entry. Done.
5. ✅ **LOCK-UI-01** — biometric + PIN + OTP FeatureGate 'soon'. Done.
6. ✅ **UI-THEME-01** — `useTheme` hook (3 layers) + visual applied to all 7 screens. Done.
7. ✅ **PROFILE-01** — `profile.types.ts` + `useProfileStore` + max 3 enforced + MMKV isolation. Done.
8. ✅ **PROFILE-02** — `ProfileSwitcher` + SettingsScreen + HomeScreen avatar strip. Done.
9. ✅ **UI-DARKMODE-01** — `#141414` bg + `#1E1E1E` surfaces + NativeWind `dark:` + `darkMode:'class'` in tailwind.config. Done.
10. ✅ **INSTALL-IMPORT-01** — `InstallmentImportScreen` + CRUD + cashflowRadar integration. Done.
11. **MULTI-USER-01** ← NOW UNBLOCKED — Architecture = Option B (per-profile DEK). See §11 for full spec.
    Files: `src/security/keyVault.ts` (per-profile DEK functions), `src/security/migrations/2026-06-M5-profiles.ts` (new), `src/screens/LockScreen.tsx` (profile selector cards), `src/store/useProfileStore.ts` (extend).
    Done when: each profile has own DEK + pin_verifier; switching profiles requires full re-auth; DEK zeroed before next load; migration runs on upgrade; tsc clean.
12. **DARKMODE-PREF-01** ← UPDATED — `useThemeStore` + ThemePreference **4-option** picker in SettingsScreen.
    Files: `src/store/useThemeStore.ts` (extend), `src/store/keys.ts` (add `app:theme_preference`), App.tsx (combine `useColorScheme` + stored pref + tier check), `src/screens/SettingsScreen.tsx` (4-option picker with FeatureGate on 'bank').
    Done when: picker shows 4 options; Bank Theme option shows FeatureGate 'pro_only' for Free users; Plus/Pro see full bank bg; `'system'` default; toggling works without restart; tsc clean.
13. **M3 polish close** — `npx tsc --noEmit` + device test + Agent 5 gate (submit pinVerifier + useProfileStore + LockScreen + useTheme) + `git commit -m "feat: M3 polish complete"`. *Unblocks M4.*

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
26. **CREDIT-INSTALL-01** — extend `src/engines/cardRoleEngine.ts` + `src/types/purchase.types.ts` + `src/screens/PurchaseGateScreen.tsx`. Done when: `PaymentMode` type added; `recommendCard()` accepts `mode?: PaymentMode`; `credit_installment` mode ranks by `installmentInterestRate` ASC; PurchaseGate shows 2-option selector; result displays rate comparison; existing tests pass + 4+ new credit-installment cases; tsc clean.
27. **PAY-NOW-01** — `src/screens/DecisionScreen.tsx` + `src/types/wallet.types.ts` + `src/store/keys.ts`. Done when: "לשלם עכשיו" button visible on DecisionScreen after recommendation; bottom sheet shows card name + wallet name; `Linking.openURL` opens correct Wallet per platform; MMKV `card:wallet_status:{cardId}` tracks presence; first-tap dialog asks user to confirm wallet status; tsc clean.
28. **ENGINE-05** — `src/engines/benefitsMatcher.ts` + tests. Done when: findBestCard + calculateMissedSavings; jest 100%; zero network; tsc clean.
29. **BENEFITS-UI-01** — BenefitsScreen + SavingsTracker (FeatureGate → `'live'`). Done when: renders with real benefitsDB; tsc clean.
30. **QR-SHARE-01** — `src/screens/ProfileShareScreen.tsx`. FeatureGate = Plus tier only. Done when: QR encodes encrypted profile; scan imports profile; no cloud; Free users see FeatureGate 'pro_only' wall; tsc clean.
30a. **CARD-NICKNAME-01** — extend `src/types/card.types.ts` (nickname, last4, color) + `src/screens/CardDetailScreen.tsx` (nickname + last4 input) + `src/screens/CardsScreen.tsx` (display logic). Done when: nickname saves/displays per priority logic; last4 optional; color picker saves to MMKV; tsc clean.
30b. **CLOUD-SYNC-01** — `src/services/cloudSync.ts` (new) + `src/screens/SettingsScreen.tsx` (Cloud Sync toggle). FeatureGate = Plus + Pro. Done when: Plus/Pro can enable sync; Free sees FeatureGate wall; last sync timestamp shows; tsc clean. *Prerequisite for SHARED-01.*
30c. **DATA-CATEGORIES-01** *(Agent 2 task)* — `src/data/categories.json`. Categories: grocery/clothing/fuel/pharmacy/restaurants/electricity/online/travel. Each entry: id, nameHe, nameAr, icon (emoji). Done when: JSON covers 8+ categories with Hebrew + Arabic labels.
30d. **DATA-MERCHANTS-01** *(Agent 2 task)* — `src/data/merchants.json`. Research official Max, Isracard, CAL websites for confirmed merchant discounts. Add ONLY confirmed entries with source URL. Each entry: merchantName, cardIssuer, club, benefitType, value, conditions?, validFrom?, validUntil?, tier='official', lastUpdated. Done when: covers top 20+ merchants across all 3 issuers; all have official source.
31. **M4 close** — `npx jest --coverage` (target 90%+) + `npx tsc --noEmit` + Agent 5 M4 gate + Agent 1 financial validation + `git commit -m "feat: M4 complete"`.

### M5 (after task #31)
32. **EAS-01** — EAS build config + keystore. Done when: `eas build --platform android` succeeds.
33. **PAYWALL-01** — paywall screen + RevenueCat (Free/Plus ₪29/Pro ₪49). FeatureGates read `subscriptionTier` from `useSubscriptionStore`. Done when: tier gates work for all features; tsc clean.
34. **AUTH-REGISTER-01** — full registration flow (Name+Email+Phone → Email OTP → PIN → Biometric). "המשך ללא חשבון" button. SMS OTP FeatureGate = Plus+Pro. Supabase Auth integration. Done when: registration + OTP verify + PIN setup complete; local-only mode works; tsc clean.
35. **PROMO-CODE-01** — RevenueCat promotional entitlements for `SMARTCARD-TEAM` (Plus 6mo, max 150) and `SMARTCARD-IL` (Plus 1mo, max 500). UI: Settings → "קוד קידום מכירות". Done when: valid code unlocks Plus entitlement; expired/overused codes rejected with message; tsc clean.
36. **MERCHANT-CONTRIB-01** — benefit submission form + Supabase `benefit_submissions` table + community confirmation flow + gamification badges. Done when: submission form works; Plus/Pro users can confirm; Ibrahim receives weekly digest; contributor badges stored; tsc clean.
37. **LEGAL-01** — Privacy Policy HTML *(Agent 10 writes content → hosted on mycard.co.il or GitHub Pages)*. Done when: URL live; linked in Play Console + App Store.
38. **STORE-01** — Play Store submission + Data Safety form + App Store submission. Done when: APK + IPA uploaded; Hebrew listing; Data Safety complete.

### Phase 4 (post-Beta — do NOT implement before M5 ships)
- **AUTH-FULL-01** — Full cloud account sync (financial data to Supabase) after CLOUD-SYNC-01 foundation
- **SHARED-01** — חשבון משותף real-time sync (Pro only). Requires CLOUD-SYNC-01 complete.
- **BIOMETRIC-PER-PROFILE-01** — per-profile biometric (deferred from MULTI-USER-01 Option B)

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
