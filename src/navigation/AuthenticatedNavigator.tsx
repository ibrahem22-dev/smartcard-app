// /src/navigation/AuthenticatedNavigator.tsx
//
// The authenticated subtree. Mounts ONLY when AuthGate reports UNLOCKED.
// A stack so future authenticated detail/modal screens (DecisionScreen, card
// detail, etc.) can be pushed over the tabs without flattening the structure.

import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TabNavigator } from './TabNavigator';
import { scheduleAnnualGlobalReminder } from '../services/notificationScheduler';
import type { AuthenticatedStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthenticatedStackParamList>();

export function AuthenticatedNavigator(): React.ReactElement {
  useEffect(() => {
    void scheduleAnnualGlobalReminder().catch((): void => {
      // Reminder scheduling must never block the authenticated navigator.
    });
  }, []);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
    </Stack.Navigator>
  );
}
