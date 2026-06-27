import { useCallback, useMemo, useState } from 'react';

import { evaluatePurchase } from '../engines/purchaseGate';
import { useCardsStore } from '../store/useCardsStore';
import { useUserStore } from '../store/useUserStore';
import type {
  DecisionVerdict,
  PurchaseDecision,
  PurchaseGateInput,
  UsePurchaseGateResult,
} from '../types/decision.types';
import {
  Currency,
  PurchaseCategory,
  type PurchaseInput,
} from '../types/purchase.types';
import type { Obligation } from '../types/cashflow.types';

const EMPTY_OBLIGATIONS: readonly Obligation[] = [];
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

export function usePurchaseGate(): UsePurchaseGateResult {
  const profile = useUserStore(state => state.profile);
  const cards = useCardsStore(state => state.cards);
  const [amount, setAmount] = useState<number>(0);
  const [isInternational, setIsInternational] = useState<boolean>(false);
  const [decision, setDecision] = useState<PurchaseDecision | null>(null);

  const selectedCardId = cards[0]?.cardId ?? '';

  const gateInput = useMemo<PurchaseGateInput>(
    (): PurchaseGateInput => ({
      snapshotDate: new Date().toISOString(),
      currentBalance: profile?.currentBalance ?? 0,
      remainingBalance: profile?.currentBalance ?? 0,
      monthlyIncome: profile?.monthlyIncome ?? 0,
      obligations: EMPTY_OBLIGATIONS,
      lastPurchaseDate: null,
      availableCards: cards,
    }),
    [cards, profile?.currentBalance, profile?.monthlyIncome],
  );

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
    verdict: decision?.verdict ?? null,
    decision,
    exchangeFeeWarning: decision?.exchangeFeeWarning ?? null,
    evaluate,
  };
}
