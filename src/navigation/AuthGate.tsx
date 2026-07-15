// /src/navigation/AuthGate.tsx
//
// AuthGate is the security boundary. It owns the root stack and decides, from
// auth state, whether to register the LockScreen branch or the Authenticated
// branch. Because only ONE branch is registered with the navigator at a time,
// there is no navigation path to any financial (tab) screen while LOCKED -- the
// authenticated routes simply do not exist in the navigator state.
//
// Auth state itself lives in ./authContext (separate module) so that LockScreen
// can consume it without importing AuthGate (avoids a require cycle).

// /src/navigation/AuthGate.tsx
import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LockScreen } from '../screens/LockScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { AuthenticatedNavigator } from './AuthenticatedNavigator';
import { useAuth } from './authContext';
import { resolveAuthGateBranch } from './authGatePolicy';
import { recordAuthRuntimeSnapshot } from './authRuntimeDiagnostics';
import { clearInMemoryStores } from './authLifecycle';
import type { RootStackParamList } from './types';
import { keyVault } from '../security/keyVault';

const RootStack = createNativeStackNavigator<RootStackParamList>();

/**
 * Renders the root navigator with exactly one branch based on auth state.
 * LOCKED/UNKNOWN -> only LockScreen exists. UNLOCKED -> only Authenticated exists.
 */


export function AuthGate(): React.ReactElement {
  const {
    status,
    hasLocalVault,
    isBootstrapping,
    isUnlocked,
    isOnboardingComplete,
  } = useAuth();
  const canMountSecureNavigator = keyVault.canMountSecureNavigator();
  const branch = resolveAuthGateBranch({
    isBootstrapping,
    hasLocalVault,
    isUnlocked,
    isOnboardingComplete,
    canMountSecureNavigator,
  });

  useEffect(() => {
    if (isUnlocked && !canMountSecureNavigator) {
      clearInMemoryStores();
    }
    recordAuthRuntimeSnapshot(`AUTH_GATE_${branch}`, {
      status,
      hasLocalVault,
      canMountSecureNavigator,
    });
  }, [
    branch,
    canMountSecureNavigator,
    hasLocalVault,
    isUnlocked,
    status,
  ]);

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {branch === 'LOCK' ? (
        <RootStack.Screen name="Lock" component={LockScreen} />
      ) : branch === 'ONBOARDING' ? (
        <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <RootStack.Screen name="Authenticated" component={AuthenticatedNavigator} />
      )}
      <RootStack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: 'modal' }}
      />
    </RootStack.Navigator>
  );
}
