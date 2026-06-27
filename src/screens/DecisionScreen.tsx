import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { FeatureGate } from '../components/FeatureGate';
import { useTheme } from '../hooks/useTheme';
import type { PurchaseGateStackParamList } from '../navigation/types';
import type { DecisionVerdict } from '../types/decision.types';
import { rtl } from '../utils/rtlStyles';

type DecisionScreenProps = NativeStackScreenProps<
  PurchaseGateStackParamList,
  'Decision'
>;

const VERDICT_LABELS: Record<DecisionVerdict, string> = {
  approved: 'אושר ✓',
  warning: 'שים לב ⚠️',
  blocked: 'נחסם ✗',
  wait_24h: 'המתן 24 שעות ⏳',
};

const VERDICT_REASONS: Record<DecisionVerdict, string> = {
  approved: 'הרכישה נראית מתאימה לתזרים הנוכחי.',
  warning: 'אפשר לבצע את הרכישה, אבל כדאי לשים לב למרווח הביטחון.',
  blocked: 'הרכישה עלולה לסכן את התזרים או את מסגרת האשראי.',
  wait_24h: 'הרכישה אינה דחופה ומומלץ להמתין לפני קבלת החלטה.',
};

const VERDICT_CLASSES: Record<DecisionVerdict, string> = {
  approved: 'bg-green-100 border-green-600 dark:bg-green-950 dark:border-green-500',
  warning: 'bg-amber-100 border-amber-600 dark:bg-amber-950 dark:border-amber-500',
  blocked: 'bg-red-100 border-red-600 dark:bg-red-950 dark:border-red-500',
  wait_24h: 'bg-orange-100 border-orange-500 dark:bg-orange-950 dark:border-orange-400',
};

export function DecisionScreen({
  navigation,
  route,
}: DecisionScreenProps): React.ReactElement {
  const theme = useTheme();
  const verdict = route.params.verdict;

  return (
    <View style={[rtl.screen, { backgroundColor: '#F8FAFC' }]}>
      <ScrollView
        contentContainerStyle={rtl.scrollInner}
        style={rtl.scrollOuter}
      >
      <View className="min-h-full w-full p-5 dark:bg-neutral-950">
        <View className={`rounded-lg border p-5 ${VERDICT_CLASSES[verdict]}`}>
          <Text
            className="text-right text-3xl font-extrabold text-slate-900 dark:text-slate-50"
            style={rtl.text}
          >
            {VERDICT_LABELS[verdict]}
          </Text>
          <Text
            className="mt-2.5 text-right text-base leading-6 text-slate-800 dark:text-slate-100"
            style={rtl.text}
          >
            {VERDICT_REASONS[verdict]}
          </Text>
        </View>

        <FeatureGate feature="ScoreSection">
          <View className="mt-5 rounded-lg border border-slate-300 bg-white p-[18px] opacity-45 dark:border-neutral-700 dark:bg-neutral-900">
            <Text
              className="mb-3 text-right text-lg font-extrabold text-slate-900 dark:text-slate-50"
              style={rtl.text}
            >
              ניקוד כרטיסים
            </Text>
            <View
              className="min-h-[38px] flex-row-reverse items-center justify-between border-t border-slate-200 rtl:flex-row-reverse dark:border-neutral-700"
              style={rtl.row}
            >
              <Text
                className="text-right text-base text-slate-700 dark:text-slate-200"
                style={rtl.text}
              >
                כרטיס מוביל
              </Text>
              <Text
                className="text-right text-base font-extrabold text-slate-900 dark:text-slate-50"
                style={rtl.text}
              >
                84/100
              </Text>
            </View>
            <View
              className="min-h-[38px] flex-row-reverse items-center justify-between border-t border-slate-200 rtl:flex-row-reverse dark:border-neutral-700"
              style={rtl.row}
            >
              <Text
                className="text-right text-base text-slate-700 dark:text-slate-200"
                style={rtl.text}
              >
                כרטיס חלופי
              </Text>
              <Text
                className="text-right text-base font-extrabold text-slate-900 dark:text-slate-50"
                style={rtl.text}
              >
                71/100
              </Text>
            </View>
          </View>
        </FeatureGate>

        <View className="min-h-8 flex-1" />

        <Pressable
          accessibilityRole="button"
          className="min-h-[50px] items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100"
          onPress={(): void => navigation.navigate('Contact')}
        >
          <Text
            className="text-center text-base font-extrabold text-white dark:text-slate-900"
            style={rtl.text}
          >
            יש לך בעיה?
          </Text>
        </Pressable>
      </View>
      </ScrollView>
    </View>
  );
}
