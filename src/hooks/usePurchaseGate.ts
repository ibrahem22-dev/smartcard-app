import { useCallback, useMemo, useState } from 'react';

import { evaluatePurchase } from '../engines/purchaseGate';
import { recommendCard } from '../engines/cardRoleEngine';
import { resolveFxAbroad } from './useFxAbroad';
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
import {
  assessSnapshot,
  type RequiredSnapshotField,
} from '../authority/profileSnapshot';
import { classifyCollection } from '../store/hydration';

export { mapImportedInstallmentsToObligations } from './mapImportedInstallmentsToObligations';

const EMPTY_FX_COMPARISON: readonly FxComparisonRow[] = [];

/**
 * Verdict when the profile has not captured the balance/income the gate needs.
 *
 * `savingsAmount: 0` here is honest: there is no recommendation, so there is no
 * saving to surface. The important part is that the gate did NOT compute an
 * affordability answer from invented inputs.
 */
/**
 * Verdict when the card store has not loaded, or could not be read.
 *
 * Distinct from NO_CARDS_DECISION on purpose: "we have not finished loading
 * your cards" and "you have no cards" are different statements, and only one
 * of them should send the user to the add-card flow.
 */
function buildCardsUnavailableDecision(
  readiness: 'PENDING' | 'UNAVAILABLE',
): PurchaseDecision {
  const pending = readiness === 'PENDING';
  return {
    verdict: 'blocked',
    reason: pending
      ? 'טוען את הכרטיסים שלך — נסה שוב בעוד רגע'
      : 'לא ניתן לקרוא את הכרטיסים — ייתכן שהכספת נעולה',
    reasonAr: pending
      ? 'جارٍ تحميل بطاقاتك — أعد المحاولة بعد لحظة'
      : 'تعذر قراءة البطاقات — قد تكون الخزنة مقفلة',
    recommendedCard: null,
    savingsAmount: 0,
    currency: Currency.ILS,
  };
}

function buildIncompleteSnapshotDecision(
  missing: readonly RequiredSnapshotField[],
): PurchaseDecision {
  const fields = missing.join(', ');
  return {
    verdict: 'blocked',
    reason: `לא ניתן להעריך — חסרים נתונים פיננסיים בפרופיל: ${fields}`,
    reasonAr: `تعذر التقييم — بيانات مالية ناقصة في الملف: ${fields}`,
    recommendedCard: null,
    savingsAmount: 0,
    currency: Currency.ILS,
  };
}
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
  const cardsHydration = useCardsStore(state => state.hydration);
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

  /**
   * Whether the profile carries the financial facts the gate needs.
   *
   * This used to be `profile?.currentBalance ?? 0` / `?? 0` for income. A user
   * who had not completed onboarding was silently evaluated against a balance
   * and income of zero -- and income drives the buffer-percentage thresholds,
   * so the gate could block a perfectly affordable purchase on a number the app
   * invented. MVP_SCOPE §4: the app does not invent missing financial values.
   */
  const snapshot = useMemo(
    () =>
      assessSnapshot({
        currentBalance: profile?.currentBalance,
        monthlyIncome: profile?.monthlyIncome,
      }),
    [profile?.currentBalance, profile?.monthlyIncome],
  );

  const gateInput = useMemo<PurchaseGateInput | null>(
    (): PurchaseGateInput | null =>
      snapshot.complete
        ? {
            snapshotDate: new Date().toISOString(),
            currentBalance: snapshot.currentBalance,
            remainingBalance: snapshot.currentBalance,
            monthlyIncome: snapshot.monthlyIncome,
            obligations,
            lastPurchaseDate: null,
            availableCards: cards,
          }
        : null,
    [cards, obligations, snapshot],
  );

  // International FX-commission comparison. Currency defaults to USD (the most
  // common foreign currency for Israeli users) since the gate has no currency
  // picker yet — a future enhancement can pass the real purchase currency.
  // International FX-commission comparison, now sourced from the production-
  // approved VERIFIED dataset (foreign-purchase leg). Cards with no verified
  // triple carry commission=null and verified=false — the UI shows them as
  // "not yet confirmed" and they never rank as cheapest. No silent default.
  const fxComparison = useMemo<readonly FxComparisonRow[]>(() => {
    if (!isInternational || cards.length < 2) {
      return EMPTY_FX_COMPARISON;
    }
    const recommendation =
      profile === null
        ? null
        : recommendCard(
            cards,
            PurchaseCategory.Other,
            profile,
            true,
            Currency.USD,
          );

    return cards
      .map((card): FxComparisonRow => {
        const resolved = resolveFxAbroad(card);
        if (resolved.status === 'verified') {
          const leg = resolved.triple.fxPurchasePct;
          return {
            cardId: card.cardId,
            displayName: card.displayName,
            commission: leg.value,
            verified: true,
            effectiveFrom: leg.effectiveFrom,
          };
        }
        return {
          cardId: card.cardId,
          displayName: card.displayName,
          commission: null,
          verified: false,
          effectiveFrom: null,
        };
      })
      .sort((a, b): number => {
        // Verified rows first; unverified sink to the bottom.
        if (a.verified !== b.verified) {
          return a.verified ? -1 : 1;
        }
        if (a.commission !== null && b.commission !== null) {
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
        }
        return 0;
      });
  }, [cards, isInternational, profile]);

  const evaluate = useCallback((): PurchaseDecision => {
    // "You have no cards" is only true once the card store has actually
    // loaded. Reading `cards.length === 0` directly told a user who owned
    // cards to go add one whenever evaluate() ran before hydration finished,
    // or while the vault was locked.
    const cardsReadiness = classifyCollection(cardsHydration, cards.length);
    if (cardsReadiness === 'PENDING' || cardsReadiness === 'UNAVAILABLE') {
      const pending = buildCardsUnavailableDecision(cardsReadiness);
      setDecision(pending);
      return pending;
    }
    if (cardsReadiness === 'KNOWN_EMPTY') {
      setDecision(NO_CARDS_DECISION);
      return NO_CARDS_DECISION;
    }

    // The gate cannot honestly run without the user's balance and income.
    // Refuse, and name the missing fields, rather than evaluating against a
    // fabricated zero.
    if (gateInput === null) {
      const incomplete = buildIncompleteSnapshotDecision(
        snapshot.complete ? [] : snapshot.missing,
      );
      setDecision(incomplete);
      return incomplete;
    }

    const result = evaluatePurchase(
      buildPurchaseInput(amount, isInternational, selectedCardId),
      gateInput,
    );
    setDecision(result);

    return result;
  }, [
    amount,
    cards.length,
    cardsHydration,
    gateInput,
    isInternational,
    selectedCardId,
    snapshot,
  ]);

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
