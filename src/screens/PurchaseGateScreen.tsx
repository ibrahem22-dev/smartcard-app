import React, { useState } from 'react';
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
import { useTheme } from '../hooks/useTheme';
import type { PurchaseGateStackParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';
import type { DecisionVerdict } from '../types/decision.types';
import { parseAmount } from '../utils/parseAmount';
import { rtl } from '../utils/rtlStyles';

type PurchaseGateNavigation = NativeStackNavigationProp<
  PurchaseGateStackParamList,
  'PurchaseGateRoot'
>;

const VERDICT_CLASSES: Record<
  DecisionVerdict,
  {
    readonly banner: string;
    readonly title: string;
  }
> = {
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
    title: 'להמתין 24 שעות',
  },
};

export function PurchaseGateScreen(): React.ReactElement {
  const theme = useTheme();
  const navigation = useNavigation<PurchaseGateNavigation>();
  const hasCards = useCardsStore(state => state.cards.length > 0);
  const {
    setAmount,
    isInternational,
    setIsInternational,
    verdict,
    decision,
    exchangeFeeWarning,
    evaluate,
  } = usePurchaseGate();
  const [amountText, setAmountText] = useState('');

  const parsedAmount = parseAmount(amountText);
  const isAmountInvalid = amountText.trim().length > 0 && parsedAmount === null;
  const isSubmitDisabled = parsedAmount === null;
  const verdictClass = verdict === null ? null : VERDICT_CLASSES[verdict];
  const shouldShowExchangeWarning =
    isInternational &&
    (verdict === 'approved' || verdict === 'warning') &&
    exchangeFeeWarning !== null;

  function handleEvaluate(): void {
    if (parsedAmount === null) {
      return;
    }

    setAmount(parsedAmount);
    const nextVerdict = evaluate();
    navigation.navigate('Decision', { verdict: nextVerdict });
  }

  function handleAmountChange(value: string): void {
    setAmountText(value);

    const nextAmount = parseAmount(value);
    if (nextAmount !== null) {
      setAmount(nextAmount);
    }
  }

  return (
    <View
      className="flex-1 bg-slate-50 dark:bg-app-dark"
      style={rtl.screen}
    >
      <ScrollView
        contentContainerStyle={rtl.scrollInner}
        keyboardShouldPersistTaps="handled"
        style={rtl.scrollOuter}
      >
        <View className="min-h-full w-full p-5 dark:bg-app-dark">
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

          {hasCards ? (
            <>
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
                  className="min-h-[54px] flex-row-reverse items-center rounded-lg border border-slate-300 bg-white px-3.5 dark:border-neutral-700 dark:bg-dark-surface rtl:flex-row-reverse"
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
                    onChangeText={handleAmountChange}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    style={rtl.input}
                    value={amountText}
                  />
                </View>
                {isAmountInvalid ? (
                  <Text
                    className="mt-1.5 text-right text-sm font-bold text-red-600 dark:text-red-300"
                    style={rtl.text}
                  >
                    סכום לא תקין
                  </Text>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmitDisabled }}
                className={`min-h-[50px] items-center justify-center rounded-lg ${
                  isSubmitDisabled ? 'bg-slate-300 dark:bg-neutral-700' : 'bg-blue-600'
                }`}
                disabled={isSubmitDisabled}
                onPress={handleEvaluate}
              >
                <Text
                  className="text-center text-base font-extrabold text-white"
                  style={rtl.text}
                >
                  בדוק רכישה
                </Text>
              </Pressable>
            </>
          ) : (
            <View className="rounded-lg border border-amber-300 bg-amber-50 p-[18px] dark:border-amber-800 dark:bg-amber-950">
              <Text
                className="text-right text-lg font-extrabold text-amber-900 dark:text-amber-100"
                style={rtl.text}
              >
                לא נמצאו כרטיסים — הוסף כרטיס תחילה
              </Text>
            </View>
          )}

          <View className="mt-6 min-h-[150px] w-full">
            {verdictClass === null || decision === null ? (
              <Text
                className="rounded-lg border border-slate-300 bg-white p-[18px] text-right text-base leading-6 text-slate-500 dark:border-neutral-700 dark:bg-dark-surface dark:text-slate-300"
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
