// /src/navigation/stacks/SettingsStack.tsx
//
// Stack navigator for the Settings tab. Lives entirely inside TabNavigator ->
// AuthenticatedNavigator, so it never escapes the AuthGate boundary. Root is the
// existing placeholder; future settings sub-screens push here.
//
// Headers are hidden for the skeleton stage (placeholder renders its own title);
// the English `title` is still set so route titles exist for future sub-screens.

import React from 'react';
import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppText } from '../../components/AppText';
import { ContactScreen } from '../../screens/ContactScreen';
import { CrashLogScreen } from '../../screens/CrashLogScreen';
import { DataPrivacyScreen } from '../../screens/DataPrivacyScreen';
import { VaultExportImportScreen } from '../../screens/VaultExportImportScreen';
import { GlossaryScreen } from '../../screens/GlossaryScreen';
import { InstallmentImportScreen } from '../../screens/InstallmentImportScreen';
import { LearnScreen } from '../../screens/LearnScreen';
import { MoreScreen } from '../../screens/MoreScreen';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { useAppDirection, useStackBackGlyph } from '../../hooks/useAppDirection';
import { useTranslation } from '../../hooks/useTranslation';
import type { MoreStackParamList } from '../types';
import { CHROME, TEXT } from '../../theme/tokens';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreStack(): React.ReactElement {
  const { t } = useTranslation();
  const { isRTL } = useAppDirection();
  const backGlyph = useStackBackGlyph();

  const renderBackButton = (
    canGoBack: boolean | undefined,
    goBack: () => void,
  ): React.ReactElement | null =>
    canGoBack === true ? (
      <Pressable
        accessibilityLabel={t('חזרה')}
        accessibilityRole="button"
        hitSlop={12}
        onPress={goBack}
      >
        <AppText className={`text-2xl ${TEXT.onAccent}`}>{backGlyph}</AppText>
      </Pressable>
    ) : null;

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerBackVisible: false,
        headerLeft: isRTL
          ? (): null => null
          : ({ canGoBack }) =>
              renderBackButton(canGoBack, navigation.goBack),
        headerRight: isRTL
          ? ({ canGoBack }) =>
              renderBackButton(canGoBack, navigation.goBack)
          : (): null => null,
        headerShown: false,
        headerStyle: { backgroundColor: CHROME.white },
        headerTintColor: CHROME.ink,
      })}
    >
      <Stack.Screen
        name="MoreRoot"
        component={MoreScreen}
        options={{ title: t('עוד') }}
      />
      {/* SETTINGS IS A ROUTE, NOT A TAB. Criterion A1 fixes the bar at the spec's five items, so a
          sixth tab would make the route tree say more than the navigation bar does. Its primary
          entry is the gear on Home; this registration is what both entries reach. */}
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          headerTitleAlign: isRTL ? 'center' : 'left',
          title: t('הגדרות'),
        }}
      />
      <Stack.Screen
        name="Learn"
        component={LearnScreen}
        options={{
          headerShown: true,
          headerTitleAlign: isRTL ? 'center' : 'left',
          title: t('לומדים'),
        }}
      />
      <Stack.Screen
        name="DataPrivacy"
        component={DataPrivacyScreen}
        options={{
          headerShown: true,
          headerTitleAlign: isRTL ? 'center' : 'left',
          title: t('מידע ופרטיות'),
        }}
      />
      <Stack.Screen
        name="VaultExportImport"
        component={VaultExportImportScreen}
        options={{
          headerShown: true,
          headerTitleAlign: isRTL ? 'center' : 'left',
          title: t('ייצוא וייבוא כספת'),
        }}
      />
      <Stack.Screen
        name="CrashLog"
        component={CrashLogScreen}
        options={{ title: t('יומן קריסות') }}
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
          headerTitleAlign: isRTL ? 'center' : 'left',
          title: t('מילון פיננסי'),
        }}
      />
      <Stack.Screen
        name="InstallmentImport"
        component={InstallmentImportScreen}
        options={{
          headerShown: true,
          headerTitleAlign: isRTL ? 'center' : 'left',
          title: t('תשלומים קיימים'),
        }}
      />
      {/* THE INTEREST CALCULATOR IS NOT REGISTERED HERE ANY MORE — it moved to WalletStack, where
          it opens from the card whose rate it is about and receives that card's id. Two routes to
          one screen would be two places a rate could arrive from. */}
      {__DEV__ ? (
        <Stack.Screen
          name="EngineProbe"
          component={require('../../dev/EngineProbeScreen').EngineProbeScreen}
          options={{
            headerShown: true,
            headerTitleAlign: isRTL ? 'center' : 'left',
            title: 'ENGINE PROBE (dev)',
          }}
        />
      ) : null}
    </Stack.Navigator>
  );
}
