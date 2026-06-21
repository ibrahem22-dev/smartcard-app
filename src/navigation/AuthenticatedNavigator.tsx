// /src/navigation/AuthenticatedNavigator.tsx
//
// The authenticated subtree. Mounts ONLY when AuthGate reports UNLOCKED.
// A stack so future authenticated detail/modal screens (DecisionScreen, card
// detail, etc.) can be pushed over the tabs without flattening the structure.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TabNavigator } from './TabNavigator';
import type { AuthenticatedStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthenticatedStackParamList>();

export function AuthenticatedNavigator(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
    </Stack.Navigator>
  );
}
