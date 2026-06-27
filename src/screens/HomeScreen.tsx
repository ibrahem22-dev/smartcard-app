import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { FeatureGate } from '../components/FeatureGate';
import { ProfileSwitcher } from '../components/ProfileSwitcher';
import { useTheme } from '../hooks/useTheme';
import type { TabParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';
import { useProfileStore } from '../store/useProfileStore';
import { rtl } from '../utils/rtlStyles';

const DAILY_TIPS: readonly string[] = [
  'שלם ביום חיוב כדי למקסם את תקופת האשראי',
  'הימנע מחיובים בחו"ל ללא כרטיס ללא עמלה',
  'פרוס לתשלומים רק כשהריבית שווה',
  'בדוק חזרת חיוב לפני כל רכישה גדולה',
  'השתמש במועדון הנכון לכל סוג קנייה',
];

function getDailyTip(): string {
  const dayIndex = new Date().getDate() - 1;
  const tipIndex = dayIndex % DAILY_TIPS.length;

  return DAILY_TIPS[tipIndex] ?? 'שלם ביום חיוב כדי למקסם את תקופת האשראי';
}

export function HomeScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const cards = useCardsStore(state => state.cards);
  const activeProfile = useProfileStore(state => state.activeProfile);
  const upcomingObligationsCount = cards.length;

  function handleCheckPurchase(): void {
    navigation.navigate('PurchaseGate', { screen: 'PurchaseGateRoot' });
  }

  return (
    <View
      className="flex-1 bg-slate-50 dark:bg-app-dark"
      style={rtl.screen}
    >
      {/*
        FIX: Removed className="flex-1" from ScrollView.
        NativeWind's CSSInterop.ScrollView injects className props into the
        native `style` prop. On Android, if any layout prop (alignItems,
        flexDirection, etc.) ends up in ScrollView's style instead of
        contentContainerStyle, React Native throws Invariant Violation.
        Solution: use explicit style/contentContainerStyle only — no className on ScrollView.
      */}
      <ScrollView
        style={rtl.scrollOuter}
        contentContainerStyle={rtl.scrollInner}
        keyboardShouldPersistTaps="handled"
      >
        <View className="min-h-full w-full px-5 pb-28 pt-5">
          <View className="mb-5 w-full">
            <ProfileSwitcher mode="compact" />
            <Text
              className="mt-2 text-right text-base font-extrabold text-slate-700 dark:text-slate-200"
              style={rtl.text}
            >
              {activeProfile?.displayName ?? ''}
            </Text>
          </View>

          <View className="rounded-lg bg-slate-900 p-[22px] dark:bg-dark-surface">
            <FeatureGate feature="SavingsTracker">
              <Text className="text-right text-[34px] font-black text-white" style={rtl.text}>
              ₪0 נחסך
            </Text>
            </FeatureGate>
            <Text className="mt-1.5 text-right text-[15px] text-slate-300" style={rtl.text}>
              החיסכון שלך עד עכשיו
            </Text>
          </View>

          <View className="mt-4 rounded-lg border border-slate-300 bg-white p-[18px] dark:border-neutral-700 dark:bg-dark-surface">
            <Text
              className="text-right text-lg font-extrabold text-slate-900 dark:text-white"
              style={rtl.text}
            >
              טיפ היום
            </Text>
            <Text
              className="mt-2 text-right text-base leading-6 text-slate-700 dark:text-slate-200"
              style={rtl.text}
            >
              {getDailyTip()}
            </Text>
          </View>

          <View className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-[18px] dark:border-sky-900 dark:bg-sky-950">
            <Text
              className="text-right text-lg font-extrabold text-slate-900 dark:text-white"
              style={rtl.text}
            >
              חיובים קרובים
            </Text>
            <Text
              className="mt-2 text-right text-base font-bold text-sky-700 dark:text-sky-200"
              style={rtl.text}
            >
              {upcomingObligationsCount === 0
                ? 'אין חיובים קרובים 📅'
                : `יש ${upcomingObligationsCount} חיובים קרובים`}
            </Text>
          </View>

          <FeatureGate feature="InternationalTravel">
            <View className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-[18px] opacity-45 dark:border-orange-900 dark:bg-orange-950">
              <Text
                className="text-right text-lg font-extrabold text-orange-800 dark:text-orange-200"
                style={rtl.text}
              >
                נוסעים לחו"ל? ✈️
              </Text>
              <Text
                className="mt-2 text-right text-[15px] leading-[22px] text-orange-800 dark:text-orange-200"
                style={rtl.text}
              >
                בקרוב תוכלו לבדוק מראש איזה כרטיס עדיף לנסיעות ולחיובים במט"ח.
              </Text>
          </View>
        </FeatureGate>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-dark-surface">
        <Pressable
          accessibilityRole="button"
          className="min-h-[50px] items-center justify-center rounded-lg bg-blue-600"
          onPress={handleCheckPurchase}
        >
          <Text className="text-center text-base font-extrabold text-white" style={rtl.text}>
            בדוק רכישה
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
