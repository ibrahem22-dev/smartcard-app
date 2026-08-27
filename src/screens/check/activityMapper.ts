/**
 * L1–L4 activity mapping. THIS FILE MAPS. IT DOES NOT DECIDE.
 *
 * Summing logged amounts into the load engine's `loggedThisCyclePurchasesIls`
 * is input assembly, the same class as defaulting a missing installment count
 * to 1. Limit consumption stays inside `evaluateFinancialLoad`.
 */
import { provenanced, type ProvenancedNumber } from '../../engines/provenance';
import type { LoadCard } from '../../engines/load';
import type { PurchaseVerdict } from '../../engines/verdict';
import type { LoggedPurchase, VerdictHistoryRecord } from '../../types/activity.types';

export function writeLoggedPurchase(input: {
  readonly activityId: string;
  readonly amountIls: number;
  readonly at: string;
  readonly cardId?: string | null;
}): LoggedPurchase {
  if (!(input.amountIls > 0) || !Number.isFinite(input.amountIls)) {
    throw new Error('writeLoggedPurchase: amount must be greater than zero');
  }
  if (input.activityId.length === 0) {
    throw new Error('writeLoggedPurchase: activityId is required');
  }
  return {
    activityId: input.activityId,
    amountIls: input.amountIls,
    loggedAt: input.at,
    ...(input.cardId ? { cardId: input.cardId } : {}),
  };
}

export function writeVerdictHistory(input: {
  readonly activityId: string;
  readonly at: string;
  readonly verdict: PurchaseVerdict;
  readonly purchaseAmountIls: number;
  readonly cardId?: string | null;
}): VerdictHistoryRecord {
  if (!(input.purchaseAmountIls > 0) || !Number.isFinite(input.purchaseAmountIls)) {
    throw new Error('writeVerdictHistory: amount must be greater than zero');
  }
  return {
    activityId: input.activityId,
    at: input.at,
    verdict: input.verdict,
    purchaseAmountIls: input.purchaseAmountIls,
    ...(input.cardId ? { cardId: input.cardId } : {}),
  };
}

export function loggedThisCyclePurchasesIls(
  purchases: readonly LoggedPurchase[],
  cardId: string,
): ProvenancedNumber {
  const total = purchases.reduce(
    (sum, purchase) => (purchase.cardId === cardId ? sum + purchase.amountIls : sum),
    0,
  );
  return provenanced(total, 'USER');
}

export function loadCardsFromVault(
  cards: readonly { readonly cardId: string; readonly creditLimit: number }[],
  purchases: readonly LoggedPurchase[],
): readonly LoadCard[] {
  return cards.map((card) => ({
    cardId: card.cardId,
    creditLimitIls: provenanced(card.creditLimit, 'USER'),
    loggedThisCyclePurchasesIls: loggedThisCyclePurchasesIls(purchases, card.cardId),
  }));
}

export function queryVerdictHistory(
  records: readonly VerdictHistoryRecord[],
  filter?: { readonly cardId?: string },
): readonly VerdictHistoryRecord[] {
  const filtered = filter?.cardId === undefined
    ? records
    : records.filter((record) => record.cardId === filter.cardId);
  return [...filtered].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
