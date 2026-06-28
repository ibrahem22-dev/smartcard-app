import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { usePurchaseGate } from '../hooks/usePurchaseGate';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { PurchaseGateStackParamList } from '../navigation/types';
import { useCardsStore } from '../store/useCardsStore';
import type { DecisionVerdict } from '../types/decision.types';
import { parseAmount } from '../utils/parseAmount';
import { inputStyle, rtl } from '../utils/rtlStyles';

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
  const { t } = useTranslation();
  const navigation = useNavigation<PurchaseGateNavigation>();
  const hasCards = useCardsStore(state => state.cards.length > 0);
  const {
    setAmount,
    isInternational,
    setIsInternational,
    verdict,
    decision,
    exchangeFeeWarning,
    fxComparison,
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
    navigation.navigate('Decision', {
      verdict: nextVerdict,
      fxComparison,
    });
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
            <AppText
              className="text-3xl font-extrabold text-slate-900 dark:text-slate-50"
              style={[
                {
                  textDecorationColor: theme.bankColor,
                  textDecorationLine: 'underline',
                },
              ]}
            >
              {t('בדיקת רכישה')}
            </AppText>
            <AppText
              className="mt-1.5 text-base leading-6 text-slate-600 dark:text-slate-300"
            >
              {t('בדקו אם הרכישה מתאימה לתזרים הנוכחי.')}
            </AppText>
          </View>

          {hasCards ? (
            <>
              <View
                accessibilityRole="tablist"
                className="mb-6 flex-row gap-2 rounded-lg bg-slate-200 p-1 dark:bg-neutral-800 rtl:flex-row"
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
                  <AppText
                    className={`text-center text-base font-bold ${ !isInternational ? 'text-slate-900 dark:text-slate-50' : 'text-slate-600 dark:text-slate-300' }`}
                  >
                    {t('בארץ 🇮🇱')}
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isInternational }}
                  className={`min-h-11 flex-1 items-center justify-center rounded-md ${
                    isInternational ? 'bg-white dark:bg-neutral-700' : ''
                  }`}
                  onPress={(): void => setIsInternational(true)}
                >
                  <AppText
                    className={`text-center text-base font-bold ${ isInternational ? 'text-slate-900 dark:text-slate-50' : 'text-slate-600 dark:text-slate-300' }`}
                  >
                    {t('חו"ל ✈️')}
                  </AppText>
                </Pressable>
              </View>

              <View className="mb-5 w-full">
                <AppText
                  className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200"
                >
                  {t('סכום הרכישה')}
                </AppText>
                <View
                  className="min-h-[54px] flex-row items-center rounded-lg border border-slate-300 bg-white px-3.5 dark:border-neutral-700 dark:bg-dark-surface rtl:flex-row"
                  style={rtl.row}
                >
                  <AppText
                    className="ms-2 text-xl font-extrabold text-slate-900 dark:text-slate-50"
                  >
                    ₪
                  </AppText>
                  <TextInput
                    accessibilityLabel={t('סכום הרכישה')}
                    className="min-h-[52px] flex-1 p-0 text-xl text-slate-900 dark:text-slate-50"
                    keyboardType="numeric"
                    onChangeText={handleAmountChange}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    style={inputStyle()}
                    value={amountText}
                  />
                </View>
                {isAmountInvalid ? (
                  <AppText
                    className="mt-1.5 text-sm font-bold text-red-600 dark:text-red-300"
                  >
                    {t('סכום לא תקין')}
                  </AppText>
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
                style={
                  isSubmitDisabled
                    ? undefined
                    : { backgroundColor: theme.companyAccent }
                }
              >
                <AppText
                  className="text-center text-base font-extrabold text-white"
                >
                  {t('בדוק רכישה')}
                </AppText>
              </Pressable>
            </>
          ) : (
            <View className="rounded-lg border border-amber-300 bg-amber-50 p-[18px] dark:border-amber-800 dark:bg-amber-950">
              <AppText
                className="text-lg font-extrabold text-amber-900 dark:text-amber-100"
              >
                {t('לא נמצאו כרטיסים — הוסף כרטיס תחילה')}
              </AppText>
            </View>
          )}

          <View className="mt-6 min-h-[150px] w-full">
            {verdictClass === null || decision === null ? (
              <AppText
                className="rounded-lg border border-slate-300 bg-white p-[18px] text-base leading-6 text-slate-500 dark:border-neutral-700 dark:bg-dark-surface dark:text-slate-300"
              >
                {t('ההחלטה תופיע כאן אחרי הבדיקה.')}
              </AppText>
            ) : (
              <View className={`rounded-lg border p-[18px] ${verdictClass.banner}`}>
                <AppText
                  className="text-xl font-extrabold text-slate-900 dark:text-slate-50"
                >
                  {t(verdictClass.title)}
                </AppText>
                <AppText
                  className="mt-1.5 text-base leading-6 text-slate-800 dark:text-slate-100"
                >
                  {t(decision.reason)}
                </AppText>
              </View>
            )}

            {shouldShowExchangeWarning ? (
              <AppText
                className="mt-3 rounded-lg bg-orange-50 p-3.5 text-sm leading-5 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
              >
                {t(exchangeFeeWarning)}
              </AppText>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
