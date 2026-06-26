// /src/navigation/RootNavigator.tsx
//
// Top of the navigation tree (rendered inside NavigationContainer in App.tsx):
//
//   RootNavigator
//    +- AuthGate (LOCKED vs UNLOCKED)
//        +- LOCKED   -> LockScreen
//        +- UNLOCKED -> AuthenticatedNavigator -> TabNavigator (5 tabs)
//
// RootNavigator only wires the AuthProvider around AuthGate. The actual
// conditional registration of screens lives in AuthGate so the security
// boundary is in one place.

import React from 'react';

import { PrivacyOverlay } from '../components/PrivacyOverlay';
import { AuthProvider } from './authContext';
import { AuthGate } from './AuthGate';

export function RootNavigator(): React.ReactElement {
  return (
    <AuthProvider>
      <AuthGate />
      <PrivacyOverlay />
    </AuthProvider>
  );
}
