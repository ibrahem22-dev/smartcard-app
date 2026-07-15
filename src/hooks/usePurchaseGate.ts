import { useCallback, useMemo, useState } from 'react';

import { evaluatePurchase } from '../engines/purchaseGate';
import {
  getEffectiveFxCommission,
  recommendCard,
} from '../engines/cardRoleEngine';
import { useCardsStore } from '../store/useCardsStore';
import { useUserStore } from '../store/useUserStore';
import type { CardInput } from '../types/card.types';
import type {
  DecisionVerdict,
  FxComparisonRow,
  PurchaseDecision,
  PurchaseGateInput,
  UsePurchaseGateResult,
} from '../types/decision.types';
import type { Obligation } from '../types/cashflow.types';
import {
  Currency,
  PurchaseCategory,
  type PurchaseInput,
} from '../types/purchase.types';
import { mapImportedInstallmentsToObligations } from './mapImportedInstallmentsToObligations';

export { mapImportedInstallmentsToObligations } from './mapImportedInstallmentsToObligations';

const EMPTY_FX_COMPARISON: readonly FxComparisonRow[] = [];
const NO_CARDS_DECISION: PurchaseDecision = {
  verdict: 'blocked',
  reason: 'לא נמצאו כרטיסים — הוסף כרטיס תחילה',
  reasonAr: 'لم يتم العثور على بطاقات — أضف بطاقة أولا',
  recommendedCard: null,
  savingsAmount: 0,
  currency: Currency.ILS,
};

function buildPurchaseInput(
  amount: number,
  isInternational: boolean,
  cardId: string,
): PurchaseInput {
  return {
    purchaseId: 'manual-purchase-check',
    amount,
    currency: Currency.ILS,
    category: PurchaseCategory.Other,
    date: new Date().toISOString().slice(0, 10),
    cardId,
    merchantName: 'בדיקת רכישה',
    isEssential: false,
    isInternational,
    isInstallment: false,
    installmentPlan: null,
  };
}

export type UsePurchaseGateWithCardSelection = UsePurchaseGateResult & {
  readonly selectedCardId: string;
  readonly setSelectedCardId: (cardId: string) => void;
  readonly cards: readonly CardInput[];
};

export function usePurchaseGate(): UsePurchaseGateWithCardSelection {
  const profile = useUserStore(state => state.profile);
  const cards = useCardsStore(state => state.cards);
  const storeObligations = useCardsStore(state => state.obligations);
  const [amount, setAmount] = useState<number>(0);
  const [isInternational, setIsInternational] = useState<boolean>(false);
  const [decision, setDecision] = useState<PurchaseDecision | null>(null);
  const [selectedCardIdState, setSelectedCardId] = useState<string | null>(null);

  const selectedCardId =
    selectedCardIdState !== null &&
    cards.some((card: CardInput): boolean => card.cardId === selectedCardIdState)
      ? selectedCardIdState
      : (cards[0]?.cardId ?? '');

  const obligations = useMemo(
    (): readonly Obligation[] =>
      mapImportedInstallmentsToObligations(storeObligations, cards),
    [storeObligations, cards],
  );

  const gateInput = useMemo<PurchaseGateInput>(
    (): PurchaseGateInput => ({
      snapshotDate: new Date().toISOString(),
      currentBalance: profile?.currentBalance ?? 0,
      remainingBalance: profile?.currentBalance ?? 0,
      monthlyIncome: profile?.monthlyIncome ?? 0,
      obligations,
      lastPurchaseDate: null,
      availableCards: cards,
    }),
    [cards, obligations, profile?.currentBalance, profile?.monthlyIncome],
  );

  // International FX-commission comparison. Currency defaults to USD (the most
  // common foreign currency for Israeli users) since the gate has no currency
  // picker yet — a future enhancement can pass the real purchase currency.
  const fxComparison = useMemo<readonly FxComparisonRow[]>(() => {
    if (!isInternational) {
      return EMPTY_FX_COMPARISON;
    }
    const cardsWithRates = cards.filter(card => card.cardRates !== undefined);
    if (cardsWithRates.length < 2) {
      return EMPTY_FX_COMPARISON;
    }
    const recommendation =
      profile === null
        ? null
        : recommendCard(
            cardsWithRates,
            PurchaseCategory.Other,
            profile,
            true,
            Currency.USD,
          );

    return cardsWithRates
      .map((card): FxComparisonRow => ({
        cardId: card.cardId,
        displayName: card.displayName,
        commission: getEffectiveFxCommission(card, Currency.USD),
      }))
      .sort((a, b): number => {
        const commissionDifference = a.commission - b.commission;
        if (commissionDifference !== 0) {
          return commissionDifference;
        }
        if (a.cardId === recommendation?.card.cardId) {
          return -1;
        }
        if (b.cardId === recommendation?.card.cardId) {
          return 1;
        }
        return 0;
      });
  }, [cards, isInternational, profile]);

  const evaluate = useCallback((): DecisionVerdict => {
    if (cards.length === 0) {
      setDecision(NO_CARDS_DECISION);
      return NO_CARDS_DECISION.verdict;
    }

    const result = evaluatePurchase(
      buildPurchaseInput(amount, isInternational, selectedCardId),
      gateInput,
    );
    setDecision(result);

    return result.verdict;
  }, [amount, cards.length, gateInput, isInternational, selectedCardId]);

  return {
    amount,
    setAmount,
    isInternational,
    setIsInternational,
    selectedCardId,
    setSelectedCardId,
    cards,
    verdict: decision?.verdict ?? null,
    decision,
    exchangeFeeWarning: decision?.exchangeFeeWarning ?? null,
    fxComparison,
    evaluate,
  };
}
