// App.tsx
//
// Application entry. Two responsibilities:
//   1. Force RTL globally before anything renders (Hebrew/Arabic first).
//   2. Mount NavigationContainer -> RootNavigator (which gates on auth).
//
// Deep links (smartcard://...) are resolved by NavigationContainer, but because
// the authenticated routes are only registered by AuthGate when UNLOCKED, a deep
// link into a financial screen while LOCKED cannot resolve -- it falls through to
// the LockScreen. AuthGate is therefore always evaluated first on cold start,
// deep link, and app-state restoration, and never defaults to UNLOCKED.

import React from 'react';
import { I18nManager } from 'react-native';
import {
  NavigationContainer,
  type LinkingOptions,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';

import { RootNavigator } from './src/navigation/RootNavigator';
import type { RootStackParamList } from './src/navigation/types';

// --- Global RTL ---------------------------------------------------------------
// Hebrew/Arabic-first app. I18nManager.forceRTL only takes effect after a native
// reload, so when the current direction does not already match we flip it and
// reload. Running this at module load keeps it ahead of the first render.
const shouldBeRTL = true;
if (I18nManager.isRTL !== shouldBeRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
  if (Updates.isEnabled) {
    // Production build / custom dev client: reload so RTL applies immediately.
    void Updates.reloadAsync();
  } else {
    // Expo Go (expo-updates not configured): auto-reload is unavailable. The new
    // RTL flag is persisted by the OS and applies on the NEXT launch. To see RTL
    // immediately during development, trigger a manual full reload -- press "r"
    // in the Metro terminal, or use the dev-menu "Reload" (shake / Cmd+R).
    console.warn(
      '[RTL] forceRTL set but auto-reload is unavailable in Expo Go. ' +
        'Press "r" in Metro (or use dev-menu Reload) to apply RTL now; ' +
        'otherwise it applies on next launch.',
    );
  }
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['smartcard://'],
  config: {
    screens: {
      // Authenticated routes still pass through AuthGate; when LOCKED they are
      // not registered and the link safely falls back to Lock.
      Authenticated: {
        screens: {
          Tabs: {
            screens: {
              // Each tab is its own stack; map the path to the stack's root so
              // params (e.g. purchase?amount=...) land on the root screen.
              Home: { screens: { HomeRoot: 'home' } },
              PurchaseGate: { screens: { PurchaseGateRoot: 'purchase' } },
              Cards: { screens: { CardsRoot: 'cards' } },
              Calendar: { screens: { CalendarRoot: 'calendar' } },
              Settings: { screens: { SettingsRoot: 'settings' } },
            },
          },
        },
      },
      Lock: 'lock',
    },
  },
};

export default function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <StatusBar style="auto" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
