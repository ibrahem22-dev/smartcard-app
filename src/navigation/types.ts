// /src/navigation/types.ts
//
// Typed param lists for every navigation level: Root, Authenticated, Tab.
// The global ReactNavigation.RootParamList augmentation makes navigation hooks
// (useNavigation, etc.) fully typed app-wide without per-call generics.

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DecisionVerdict } from '../types/decision.types';

// --- Per-tab stacks -----------------------------------------------------------
// Each of the 5 tabs owns its own stack so future detail/modal sub-screens
// (e.g. CardDetail under Cards) have a navigation path without restructuring.
// For now every stack holds only its English-named root placeholder screen.

/** Home tab stack. */
export type HomeStackParamList = {
  HomeRoot: undefined;
};

/** Purchase Gate tab stack. */
export type PurchaseGateStackParamList = {
  // Supports deep link: smartcard://purchase?amount=500&category=grocery
  PurchaseGateRoot: { amount?: number; category?: string } | undefined;
  Decision: { verdict: DecisionVerdict };
  Contact: undefined;
};

/** Cards tab stack. Future: CardDetail: { cardId: string }. */
export type CardsStackParamList = {
  CardsRoot: undefined;
};

/** Calendar tab stack. */
export type CalendarStackParamList = {
  CalendarRoot: undefined;
};

/** Settings tab stack. */
export type SettingsStackParamList = {
  SettingsRoot: undefined;
  Contact: undefined;
  Glossary: undefined;
  InstallmentImport: undefined;
};

/**
 * Bottom tabs — the 5 financial screens. All mount only inside Authenticated.
 * Each tab is itself a stack navigator (see *StackParamList above).
 */
export type TabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  PurchaseGate: NavigatorScreenParams<PurchaseGateStackParamList> | undefined;
  Cards: NavigatorScreenParams<CardsStackParamList> | undefined;
  Calendar: NavigatorScreenParams<CalendarStackParamList> | undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

/**
 * The authenticated subtree. A stack so future authenticated detail/modal
 * screens (DecisionScreen, card detail, etc.) can be added without flattening.
 */
export type AuthenticatedStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
};

/**
 * Root level. Exactly one branch is ever registered at a time:
 * - 'Lock' when AuthGate reports LOCKED/UNKNOWN
 * - 'Authenticated' when AuthGate reports UNLOCKED
 */
export type RootStackParamList = {
  Lock: undefined;
  Onboarding: undefined;
  Authenticated: NavigatorScreenParams<AuthenticatedStackParamList> | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface RootParamList extends RootStackParamList {}
  }
}
