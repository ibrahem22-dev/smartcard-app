// /src/navigation/stacks/CardsStack.tsx
//
// Stack navigator for the Cards tab. Lives entirely inside TabNavigator ->
// AuthenticatedNavigator, so it never escapes the AuthGate boundary. Root is the
// existing placeholder; a future CardDetail screen pushes onto this stack.
//
// Headers are hidden for the skeleton stage (placeholder renders its own title);
// the English `title` is still set so route titles exist for future sub-screens.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CardsScreen } from '../../screens/CardsScreen';
import type { CardsStackParamList } from '../types';

const Stack = createNativeStackNavigator<CardsStackParamList>();

export function CardsStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="CardsRoot"
        component={CardsScreen}
        options={{ title: 'Cards' }}
      />
    </Stack.Navigator>
  );
}
