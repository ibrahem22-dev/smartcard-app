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
import { CardDetailScreen } from '../../screens/CardDetailScreen';
import { InterestCalculatorScreen } from '../../screens/InterestCalculatorScreen';
import { useTranslation } from '../../hooks/useTranslation';
import type { CardsStackParamList } from '../types';

const Stack = createNativeStackNavigator<CardsStackParamList>();

export function CardsStack(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="CardsRoot"
        component={CardsScreen}
        options={{ title: 'Cards' }}
      />
      <Stack.Screen
        name="CardDetail"
        component={CardDetailScreen}
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#141414' },
          headerTintColor: '#FFFFFF',
          title: t('פרטי כרטיס'),
        }}
      />
      <Stack.Screen
        name="InterestCalculator"
        component={InterestCalculatorScreen}
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#141414' },
          headerTintColor: '#FFFFFF',
          title: t('מחשבון ריבית'),
        }}
      />
    </Stack.Navigator>
  );
}
