import { useNavigation, type NavigationProp } from '@react-navigation/native';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ProvenanceChip } from '../../components/ProvenanceChip';
import { useTranslation } from '../../hooks/useTranslation';
import type { TabParamList } from '../../navigation/types';
import { useCardsStore } from '../../store/useCardsStore';
import { BORDER, SURFACE, TEXT } from '../../theme/tokens';
import type { EngineCard } from '../../types/card.types';
import { ltrNumerals } from '../../utils/calendar';

export interface HomeBillingEvent {
  readonly cardId: string;
  readonly cardName: string;
  readonly date: string;
  readonly derived: boolean;
}

export interface HomeUpcomingBillingProps {
  readonly asOfDate?: string;
  readonly cards?: readonly EngineCard[];
  /** Exact dated events can retain stated provenance instead of being relabelled as estimates. */
  readonly billingEvents?: readonly HomeBillingEvent[];
}

function localToday(): string {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function isoDate(year: number, month: number, day: number): string {
  return [year, month, day]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nextBillingDate(asOfDate: string, billingDayOfMonth: number): string | null {
  if (
    !Number.isInteger(billingDayOfMonth) ||
    billingDayOfMonth < 1 ||
    billingDayOfMonth > 31
  ) {
    return null;
  }

  const [asOfYear, asOfMonth] = asOfDate.split('-').map(Number);
  if (asOfYear === undefined || asOfMonth === undefined) return null;
  const thisMonth = isoDate(
    asOfYear,
    asOfMonth,
    Math.min(billingDayOfMonth, daysInMonth(asOfYear, asOfMonth)),
  );
  if (thisMonth >= asOfDate) return thisMonth;

  const nextMonth = asOfMonth === 12 ? 1 : asOfMonth + 1;
  const nextYear = asOfMonth === 12 ? asOfYear + 1 : asOfYear;
  return isoDate(
    nextYear,
    nextMonth,
    Math.min(billingDayOfMonth, daysInMonth(nextYear, nextMonth)),
  );
}

function eventsFromCards(
  cards: readonly EngineCard[],
  asOfDate: string,
): readonly HomeBillingEvent[] {
  return cards.flatMap((card): readonly HomeBillingEvent[] => {
    const date = nextBillingDate(asOfDate, card.billingCycle.billingDayOfMonth);
    if (date === null) return [];
    return [{
      cardId: card.cardId,
      cardName: card.displayName,
      date,
      derived: true,
    }];
  });
}

export function HomeUpcomingBilling({
  asOfDate,
  cards,
  billingEvents,
}: HomeUpcomingBillingProps): React.ReactElement | null {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<TabParamList>>();
  const storedCards = useCardsStore((state) => state.cards);
  const today = asOfDate !== undefined && validIsoDate(asOfDate) ? asOfDate : localToday();
  const candidates = (billingEvents ?? eventsFromCards(cards ?? storedCards, today))
    .filter((event) => validIsoDate(event.date) && event.date >= today)
    .slice()
    .sort((left, right) =>
      left.date.localeCompare(right.date) || left.cardId.localeCompare(right.cardId),
    );
  const nearest = candidates[0];

  if (nearest === undefined) return null;

  return (
    <View
      className={`mb-4 gap-3 rounded-lg border p-4 ${BORDER.hairline} ${SURFACE.card}`}
      testID="home-upcoming-billing"
    >
      <AppText className={`text-lg font-extrabold ${TEXT.heading}`}>
        {t('מועד החיוב הקרוב')}
      </AppText>
      <Pressable
        accessibilityRole="link"
        className="min-h-[48px] gap-2 justify-center"
        onPress={() => navigation.navigate('Plan')}
        testID="home-upcoming-billing-link"
      >
        <AppText
          className={`text-base font-extrabold ${TEXT.body}`}
          testID="home-upcoming-billing-card"
        >
          {nearest.cardName}
        </AppText>
        <AppText
          accessibilityValue={{ text: nearest.date }}
          className={`text-base ${TEXT.secondary}`}
          testID="home-upcoming-billing-date"
        >
          {ltrNumerals(nearest.date)}
        </AppText>
        {nearest.derived ? (
          <ProvenanceChip
            testID="home-upcoming-billing-estimate"
            view={{ chip: 'ESTIMATE', stale: false }}
          />
        ) : null}
        <AppText className={`text-sm font-bold ${TEXT.secondary}`}>
          {t('לצפייה בתכנון')}
        </AppText>
      </Pressable>
    </View>
  );
}
