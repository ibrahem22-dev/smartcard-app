import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../components/AppText';
import { useSavingsOverview } from '../hooks/useBenefits';
import { useTranslation } from '../hooks/useTranslation';
import type { MissedSavingRow } from '../types/benefits.types';
import { rtl } from '../utils/rtlStyles';

function formatShekels(value: number): string {
  return `${value.toLocaleString('he-IL', {
    maximumFractionDigits: 2,
  })} ₪`;
}

export function SavingsTrackerScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { totalSaved, missedSavings, transactions } = useSavingsOverview();

  return (
    <SafeAreaView
      className="flex-1 bg-slate-50 dark:bg-app-dark"
      style={rtl.screen}
    >
      <ScrollView
        contentContainerStyle={rtl.scrollInner}
        style={rtl.scrollOuter}
      >
        <View className="min-h-full w-full p-5">
          <AppText className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">
            {t('מעקב חיסכון')}
          </AppText>
          <AppText className="mt-1.5 text-base text-slate-600 dark:text-slate-300">
            {t('סיכום 30 הימים האחרונים')}
          </AppText>

          <View className="mt-6 gap-3">
            <View className="rounded-lg border border-green-200 bg-green-50 p-5 shadow-sm dark:border-green-900 dark:bg-green-950">
              <AppText className="text-sm font-bold text-green-800 dark:text-green-200">
                {t('נחסך החודש')}
              </AppText>
              <AppText className="mt-1 text-3xl font-black text-green-700 dark:text-green-300">
                {formatShekels(totalSaved)}
              </AppText>
            </View>
            <View className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900 dark:bg-amber-950">
              <AppText className="text-sm font-bold text-amber-800 dark:text-amber-200">
                {t('חיסכון שהתפספס החודש')}
              </AppText>
              <AppText className="mt-1 text-3xl font-black text-amber-700 dark:text-amber-300">
                {formatShekels(missedSavings.totalMissed)}
              </AppText>
            </View>
          </View>

          {transactions.length === 0 ? (
            <View className="mt-6 min-h-40 items-center justify-center rounded-lg border border-slate-300 bg-white p-5 dark:border-neutral-700 dark:bg-dark-surface">
              <AppText className="text-center text-lg font-extrabold text-slate-700 dark:text-slate-200">
                {t('אין עסקאות ב-30 הימים האחרונים')}
              </AppText>
              <AppText className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('כאן יופיע פירוט החיסכון לפי עסקה.')}
              </AppText>
            </View>
          ) : missedSavings.breakdown.length === 0 ? (
            <View className="mt-6 rounded-lg border border-green-200 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950">
              <AppText className="text-center text-base font-bold text-green-800 dark:text-green-200">
                {t('לא נמצא חיסכון שהתפספס')}
              </AppText>
            </View>
          ) : (
            <View className="mt-6 gap-3">
              <AppText className="text-xl font-extrabold text-slate-900 dark:text-slate-50">
                {t('פירוט לפי עסקה')}
              </AppText>
              {missedSavings.breakdown.map(
                (row: MissedSavingRow): React.ReactElement => (
                  <View
                    className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-dark-surface"
                    key={row.transaction.purchaseId}
                  >
                    <View
                      className="flex-row items-center justify-between"
                      style={rtl.row}
                    >
                      <View className="me-3 flex-1">
                        <AppText className="font-extrabold text-slate-900 dark:text-slate-50">
                          {row.transaction.merchantName}
                        </AppText>
                        <AppText className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {t('עדיף היה להשתמש ב-{{cardName}}', {
                            cardName: row.bestCard.displayName,
                          })}
                        </AppText>
                      </View>
                      <AppText className="font-extrabold text-amber-700 dark:text-amber-300">
                        {formatShekels(row.missedAmount)}
                      </AppText>
                    </View>
                  </View>
                ),
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
