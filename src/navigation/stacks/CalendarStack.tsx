// /src/navigation/stacks/CalendarStack.tsx
//
// Stack navigator for the Calendar tab. Lives entirely inside TabNavigator ->
// AuthenticatedNavigator, so it never escapes the AuthGate boundary. Root is the
// existing placeholder; future cashflow detail sub-screens push here.
//
// Headers are hidden for the skeleton stage (placeholder renders its own title);
// the English `title` is still set so route titles exist for future sub-screens.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CalendarScreen } from '../../screens/CalendarScreen';
import type { CalendarStackParamList } from '../types';

const Stack = createNativeStackNavigator<CalendarStackParamList>();

export function CalendarStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="CalendarRoot"
        component={CalendarScreen}
        options={{ title: 'Calendar' }}
      />
    </Stack.Navigator>
  );
}
