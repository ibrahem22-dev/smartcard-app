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

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { LockScreen } from '../screens/LockScreen';
import { AuthenticatedNavigator } from './AuthenticatedNavigator';
import { useAuth } from './authContext';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

/**
 * Renders the root navigator with exactly one branch based on auth state.
 * LOCKED/UNKNOWN -> only LockScreen exists. UNLOCKED -> only Authenticated exists.
 */
export function AuthGate(): React.ReactElement {
  const { isUnlocked } = useAuth();

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isUnlocked ? (
        <RootStack.Screen
          name="Authenticated"
          component={AuthenticatedNavigator}
        />
      ) : (
        <RootStack.Screen name="Lock" component={LockScreen} />
      )}
    </RootStack.Navigator>
  );
}
