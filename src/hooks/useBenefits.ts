import { useMemo } from 'react';

import {
  calculateMissedSavings,
  findBestCard,
} from '../engines/benefitsMatcher';
import { CARD_RATES_BENEFITS_DB } from './useCardRatesDatabase';
import { useCardsStore } from '../store/useCardsStore';
import type {
  BenefitCategoryGroup,
  BenefitMatch,
  BenefitsOverview,
  SavingsOverview,
  Transaction,
} from '../types/benefits.types';

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1_000;

function isWithinLastThirtyDays(
  transaction: Transaction,
  now: number,
): boolean {
  const transactionTime = Date.parse(transaction.date);
  return (
    Number.isFinite(transactionTime) &&
    transactionTime <= now &&
    transactionTime >= now - THIRTY_DAYS_IN_MS
  );
}

function groupMatches(
  matches: readonly BenefitMatch[],
): BenefitCategoryGroup[] {
  const grouped = new Map<string, BenefitMatch[]>();

  matches.forEach((match: BenefitMatch): void => {
    const existing = grouped.get(match.benefit.category) ?? [];
    if (
      !existing.some(
        (item: BenefitMatch): boolean =>
          item.benefit.description === match.benefit.description,
      )
    ) {
      existing.push(match);
      grouped.set(match.benefit.category, existing);
    }
  });

  return Array.from(grouped.entries()).map(
    ([category, categoryMatches]: [string, BenefitMatch[]]):
      BenefitCategoryGroup => ({
      category,
      matches: categoryMatches,
    }),
  );
}

export function useBenefitsOverview(): BenefitsOverview {
  const cards = useCardsStore(state => state.cards);
  const transactions = useCardsStore(state => state.transactions);
  const activeCard = cards.find(card => card.isActive) ?? null;

  const groups = useMemo<readonly BenefitCategoryGroup[]>(() => {
    if (activeCard === null) {
      return [];
    }

    const matches = transactions.flatMap(
      (transaction: Transaction): BenefitMatch[] =>
        findBestCard([activeCard], transaction, CARD_RATES_BENEFITS_DB),
    );
    return groupMatches(matches);
  }, [activeCard, transactions]);

  return {
    activeCard,
    groups,
    isLoading: false,
  };
}

export function useSavingsOverview(): SavingsOverview {
  const cards = useCardsStore(state => state.cards);
  const allTransactions = useCardsStore(state => state.transactions);

  return useMemo<SavingsOverview>(() => {
    const now = Date.now();
    const transactions = allTransactions.filter(
      (transaction: Transaction): boolean =>
        isWithinLastThirtyDays(transaction, now),
    );
    const missedSavings = calculateMissedSavings(
      cards,
      transactions,
      CARD_RATES_BENEFITS_DB,
    );
    const totalSaved = transactions.reduce(
      (total: number, transaction: Transaction): number => {
        const usedCardMatch = findBestCard(
          cards.filter(card => card.cardId === transaction.cardId),
          transaction,
          CARD_RATES_BENEFITS_DB,
        )[0];
        return total + (usedCardMatch?.estimatedSaving ?? 0);
      },
      0,
    );

    return {
      totalSaved,
      missedSavings,
      transactions,
    };
  }, [allTransactions, cards]);
}
