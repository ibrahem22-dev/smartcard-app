/**
 * Check Input → Verdict assembly. THIS FILE MAPS. IT DOES NOT DECIDE.
 *
 * One `runPurchaseCheck` call. Load-engine available-limit is painted as the
 * impact strip; this file never subtracts limit − holds − logged itself.
 */
import { evaluateFinancialLoad } from '../../engines/load';
import { provenanced } from '../../engines/provenance';
import type { UserProfile } from '../../types/user.types';
import type { LoggedPurchase } from '../../types/activity.types';
import { Currency, PurchaseCategory } from '../../types/purchase.types';
import type { CheckInputDraft } from './CheckInputScreen';
import type { CheckVerdictScreenProps } from './CheckVerdictScreen';
import { loadCardsFromVault } from './activityMapper';
import { purchaseContextFromProfile } from './incomeAnchor';
import { runPurchaseCheck } from './runPurchaseCheck';

const CATEGORY_WORD: Readonly<Record<PurchaseCategory, string>> = {
  [PurchaseCategory.Groceries]: 'מכולת',
  [PurchaseCategory.Dining]: 'מסעדות',
  [PurchaseCategory.Fuel]: 'דלק',
  [PurchaseCategory.Transport]: 'תחבורה',
  [PurchaseCategory.Travel]: 'נסיעות',
  [PurchaseCategory.Subscriptions]: 'מנויים',
  [PurchaseCategory.Education]: 'חינוך',
  [PurchaseCategory.Health]: 'בריאות',
  [PurchaseCategory.Entertainment]: 'בידור',
  [PurchaseCategory.Shopping]: 'קניות',
  [PurchaseCategory.Utilities]: 'חשבונות',
  [PurchaseCategory.Other]: 'אחר',
};

const CURRENCY_SYMBOL: Readonly<Record<Currency, string>> = {
  [Currency.ILS]: '₪',
  [Currency.USD]: '$',
  [Currency.EUR]: '€',
};

export function verdictPropsFromDraft(
  draft: CheckInputDraft,
  input: {
    readonly profile: UserProfile | null;
    readonly cards: readonly { readonly cardId: string; readonly creditLimit: number }[];
    readonly purchases: readonly LoggedPurchase[];
    readonly todayIso: string;
  },
): CheckVerdictScreenProps {
  const context = purchaseContextFromProfile(input.profile, input.todayIso);
  const contextLine = {
    amount: draft.amount,
    currencySymbol: CURRENCY_SYMBOL[draft.currency],
    categoryLabel: draft.category === null ? null : CATEGORY_WORD[draft.category],
    installmentCount: draft.installments ?? 1,
  };

  if (context === null || draft.currency !== Currency.ILS) {
    return { contextLine };
  }

  const result = runPurchaseCheck(draft, context);
  const loadCards = loadCardsFromVault(input.cards, input.purchases);
  const linkedCardId = draft.cardId ?? input.cards[0]?.cardId;
  const load = loadCards.length === 0
    ? null
    : evaluateFinancialLoad({
      monthlyIncomeIls: context.monthlyIncomeIls,
      commitments: context.commitments,
      cards: loadCards,
      ...(linkedCardId === undefined
        ? {}
        : {
          prospectiveCommitment: {
            commitmentId: 'this-purchase',
            monthlyAmountIls: provenanced(draft.amount, 'USER'),
            linkedCardId,
            remainingHoldIls: provenanced(draft.amount, 'USER'),
          },
        }),
    });

  const position = linkedCardId === undefined
    ? load?.cardLimits[0]
    : load?.cardLimits.find((row) => row.cardId === linkedCardId) ?? load?.cardLimits[0];

  return {
    result,
    contextLine,
    ...(position
      ? { impactStrip: { availableAfterPurchaseIls: position.availableAfterChangesIls } }
      : {}),
    ...(draft.cardId ? { logCardId: draft.cardId } : {}),
  };
}
