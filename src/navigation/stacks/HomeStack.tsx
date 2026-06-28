// /src/navigation/stacks/HomeStack.tsx
//
// Stack navigator for the Home tab. Lives entirely inside TabNavigator, which
// only mounts inside AuthenticatedNavigator -- nothing here escapes the AuthGate
// boundary. Root is the existing placeholder; future Home sub-screens push here.
//
// Headers are hidden for the skeleton stage (placeholder renders its own title);
// the English `title` is still set so route titles exist for future sub-screens.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../../screens/HomeScreen';
import { BenefitsScreen } from '../../screens/BenefitsScreen';
import { SavingsTrackerScreen } from '../../screens/SavingsTrackerScreen';
import { useTranslation } from '../../hooks/useTranslation';
import type { HomeStackParamList } from '../types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="HomeRoot"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Stack.Screen
        name="Benefits"
        component={BenefitsScreen}
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#141414' },
          headerTintColor: '#FFFFFF',
          title: t('הטבות לכרטיס'),
        }}
      />
      <Stack.Screen
        name="SavingsTracker"
        component={SavingsTrackerScreen}
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#141414' },
          headerTintColor: '#FFFFFF',
          title: t('מעקב חיסכון'),
        }}
      />
    </Stack.Navigator>
  );
}
