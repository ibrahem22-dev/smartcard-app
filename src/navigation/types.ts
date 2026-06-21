// /src/navigation/types.ts
//
// Typed param lists for every navigation level: Root, Authenticated, Tab.
// The global ReactNavigation.RootParamList augmentation makes navigation hooks
// (useNavigation, etc.) fully typed app-wide without per-call generics.

import type { NavigatorScreenParams } from '@react-navigation/native';

/** Bottom tabs — the 5 financial screens. All mount only inside Authenticated. */
export type TabParamList = {
  Home: undefined;
  // Supports deep link: smartcard://purchase?amount=500&category=grocery
  PurchaseGate: { amount?: number; category?: string } | undefined;
  Cards: undefined;
  Calendar: undefined;
  Settings: undefined;
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
  Authenticated: NavigatorScreenParams<AuthenticatedStackParamList> | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface RootParamList extends RootStackParamList {}
  }
}
