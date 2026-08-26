import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CheckInputScreen } from '../../screens/check/CheckInputScreen';
import { CheckVerdictScreen } from '../../screens/check/CheckVerdictScreen';
import type { CheckStackParamList } from '../types';

const Stack = createNativeStackNavigator<CheckStackParamList>();

/**
 * THE CHECK TASK'S OWN STACK — what `CheckModal` mounts, and criterion B2.
 *
 * `CheckModal` used to mount `PurchaseGateStack`, whose header still described the pre-P2
 * architecture it belonged to and which rendered `PurchaseGateScreen` and `DecisionScreen`. P2
 * rebuilt the route TREE and deliberately left the CONTENTS of the Check route to the phase that
 * owns Check. This is that replacement, and `PurchaseGateStack.tsx` is gone rather than merely
 * unused: a screen that is still reachable is still shipped.
 *
 * TWO ROUTES, ASK A QUESTION AND GET AN ANSWER. `CheckInput` is the root because a task starts where
 * the user says what they are checking; `CheckVerdict` is the end of it. Both screens are thin here
 * — WP-1.2 and WP-1.4 give them their contracts — so this file is the whole of what WP-1.1 changes
 * about the flow.
 *
 * The stack is NOT where the modal presentation lives. That stays on the `CheckModal` route in
 * `AuthenticatedNavigator`, above the tabs, because Spec §4's raised centre action must cover the
 * tab bar with no tab highlighted, and only a route on the authenticated stack can.
 */
export function CheckStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen component={CheckInputScreen} name="CheckInput" options={{ title: 'Check' }} />
      <Stack.Screen
        component={CheckVerdictScreen}
        name="CheckVerdict"
        options={{ title: 'Verdict' }}
      />
    </Stack.Navigator>
  );
}
