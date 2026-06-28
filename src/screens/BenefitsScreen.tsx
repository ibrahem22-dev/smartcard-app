import React from 'react';
import { View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useBenefitsOverview } from '../hooks/useBenefits';
import { useTranslation } from '../hooks/useTranslation';
import type {
  BenefitCategoryGroup,
  BenefitMatch,
} from '../types/benefits.types';

const CATEGORY_ICONS: Readonly<Record<string, string>> = {
  groceries: '🛒',
  supermarket: '🛒',
  dining: '🍽️',
  fuel: '⛽',
  transport: '🚌',
  travel: '✈️',
  subscriptions: '🔁',
  education: '🎓',
  health: '🩺',
  entertainment: '🎟️',
  shopping: '🛍️',
  utilities: '💡',
  other: '✨',
};

function formatShekels(value: number): string {
  return `${value.toLocaleString('he-IL', {
    maximumFractionDigits: 2,
  })} ₪`;
}

function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? '✨';
}

export function BenefitsScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { activeCard, groups, isLoading } = useBenefitsOverview();

  return (
    <RtlScreen safe className="bg-slate-50 dark:bg-app-dark">
      <RtlScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
        <View className="min-h-full w-full p-5">
          <AppText className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">
            {t('הטבות לכרטיס')}
          </AppText>
          <AppText className="mt-1.5 text-base text-slate-600 dark:text-slate-300">
            {activeCard === null
              ? t('לא נמצא כרטיס פעיל')
              : t('הטבות עבור {{cardName}}', {
                  cardName: activeCard.displayName,
                })}
          </AppText>

          {isLoading ? (
            <View className="mt-6 min-h-40 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 p-5 shadow-sm dark:border-sky-900 dark:bg-sky-950">
              <AppText className="text-center text-lg font-extrabold text-sky-800 dark:text-sky-100">
                {t('נתונים בטעינה')}
              </AppText>
              <AppText className="mt-2 text-center text-sm text-sky-700 dark:text-sky-200">
                {t('ההטבות יוצגו כאן כשמאגר ההטבות יהיה זמין.')}
              </AppText>
            </View>
          ) : groups.length === 0 ? (
            <View className="mt-6 min-h-40 items-center justify-center rounded-lg border border-slate-300 bg-white p-5 dark:border-neutral-700 dark:bg-dark-surface">
              <AppText className="text-center text-base text-slate-600 dark:text-slate-300">
                {t('לא נמצאו הטבות מתאימות')}
              </AppText>
            </View>
          ) : (
            <View className="mt-6 gap-4">
              {groups.map(
                (group: BenefitCategoryGroup): React.ReactElement => (
                  <View
                    className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-dark-surface"
                    key={group.category}
                  >
                    <RtlRow className="items-center gap-2">
                      <AppText className="text-2xl">
                        {categoryIcon(group.category)}
                      </AppText>
                      <AppText className="text-lg font-extrabold text-slate-900 dark:text-slate-50">
                        {t(group.category)}
                      </AppText>
                    </RtlRow>
                    {group.matches.map(
                      (match: BenefitMatch): React.ReactElement => (
                        <RtlRow
                          className="mt-3 items-center justify-between border-t border-slate-200 pt-3 dark:border-neutral-700"
                          key={`${match.card.cardId}:${match.benefit.description}`}
                        >
                          <AppText className="me-3 flex-1 text-base text-slate-700 dark:text-slate-200">
                            {match.benefit.description}
                          </AppText>
                          <AppText className="font-extrabold text-green-700 dark:text-green-300">
                            {formatShekels(match.estimatedSaving)}
                          </AppText>
                        </RtlRow>
                      ),
                    )}
                  </View>
                ),
              )}
            </View>
          )}
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
