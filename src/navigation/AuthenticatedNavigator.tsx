// /src/navigation/AuthenticatedNavigator.tsx
//
// The authenticated subtree. Mounts ONLY when AuthGate reports UNLOCKED.
// A stack so future authenticated detail/modal screens (DecisionScreen, card
// detail, etc.) can be pushed over the tabs without flattening the structure.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CheckStack } from './stacks/CheckStack';
import { TabNavigator } from './TabNavigator';
import type { AuthenticatedStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthenticatedStackParamList>();

export function AuthenticatedNavigator(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      {/*
        THE CHECK TASK, registered ABOVE the tabs — Spec §4: a raised centre action that opens a
        full-screen modal task flow, with no tab highlighted while inside it.

        Its placement here is the mechanism. A route inside the tab navigator cannot cover the tab
        bar, and whichever tab hosted it would highlight — which is precisely what the inherited
        Check-as-tab did, and what the forensic called the largest IA mismatch in the app.

        WHAT IT MOUNTS IS CRITERION B2. This route used to mount `PurchaseGateStack`, and through it
        the deprecated pre-P2 `PurchaseGateScreen` and `DecisionScreen`. It now mounts the P4
        `CheckStack`, and the legacy stack is registered on no route at all. The route's PLACEMENT
        and PRESENTATION are unchanged: P2 got those right, and B2 is about the contents.
      */}
      <Stack.Screen
        component={CheckStack}
        name="CheckModal"
        options={{ presentation: "fullScreenModal" }}
      />
    </Stack.Navigator>
  );
}
