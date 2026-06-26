import { useMemo } from 'react';

import {
  calculateMonthlyRisk,
  getDailyProjection,
} from '../engines/cashflowRadar';
import { useCardsStore } from '../store/useCardsStore';
import { useUserStore } from '../store/useUserStore';
import type { CardInput } from '../types/card.types';
import type {
  CashflowCalendarCharge,
  DayBalance,
  MonthInput,
  Obligation,
  RiskScore,
} from '../types/cashflow.types';
import { ObligationType } from '../types/cashflow.types';
import { Currency, PurchaseCategory } from '../types/purchase.types';

const WINDOW_DAYS = 30;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getNextBillingDate(dayOfMonth: number, today: Date): Date {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const currentMonthDay = Math.min(dayOfMonth, getDaysInMonth(year, month));
  const currentCandidate = new Date(Date.UTC(year, month - 1, currentMonthDay));
  const todayStart = new Date(Date.UTC(year, month - 1, today.getUTCDate()));

  if (currentCandidate.getTime() >= todayStart.getTime()) {
    return currentCandidate;
  }

  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const nextYear = nextMonthDate.getUTCFullYear();
  const nextMonth = nextMonthDate.getUTCMonth() + 1;
  const nextMonthDay = Math.min(dayOfMonth, getDaysInMonth(nextYear, nextMonth));

  return new Date(Date.UTC(nextYear, nextMonth - 1, nextMonthDay));
}

function buildCardObligation(card: CardInput): Obligation {
  return {
    obligationId: `card-billing-${card.cardId}`,
    type: ObligationType.CardBilling,
    amount: card.framework.currentBalance,
    dayOfMonth: card.billingCycle.billingDayOfMonth,
    description: card.displayName,
    category: PurchaseCategory.Other,
    cardId: card.cardId,
  };
}

function buildMonthInput(
  obligations: readonly Obligation[],
  openingBalance: number,
  monthlyIncome: number,
  dangerThreshold: number,
  today: Date,
): MonthInput {
  return {
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
    currency: Currency.ILS,
    openingBalance,
    monthlyIncome,
    incomeDayOfMonth: 1,
    obligations,
    dangerThreshold,
  };
}

function groupChargesByDate(
  charges: readonly CashflowCalendarCharge[],
): readonly CashflowCalendarCharge[] {
  const grouped = new Map<string, CashflowCalendarCharge>();

  charges.forEach((charge: CashflowCalendarCharge): void => {
    const existing = grouped.get(charge.date);

    if (existing === undefined) {
      grouped.set(charge.date, charge);
      return;
    }

    grouped.set(charge.date, {
      date: charge.date,
      cardName: `${existing.cardName}, ${charge.cardName}`,
      amount: existing.amount + charge.amount,
      riskLevel: Math.max(existing.riskLevel, charge.riskLevel),
    });
  });

  return Array.from(grouped.values()).sort(
    (left: CashflowCalendarCharge, right: CashflowCalendarCharge): number =>
      left.date.localeCompare(right.date),
  );
}

export function useCashflowCalendar(): readonly CashflowCalendarCharge[] {
  const cards = useCardsStore(state => state.cards);
  const profile = useUserStore(state => state.profile);

  return useMemo((): readonly CashflowCalendarCharge[] => {
    const obligations = cards
      .filter((card: CardInput): boolean => card.framework.currentBalance > 0)
      .map((card: CardInput): Obligation => buildCardObligation(card));

    if (obligations.length === 0) {
      return [];
    }

    const today = new Date();
    const openingBalance = profile?.currentBalance ?? 0;
    const monthlyIncome = profile?.monthlyIncome ?? 0;
    const dangerThreshold = profile?.dangerThreshold ?? 0;
    const month = buildMonthInput(
      obligations,
      openingBalance,
      monthlyIncome,
      dangerThreshold,
      today,
    );
    const projection: readonly DayBalance[] = getDailyProjection(month);
    const monthlyRisk: RiskScore = calculateMonthlyRisk(month);
    const windowEnd = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() + WINDOW_DAYS,
      ),
    );

    void projection;

    const charges = cards
      .filter((card: CardInput): boolean => card.framework.currentBalance > 0)
      .map((card: CardInput): CashflowCalendarCharge => ({
        date: toIsoDate(getNextBillingDate(card.billingCycle.billingDayOfMonth, today)),
        cardName: card.displayName,
        amount: card.framework.currentBalance,
        riskLevel: monthlyRisk.score,
      }))
      .filter((charge: CashflowCalendarCharge): boolean =>
        new Date(`${charge.date}T00:00:00.000Z`).getTime() < windowEnd.getTime(),
      );

    return groupChargesByDate(charges);
  }, [
    cards,
    profile?.currentBalance,
    profile?.dangerThreshold,
    profile?.monthlyIncome,
  ]);
}
