// /src/navigation/types.ts
//
// Typed param lists for every navigation level: Root, Authenticated, Tab.
// The global ReactNavigation.RootParamList augmentation makes navigation hooks
// (useNavigation, etc.) fully typed app-wide without per-call generics.

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CheckInputDraft } from '../screens/check/CheckInputScreen';
import type {
  DecisionVerdict,
  FxComparisonRow,
} from '../types/decision.types';

// --- Per-tab stacks -----------------------------------------------------------
// Each of the 5 tabs owns its own stack so future detail/modal sub-screens
// (e.g. CardDetail under Cards) have a navigation path without restructuring.
// For now every stack holds only its English-named root placeholder screen.

/** Home tab stack. */
export type HomeStackParamList = {
  HomeRoot: undefined;
  // Deferred (DECISIONS_DEFERRED.md #7): screen files retained and typed, but
  // NOT registered in HomeStack and unreachable in MVP. See authMvpStaticContract.
  Benefits: undefined;
  SavingsTracker: undefined;
};

/**
 * THE P4 CHECK STACK — what `CheckModal` mounts.
 *
 * Two routes. `CheckInput` is the root; `CheckVerdict` receives the draft so the
 * loop can call the seam once and log the purchase (L1).
 */
export type CheckStackParamList = {
  CheckInput: undefined;
  CheckVerdict: { draft: CheckInputDraft } | undefined;
};

/**
 * THE LEGACY CHECK FLOW — criterion B2.
 *
 * Retired. `CheckModal` mounted `PurchaseGateStack`, which registered `PurchaseGateScreen` and
 * `DecisionScreen` — both from the deprecated pre-P2 prototype. `PurchaseGateStack.tsx` is gone and
 * **no navigator registers either screen on any route**: B2 is that the old flow becomes
 * unreachable rather than merely unused, because a screen that is still reachable is still shipped.
 *
 * The param list stays, and so do the two screen files, on the precedent this codebase already uses
 * for deferred surfaces (Benefits/SavingsTracker above): *screen files retained and typed, but NOT
 * registered and unreachable*. Typed, because both files still reference this list and other tests
 * still reference them; registered nowhere, because that is the criterion.
 */
export type PurchaseGateStackParamList = {
  // Supports deep link: trevik://purchase?amount=500&category=grocery
  PurchaseGateRoot: { amount?: number; category?: string } | undefined;
  Decision: {
    verdict: DecisionVerdict;
    /**
     * The engine's own reason for this verdict. MVP_SCOPE §4 requires the
     * screen show actual engine output; without carrying it here the screen
     * can only render a canned per-verdict sentence.
     */
    reason?: string;
    exchangeFeeWarning?: string;
    fxComparison?: readonly FxComparisonRow[];
  };
  Contact: undefined;
};

/**
 * WALLET tab stack — Spec §4. Its Cards|Benefits segmented control lives INSIDE `WalletRoot` and
 * registers no routes of its own: the spec's navigation bar has five items, and a control that
 * registered routes would make the route tree say more than the bar does.
 */
export type WalletStackParamList = {
  WalletRoot: undefined;
  AddCard: undefined;
  CardDetail: { cardId: string };
  /**
   * THE INTEREST CALCULATOR, PROMOTED OUT OF MORE.
   *
   * It is a fact about ONE CARD's rate, and it lived three taps away under More with no card in
   * scope. It opens from Card DNA now and carries the card's id, so the screen can offer that
   * card's own published rate instead of an empty field. The More registration is gone: two routes
   * to one screen is two places a rate can arrive from.
   */
  InterestCalculator: { cardId?: string } | undefined;
  /** P4 X1: Card DNA's entry point for the canonical FX Compare sheet. DNA content is P5. */
  CardDnaFxCompare: undefined;
  /**
   * THE BENEFITS HUB — Wallet's Benefits segment, and a route of its own.
   *
   * The segment is where a user browses everything; the ROUTE is how Card DNA opens the same Hub
   * scoped to one card. One screen, two entry points, no second benefit list. Authorised by the
   * Owner's scope addendum, which supersedes the V1.x deferral for this feature by name.
   */
  BenefitsHub: { cardId?: string } | undefined;
};

/**
 * PLAN tab stack — Spec §4. Calendar|Commitments is a segmented control inside `PlanRoot`, not two
 * routes, for the same reason Wallet's is.
 */
export type PlanStackParamList = {
  PlanRoot: undefined;
};

/** MORE tab stack — Spec §4's fifth item. Was "Settings"; the spec names it More. */
export type MoreStackParamList = {
  /**
   * MORE IS A FEATURE HUB NOW, NOT THE SETTINGS SCREEN.
   *
   * `MoreRoot` used to mount `SettingsScreen`, so "more" and "settings" were one place and the
   * product had nowhere to put a preference that was not also a feature. The Owner's directive
   * separates them: settings-like controls move to `Settings`, and More keeps the tools —
   * Learn, the glossary, issuer contact, importing existing installments.
   */
  MoreRoot: undefined;
  /**
   * THE DEDICATED SETTINGS EXPERIENCE.
   *
   * Registered here rather than as a sixth tab because criterion A1 fixes the navigation bar at
   * five items and the spec's bar has no Settings in it. Its PRIMARY entry is the gear on Home —
   * a top-level account area, which is what the directive asks for — and it is reachable from More
   * as well, because a control that exists in exactly one place is a control somebody cannot find.
   */
  Settings: undefined;
  Learn: undefined;
  DataPrivacy: undefined;
  /** V9 — the local crash log the user can inspect and copy (MDC-OBSERVABILITY option 1). */
  CrashLog: undefined;
  VaultExportImport: undefined;
  Contact: undefined;
  Glossary: undefined;
  InstallmentImport: undefined;
  /** DEV-ONLY diagnostics (PHASE-7 device evidence). Registered under __DEV__ exclusively. */
  EngineProbe: undefined;
  // Deferred (DECISIONS_DEFERRED.md #9/#12): screen files retained and typed,
  // but NOT registered in SettingsStack and unreachable in MVP.
  Loans: undefined;
  ProfileShare: undefined;
};

/**
 * THE BOTTOM TABS — **four**, not five, and that is the point of criterion A1.
 *
 * Spec §4's bar reads `HOME · WALLET · [CHECK ●] · PLAN · MORE`: five items, of which **Check is
 * not a tab**. It is a raised centre action that opens a full-screen modal on the AUTHENTICATED
 * stack, with no tab highlighted — a task, not a place.
 *
 * The inherited app registered `PurchaseGate` as a tab, which the forensic called *"the largest IA
 * mismatch"*. A tab is somewhere you ARE; making "check a purchase" a tab gave the app a permanent
 * room for a question, and highlighted a tab while a modal covered everything.
 *
 * The shape is declared in `src/navigation/ia.ts` and this list mirrors it. Both are compared
 * against the spec itself by the `nav` gate.
 */
export type TabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Wallet: NavigatorScreenParams<WalletStackParamList> | undefined;
  Plan: NavigatorScreenParams<PlanStackParamList> | undefined;
  More: NavigatorScreenParams<MoreStackParamList> | undefined;
};

/**
 * The authenticated subtree. A stack so future authenticated detail/modal
 * screens (DecisionScreen, card detail, etc.) can be added without flattening.
 */
export type AuthenticatedStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  /**
   * THE CHECK TASK. Registered here — ABOVE the tabs — and not inside them, because Spec §4 says it
   * *"opens a full-screen modal task flow… no tab is highlighted while inside it"*. A route inside
   * the tab navigator cannot cover the tab bar, and whichever tab hosted it would highlight.
   *
   * It mounts `CheckStackParamList` — the P4 flow. It used to mount `PurchaseGateStackParamList`;
   * that is criterion B2, and the swap is the whole of it.
   */
  CheckModal: NavigatorScreenParams<CheckStackParamList> | undefined;
};

/**
 * Root level. Exactly one branch is ever registered at a time:
 * - 'Lock' when AuthGate reports LOCKED/UNKNOWN
 * - 'Authenticated' when AuthGate reports UNLOCKED
 */
export type RootStackParamList = {
  Lock: { mode?: 'unlock' | 'pin_setup' } | undefined;
  Register: undefined;
  OTPVerify: { email: string };
  Onboarding: undefined;
  Authenticated: NavigatorScreenParams<AuthenticatedStackParamList> | undefined;
  Paywall: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface RootParamList extends RootStackParamList {}
  }
}
