// /src/navigation/stacks/SettingsStack.tsx
//
// Stack navigator for the Settings tab. Lives entirely inside TabNavigator ->
// AuthenticatedNavigator, so it never escapes the AuthGate boundary. Root is the
// existing placeholder; future settings sub-screens push here.
//
// Headers are hidden for the skeleton stage (placeholder renders its own title);
// the English `title` is still set so route titles exist for future sub-screens.

import React from 'react';
import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ContactScreen } from '../../screens/ContactScreen';
import { GlossaryScreen } from '../../screens/GlossaryScreen';
import { InstallmentImportScreen } from '../../screens/InstallmentImportScreen';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { useTranslation } from '../../hooks/useTranslation';
import type { SettingsStackParamList } from '../types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStack(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerBackVisible: false,
        headerLeft: ({ canGoBack }) =>
          canGoBack ? (
            <Pressable
              accessibilityLabel={t('חזרה')}
              accessibilityRole="button"
              hitSlop={12}
              onPress={navigation.goBack}
            >
              <Text className="text-2xl text-white">←</Text>
            </Pressable>
          ) : null,
        headerShown: false,
        headerStyle: { backgroundColor: '#141414' },
        headerTintColor: '#FFFFFF',
      })}
    >
      <Stack.Screen
        name="SettingsRoot"
        component={SettingsScreen}
        options={{ title: t('הגדרות') }}
      />
      <Stack.Screen
        name="Contact"
        component={ContactScreen}
        options={{ title: t('צור קשר עם חברת האשראי') }}
      />
      <Stack.Screen
        name="Glossary"
        component={GlossaryScreen}
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: t('מילון פיננסי'),
        }}
      />
      <Stack.Screen
        name="InstallmentImport"
        component={InstallmentImportScreen}
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: t('תשלומים קיימים'),
        }}
      />
    </Stack.Navigator>
  );
}
