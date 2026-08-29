/**
 * Check Input → Verdict assembly. THIS FILE MAPS. IT DOES NOT DECIDE.
 *
 * One `runPurchaseCheck` call. Load-engine available-limit is painted as the
 * impact strip; this file never subtracts limit − holds − logged itself.
 */
import { evaluateFinancialLoad } from '../engines/load';
import { provenanced } from '../engines/provenance';
import type { UserProfile } from '../types/user.types';
import type { LoggedPurchase } from '../types/activity.types';
import type { ImportedInstallment } from '../types/installment.types';
import type { Loan } from '../types/loan.types';
import { Currency, PurchaseCategory } from '../types/purchase.types';
import type { CheckInputDraft } from '../screens/check/CheckInputScreen';
import type { CheckVerdictScreenProps } from '../screens/check/CheckVerdictScreen';
import { loadCardsFromVault } from './activityMapper';
import { commitmentState, type CommitmentReadiness } from './commitmentInput';
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

/**
 * WHAT THE CHECK LOOP READS ABOUT THE USER.
 *
 * `installments`, `loans` and `commitmentReadiness` were added under Owner ruling OQ-P5-001,
 * 2026-08-29. Until then this input named `profile`, `cards` and `purchases` only, so the vault's
 * תשלומים and loans could not have reached the Verdict even if `incomeAnchor` had wanted them: the
 * hard-coded `commitments: []` and the missing input were two halves of one defect, and repairing
 * either alone would have left the other in place.
 */
export interface CheckLoopInput {
  readonly profile: UserProfile | null;
  readonly cards: readonly { readonly cardId: string; readonly creditLimit: number }[];
  readonly purchases: readonly LoggedPurchase[];
  readonly todayIso: string;
  /** Imported תשלומים from the vault. Each is one monthly obligation and, when linked, one hold. */
  readonly installments: readonly ImportedInstallment[];
  /** Loans and mortgages from the vault. Monthly obligations; a credit line also holds limit. */
  readonly loans: readonly Loan[];
  /**
   * Whether those two collections can be believed yet.
   *
   * REQUIRED, NOT OPTIONAL, AND DELIBERATELY SO. An optional readiness would default to "trust it",
   * which is the assumption this ruling exists to delete. A caller that has not decided how it knows
   * its commitment lists are loaded has to say so here.
   */
  readonly commitmentReadiness: CommitmentReadiness;
  /**
   * Commitment ids the user has marked **Paid early** (spec §15).
   *
   * Criterion A4 names this in as many words — *"Paid early moves all three in the same run"* — and
   * the Verdict's impact strip is one of the three. Until 2026-08-29 the Check loop had no way to
   * be told, so the strip could not move with Wallet and Card DNA however correct the engine was.
   */
  readonly paidEarlyCommitmentIds?: readonly string[];
}

export function verdictPropsFromDraft(
  draft: CheckInputDraft,
  input: CheckLoopInput,
): CheckVerdictScreenProps {
  const commitments = commitmentState(
    { cards: input.cards, installments: input.installments, loans: input.loans },
    input.commitmentReadiness,
  );
  const resolved = purchaseContextFromProfile(
    input.profile,
    input.todayIso,
    commitments,
    input.paidEarlyCommitmentIds,
  );
  const contextLine = {
    amount: draft.amount,
    currencySymbol: CURRENCY_SYMBOL[draft.currency],
    categoryLabel: draft.category === null ? null : CATEGORY_WORD[draft.category],
    installmentCount: draft.installments ?? 1,
  };

  /* NO CONTEXT MEANS NO VERDICT, AND THAT NOW INCLUDES UNKNOWN COMMITMENTS. Omitting `result` is
     how this loop has always said "nothing to paint yet"; what changed is that an unloaded or
     failed commitment read reaches it, instead of being silently rounded down to an empty list and
     evaluated as the most optimistic case the engine has. */
  if (resolved.kind === 'ABSENT' || draft.currency !== Currency.ILS) {
    return { contextLine };
  }
  const context = resolved.context;

  const result = runPurchaseCheck(draft, context);
  const loadCards = loadCardsFromVault(input.cards, input.purchases);
  const linkedCardId = draft.cardId ?? input.cards[0]?.cardId;
  const load = loadCards.length === 0
    ? null
    : evaluateFinancialLoad({
      monthlyIncomeIls: context.monthlyIncomeIls,
      /* THE FULL LIST, not `stillOwed`. This engine needs every commitment to compute `current`
         and needs the ids to release each settled one's held limit; the verdict engine, which has
         no such parameter, gets the still-owed subset inside `runPurchaseCheck`. Two readings of
         one fact, reconciled in `commitmentInput.ts` and nowhere else. */
      commitments: context.commitments,
      ...(context.paidEarlyCommitmentIds
        ? { paidEarlyCommitmentIds: context.paidEarlyCommitmentIds }
        : {}),
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
