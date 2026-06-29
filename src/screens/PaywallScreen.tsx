import React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScrollView } from '../components/rtl';
import { useAppDirection } from '../hooks/useAppDirection';
import type { RootStackParamList } from '../navigation/types';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import type { SubscriptionTier } from '../types/subscription.types';

type PaywallScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Paywall'
>;

const FREE_FEATURES: readonly string[] = [
  'ניהול כרטיסים בסיסי',
  'מחשבון רכישה',
  'עד 3 כרטיסים',
];

const PLUS_FEATURES: readonly string[] = [
  'כל מה שבחינמי',
  'כרטיסים ללא הגבלה',
  'מעקב הלוואות',
  'גיבוי ענן ☁️',
  'מראה הבנק 👑',
];

const PRO_FEATURES: readonly string[] = [
  'כל מה שב-Plus',
  'שיתוף פרופיל QR',
  'OTP SMS',
  'תמיכה מועדפת',
];

export function PaywallScreen({
  navigation,
}: PaywallScreenProps): React.ReactElement {
  const { isRTL } = useAppDirection();
  const { refreshTier } = useSubscriptionStore();

  async function handlePurchase(
    tier: Exclude<SubscriptionTier, 'free'>,
  ): Promise<void> {
    console.log(`[PAYWALL] Purchase initiated: ${tier}`);
  }

  async function handleRestore(): Promise<void> {
    console.log('[PAYWALL] Restore initiated');
  }

  function onDismiss(): void {
    navigation.goBack();
  }

  // Reserved for PAYWALL-01 Part 3 after a successful RevenueCat operation.
  void refreshTier;

  return (
    <SafeAreaView
      className="flex-1 bg-slate-50 dark:bg-app-dark"
      key={isRTL ? 'paywall-rtl' : 'paywall-ltr'}
    >
      <RtlScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      >
        <View className="w-full gap-4 px-5 py-6">
          <View className="gap-2">
            <AppText
              align="center"
              className="text-3xl font-extrabold text-slate-900 dark:text-slate-50"
            >
              בחר את התוכנית שלך
            </AppText>
            <AppText
              align="center"
              className="text-base text-slate-600 dark:text-slate-300"
            >
              נסה 7 ימים בחינם — בטל בכל עת
            </AppText>
          </View>

          <View className="gap-3 rounded-2xl border border-slate-300 bg-white p-5 dark:border-neutral-700 dark:bg-dark-surface">
            <AppText className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
              חינמי
            </AppText>
            <AppText className="text-lg font-bold text-slate-600 dark:text-slate-300">
              ₪0 / חודש
            </AppText>
            <View className="gap-2">
              {FREE_FEATURES.map(
                (feature: string): React.ReactElement => (
                  <RtlRow className="items-center gap-2" key={feature}>
                    <AppText>✅</AppText>
                    <AppText className="flex-1 text-base text-slate-700 dark:text-slate-200">
                      {feature}
                    </AppText>
                  </RtlRow>
                ),
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              className="mt-1 rounded-xl border border-slate-400 px-4 py-3"
              onPress={onDismiss}
            >
              <AppText
                align="center"
                className="text-base font-extrabold text-slate-700 dark:text-slate-100"
              >
                המשך ללא תשלום
              </AppText>
            </Pressable>
          </View>

          <View className="gap-3 rounded-2xl border-2 border-blue-600 bg-white p-5 shadow-lg dark:bg-dark-surface">
            <RtlRow>
              <View className="rounded-full bg-blue-600 px-3 py-1">
                <AppText className="text-sm font-extrabold text-white">
                  הכי פופולרי
                </AppText>
              </View>
            </RtlRow>
            <AppText className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">
              Plus ⭐
            </AppText>
            <AppText className="text-lg font-bold text-slate-700 dark:text-slate-200">
              ₪29 / חודש
            </AppText>
            <View className="gap-2">
              {PLUS_FEATURES.map(
                (feature: string): React.ReactElement => (
                  <RtlRow className="items-center gap-2" key={feature}>
                    <AppText>✅</AppText>
                    <AppText className="flex-1 text-base text-slate-700 dark:text-slate-200">
                      {feature}
                    </AppText>
                  </RtlRow>
                ),
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              className="mt-1 rounded-xl bg-blue-600 px-4 py-3 shadow-sm"
              onPress={() => {
                void handlePurchase('plus');
              }}
            >
              <AppText
                align="center"
                className="text-base font-extrabold text-white"
              >
                התחל ניסיון חינמי
              </AppText>
            </Pressable>
          </View>

          <View className="gap-3 rounded-2xl border-2 border-violet-500 bg-white p-5 dark:bg-dark-surface">
            <AppText className="text-2xl font-extrabold text-violet-700 dark:text-violet-300">
              Pro 🚀
            </AppText>
            <AppText className="text-lg font-bold text-slate-700 dark:text-slate-200">
              ₪49 / חודש
            </AppText>
            <View className="gap-2">
              {PRO_FEATURES.map(
                (feature: string): React.ReactElement => (
                  <RtlRow className="items-center gap-2" key={feature}>
                    <AppText>✅</AppText>
                    <AppText className="flex-1 text-base text-slate-700 dark:text-slate-200">
                      {feature}
                    </AppText>
                  </RtlRow>
                ),
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              className="mt-1 rounded-xl bg-violet-600 px-4 py-3 shadow-sm"
              onPress={() => {
                void handlePurchase('pro');
              }}
            >
              <AppText
                align="center"
                className="text-base font-extrabold text-white"
              >
                שדרג ל-Pro
              </AppText>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="link"
            className="px-4 py-2"
            onPress={() => {
              void handleRestore();
            }}
          >
            <AppText
              align="center"
              className="text-base font-bold text-blue-700 dark:text-blue-300"
            >
              שחזר רכישה קודמת
            </AppText>
          </Pressable>

          <AppText
            align="center"
            className="text-xs text-slate-500 dark:text-slate-400"
          >
            מחירים כוללים מע״מ. המנוי מתחדש אוטומטית.
          </AppText>
        </View>
      </RtlScrollView>
    </SafeAreaView>
  );
}
