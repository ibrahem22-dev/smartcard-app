// /src/screens/LockScreen.tsx
//
// Placeholder lock screen shown whenever AuthGate is not UNLOCKED.
// English-only placeholder copy for the skeleton stage; localized Hebrew/Arabic
// copy lands in the M3 UX copy pass (do not author RTL literals here yet).
//
// The "debug unlock" button is TEMPORARY scaffolding so the authenticated tree
// can be exercised before AUTH-01 wires real biometric/PIN auth. It calls the
// auth context (which calls keyVault.unlock()) and lets AuthGate re-register
// the authenticated branch.

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAuth } from '../navigation/authContext';
import { useTranslation } from '../hooks/useTranslation';

export function LockScreen(): React.ReactElement {
  const auth = useAuth();
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-slate-900 p-6 dark:bg-app-dark">
      <Text className="text-right text-center text-[22px] font-bold text-white">
        {t('אימות להמשך')}
      </Text>

      {__DEV__ && auth.debugUnlock !== undefined ? (
        <Pressable
          accessibilityRole="button"
          className="mt-10 rounded-[10px] bg-blue-600 px-6 py-3"
          onPress={() => {
            void auth.debugUnlock?.();
          }}
        >
          <Text className="text-right text-base font-semibold text-white">
            {t('פתיחת נעילה לצורכי פיתוח')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
