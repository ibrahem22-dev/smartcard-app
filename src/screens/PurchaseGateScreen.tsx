import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { usePurchaseGate } from '../hooks/usePurchaseGate';
import type { PurchaseGateStackParamList } from '../navigation/types';
import type { DecisionVerdict } from '../types/decision.types';
import { rtl } from '../utils/rtlStyles';

type PurchaseGateNavigation = NativeStackNavigationProp<
  PurchaseGateStackParamList,
  'PurchaseGateRoot'
>;

const VERDICT_CLASSES: Record<DecisionVerdict, {
  readonly banner: string;
  readonly title: string;
}> = {
  approved: {
    banner: 'bg-green-100 border-green-600 dark:bg-green-950 dark:border-green-500',
    title: 'מאושר',
  },
  warning: {
    banner: 'bg-amber-100 border-amber-600 dark:bg-amber-950 dark:border-amber-500',
    title: 'אזהרה',
  },
  blocked: {
    banner: 'bg-red-100 border-red-600 dark:bg-red-950 dark:border-red-500',
    title: 'חסום',
  },
  wait_24h: {
    banner: 'bg-orange-100 border-orange-500 dark:bg-orange-950 dark:border-orange-400',
    title: '⏱️ להמתין 24 שעות',
  },
};

function parseAmountInput(value: string): number {
  const normalized = value.replace(/[^\d.]/g, '');

  if (normalized.length === 0) {
    return 0;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function PurchaseGateScreen(): React.ReactElement {
  const navigation = useNavigation<PurchaseGateNavigation>();
  const {
    amount,
    setAmount,
    isInternational,
    setIsInternational,
    verdict,
    decision,
    exchangeFeeWarning,
    evaluate,
  } = usePurchaseGate();

  const amountValue = amount === 0 ? '' : String(amount);
  const verdictClass = verdict === null ? null : VERDICT_CLASSES[verdict];
  const shouldShowExchangeWarning =
    isInternational &&
    (verdict === 'approved' || verdict === 'warning') &&
    exchangeFeeWarning !== null;

  function handleEvaluate(): void {
    const nextVerdict = evaluate();
    navigation.navigate('Decision', { verdict: nextVerdict });
  }

  return (
    <View style={[rtl.screen, { backgroundColor: '#F8FAFC' }]}>
      <ScrollView
        contentContainerStyle={rtl.scrollInner}
        keyboardShouldPersistTaps="handled"
        style={rtl.scrollOuter}
      >
      <View className="min-h-full w-full p-5 dark:bg-neutral-950">
        <View className="mb-5 w-full items-stretch">
          <Text
            className="text-right text-3xl font-extrabold text-slate-900 dark:text-slate-50"
            style={rtl.text}
          >
            בדיקת רכישה
          </Text>
          <Text
            className="mt-1.5 text-right text-base leading-6 text-slate-600 dark:text-slate-300"
            style={rtl.text}
          >
            בדקו אם הרכישה מתאימה לתזרים הנוכחי.
          </Text>
        </View>

        <View
          accessibilityRole="tablist"
          className="mb-6 flex-row-reverse gap-2 rounded-lg bg-slate-200 p-1 dark:bg-neutral-800 rtl:flex-row-reverse"
          style={rtl.row}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !isInternational }}
            className={`min-h-11 flex-1 items-center justify-center rounded-md ${
              !isInternational ? 'bg-white dark:bg-neutral-700' : ''
            }`}
            onPress={(): void => setIsInternational(false)}
          >
            <Text
              className={`text-center text-base font-bold ${
                !isInternational
                  ? 'text-slate-900 dark:text-slate-50'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
              style={rtl.text}
            >
              בארץ 🇮🇱
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isInternational }}
            className={`min-h-11 flex-1 items-center justify-center rounded-md ${
              isInternational ? 'bg-white dark:bg-neutral-700' : ''
            }`}
            onPress={(): void => setIsInternational(true)}
          >
            <Text
              className={`text-center text-base font-bold ${
                isInternational
                  ? 'text-slate-900 dark:text-slate-50'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
              style={rtl.text}
            >
              חו"ל ✈️
            </Text>
          </Pressable>
        </View>

        <View className="mb-5 w-full">
          <Text
            className="mb-2 text-right text-sm font-bold text-slate-700 dark:text-slate-200"
            style={rtl.text}
          >
            סכום הרכישה
          </Text>
          <View
            className="min-h-[54px] flex-row-reverse items-center rounded-lg border border-slate-300 bg-white px-3.5 dark:border-neutral-700 dark:bg-neutral-900 rtl:flex-row-reverse"
            style={rtl.row}
          >
            <Text
              className="ms-2 text-xl font-extrabold text-slate-900 dark:text-slate-50"
              style={rtl.text}
            >
              ₪
            </Text>
            <TextInput
              accessibilityLabel="סכום הרכישה"
              className="min-h-[52px] flex-1 p-0 text-right text-xl text-slate-900 dark:text-slate-50"
              keyboardType="numeric"
              onChangeText={(value: string): void => setAmount(parseAmountInput(value))}
              placeholder="0"
              placeholderTextColor="#94A3B8"
              style={rtl.input}
              value={amountValue}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          className="min-h-[50px] items-center justify-center rounded-lg bg-blue-600"
          onPress={handleEvaluate}
        >
          <Text className="text-center text-base font-extrabold text-white" style={rtl.text}>
            בדוק רכישה
          </Text>
        </Pressable>

        <View className="mt-6 min-h-[150px] w-full">
          {verdictClass === null || decision === null ? (
            <Text
              className="rounded-lg border border-slate-300 bg-white p-[18px] text-right text-base leading-6 text-slate-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-slate-300"
              style={rtl.text}
            >
              ההחלטה תופיע כאן אחרי הבדיקה.
            </Text>
          ) : (
            <View className={`rounded-lg border p-[18px] ${verdictClass.banner}`}>
              <Text
                className="text-right text-xl font-extrabold text-slate-900 dark:text-slate-50"
                style={rtl.text}
              >
                {verdictClass.title}
              </Text>
              <Text
                className="mt-1.5 text-right text-base leading-6 text-slate-800 dark:text-slate-100"
                style={rtl.text}
              >
                {decision.reason}
              </Text>
            </View>
          )}

          {shouldShowExchangeWarning ? (
            <Text
              className="mt-3 rounded-lg bg-orange-50 p-3.5 text-right text-sm leading-5 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
              style={rtl.text}
            >
              {exchangeFeeWarning}
            </Text>
          ) : null}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}
