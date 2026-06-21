// /src/navigation/stacks/PurchaseGateStack.tsx
//
// Stack navigator for the Purchase Gate tab (the primary, center action). Lives
// entirely inside TabNavigator -> AuthenticatedNavigator, so it never escapes the
// AuthGate boundary. Root is the existing placeholder and accepts deep-link
// params (smartcard://purchase?amount=500&category=grocery).
//
// Headers are hidden for the skeleton stage (placeholder renders its own title);
// the English `title` is still set so route titles exist for future sub-screens.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PurchaseGateScreen } from '../../screens/PurchaseGateScreen';
import type { PurchaseGateStackParamList } from '../types';

const Stack = createNativeStackNavigator<PurchaseGateStackParamList>();

export function PurchaseGateStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="PurchaseGateRoot"
        component={PurchaseGateScreen}
        options={{ title: 'Purchase Gate' }}
      />
    </Stack.Navigator>
  );
}
