import type { CardInput } from '../types/card.types';
import {
  ObligationType,
  type Obligation,
} from '../types/cashflow.types';
import type { ImportedInstallment } from '../types/installment.types';
import { PurchaseCategory } from '../types/purchase.types';

/**
 * Map store installments → engine Obligation[].
 * Billing day comes from the installment's billing card only — never invent
 * a day when the card is missing or billingDayOfMonth is 0/invalid (LOCK-007).
 */
export function mapImportedInstallmentsToObligations(
  installments: readonly ImportedInstallment[],
  cards: readonly CardInput[],
): readonly Obligation[] {
  return installments.map((installment: ImportedInstallment): Obligation => {
    const card = cards.find(
      (candidate: CardInput): boolean =>
        candidate.cardId === installment.billingCardId,
    );
    const dayOfMonth =
      card === undefined ? 0 : card.billingCycle.billingDayOfMonth;

    return {
      obligationId: installment.installmentId,
      type: ObligationType.InstallmentCharge,
      amount: installment.monthlyPayment,
      dayOfMonth,
      description: installment.merchantName,
      category: PurchaseCategory.Other,
      cardId: card?.cardId ?? installment.billingCardId,
    };
  });
}
