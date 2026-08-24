// /src/navigation/AuthenticatedNavigator.tsx
//
// The authenticated subtree. Mounts ONLY when AuthGate reports UNLOCKED.
// A stack so future authenticated detail/modal screens (DecisionScreen, card
// detail, etc.) can be pushed over the tabs without flattening the structure.

import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PurchaseGateStack } from './stacks/PurchaseGateStack';
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
      {/*
        THE CHECK TASK, registered ABOVE the tabs — Spec §4: a raised centre action that opens a
        full-screen modal task flow, with no tab highlighted while inside it.

        Its placement here is the mechanism. A route inside the tab navigator cannot cover the tab
        bar, and whichever tab hosted it would highlight — which is precisely what the inherited
        Check-as-tab did, and what the forensic called the largest IA mismatch in the app.
      */}
      <Stack.Screen
        component={PurchaseGateStack}
        name="CheckModal"
        options={{ presentation: "fullScreenModal" }}
      />
    </Stack.Navigator>
  );
}
