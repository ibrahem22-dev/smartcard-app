import React from 'react';
import {
  Pressable,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { FeatureGate } from '../components/FeatureGate';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { PurchaseGateStackParamList } from '../navigation/types';
import type { DecisionVerdict } from '../types/decision.types';

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

function formatCommission(value: number): string {
  return `${value.toLocaleString('he-IL', { maximumFractionDigits: 2 })}%`;
}

export function DecisionScreen({
  navigation,
  route,
}: DecisionScreenProps): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const verdict = route.params.verdict;
  const fxComparison = route.params.fxComparison ?? [];

  return (
    <RtlScreen safe className="bg-slate-50 dark:bg-app-dark">
      <RtlScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
      <View className="min-h-full w-full p-5 dark:bg-app-dark">
        <View
          className={`rounded-lg border p-5 ${VERDICT_CLASSES[verdict]}`}
          style={{ backgroundColor: theme.companyAccent }}
        >
          <AppText
            className="text-3xl font-extrabold text-slate-900 dark:text-slate-50"
            style={{ color: theme.bankColor }}
          >
            {t(VERDICT_LABELS[verdict])}
          </AppText>
          <AppText
            className="mt-2.5 text-base leading-6 text-slate-800 dark:text-slate-100"
          >
            {t(VERDICT_REASONS[verdict])}
          </AppText>
        </View>

        <FeatureGate feature="ScoreSection">
          <View className="mt-5 rounded-lg border border-slate-300 bg-white p-[18px] opacity-45 dark:border-neutral-700 dark:bg-dark-surface">
            <AppText
              className="mb-3 text-lg font-extrabold text-slate-900 dark:text-slate-50"
            >
              {t('ניקוד כרטיסים')}
            </AppText>
            <RtlRow className="min-h-[38px] items-center justify-between border-t border-slate-200 dark:border-neutral-700">
              <AppText
                className="text-base text-slate-700 dark:text-slate-200"
              >
                {t('כרטיס מוביל')}
              </AppText>
              <AppText
                className="text-base font-extrabold text-slate-900 dark:text-slate-50"
              >
                84/100
              </AppText>
            </RtlRow>
            <RtlRow className="min-h-[38px] items-center justify-between border-t border-slate-200 dark:border-neutral-700">
              <AppText
                className="text-base text-slate-700 dark:text-slate-200"
              >
                {t('כרטיס חלופי')}
              </AppText>
              <AppText
                className="text-base font-extrabold text-slate-900 dark:text-slate-50"
              >
                71/100
              </AppText>
            </RtlRow>
          </View>
        </FeatureGate>

        {fxComparison.length > 0 ? (
          <View className="mt-5 rounded-lg border border-slate-300 bg-white p-[18px] dark:border-neutral-700 dark:bg-dark-surface">
            <AppText className="mb-3 text-lg font-extrabold text-slate-900 dark:text-slate-50">
              {t('השוואת עמלות המרה')}
            </AppText>
            {fxComparison.map((rowItem, index): React.ReactElement => {
              const isLowest = index === 0;
              return (
                <RtlRow
                  className={`min-h-[44px] items-center justify-between rounded-md border px-2 ${
                    isLowest
                      ? 'border-green-500 bg-green-50 shadow-sm dark:border-green-600 dark:bg-green-950'
                      : 'border-transparent border-t-slate-200 dark:border-t-neutral-700'
                  }`}
                  key={rowItem.cardId}
                >
                  <AppText
                    className={`text-base ${
                      isLowest
                        ? 'font-extrabold text-green-700 dark:text-green-200'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {rowItem.displayName}
                    {isLowest ? ` · ${t('הזול ביותר')}` : ''}
                  </AppText>
                  <AppText
                    className={`text-base font-extrabold ${
                      isLowest
                        ? 'text-green-700 dark:text-green-200'
                        : 'text-slate-900 dark:text-slate-50'
                    }`}
                  >
                    {formatCommission(rowItem.commission)}
                  </AppText>
                </RtlRow>
              );
            })}
          </View>
        ) : null}

        <View className="min-h-8 flex-1" />

        <Pressable
          accessibilityRole="button"
          className="min-h-[50px] items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100"
          onPress={(): void => navigation.navigate('Contact')}
        >
          <AppText
            className="text-center text-base font-extrabold text-white dark:text-slate-900"
          >
            {t('יש לך בעיה?')}
          </AppText>
        </Pressable>
      </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
