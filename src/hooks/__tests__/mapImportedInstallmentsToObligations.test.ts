/**
 * Critical flow: OBLIGATIONS (MVP_SCOPE §2 line 27, §4 #10).
 *
 * `mapImportedInstallmentsToObligations` had no test at all, despite being the
 * source of the LOCK-007 contract that the Purchase Gate now depends on:
 *
 *   "Billing day comes from the installment's billing card only — never invent
 *    a day when the card is missing or billingDayOfMonth is 0/invalid."
 *
 * `purchaseGateRules.remainingObligationsThisMonth` treats an out-of-range day
 * as UNKNOWN and fails closed by counting it (DR-007). If this mapper were
 * ever changed to default an absent billing day to a real day — say 1 — that
 * fail-closed branch would silently stop firing and an undated commitment
 * would quietly re-enter the "already paid" bucket. These tests pin the
 * contract on both sides of that seam.
 */

import { mapImportedInstallmentsToObligations } from '../mapImportedInstallmentsToObligations';
import {
  evaluateCashflowVerdict,
  hasUnknownBillingDay,
  remainingObligationsThisMonth,
} from '../../engines/purchaseGateRules';
import { ObligationType } from '../../types/cashflow.types';
import type { ImportedInstallment } from '../../types/installment.types';
import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import { Currency, PurchaseCategory } from '../../types/purchase.types';

function makeCard(overrides: Partial<CardInput> = {}): CardInput {
  return {
    cardId: 'max-gold',
    displayName: 'Max Gold',
    last4: '1234',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: { creditLimit: 20_000, currentBalance: 1_000 },
    billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
    roleTags: [CardRole.Benefits],
    primaryRole: CardRole.Benefits,
    rewardCategories: [PurchaseCategory.Groceries],
    cashbackRate: 0.01,
    foreignTransactionFee: 0.025,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
    ...overrides,
  };
}

function makeInstallment(
  overrides: Partial<ImportedInstallment> = {},
): ImportedInstallment {
  return {
    installmentId: 'inst-1',
    merchantName: 'Ikea',
    totalAmount: 3_600,
    monthsRemaining: 3,
    monthlyPayment: 1_200,
    billingCardId: 'max-gold',
    source: 'imported',
    ...overrides,
  };
}

describe('LOCK-007: the billing day is never invented', () => {
  it('takes the billing day from the installment\'s own card', () => {
    const [obligation] = mapImportedInstallmentsToObligations(
      [makeInstallment()],
      [makeCard()],
    );
    expect(obligation?.dayOfMonth).toBe(10);
    expect(hasUnknownBillingDay(obligation!)).toBe(false);
  });

  it('emits the UNKNOWN sentinel when the billing card is missing', () => {
    const [obligation] = mapImportedInstallmentsToObligations(
      [makeInstallment({ billingCardId: 'no-such-card' })],
      [makeCard()],
    );
    // 0 is the sentinel, NOT a calendar day, and not a silent default of 1.
    expect(obligation?.dayOfMonth).toBe(0);
    expect(hasUnknownBillingDay(obligation!)).toBe(true);
  });

  it('propagates an invalid billingDayOfMonth as UNKNOWN rather than fixing it', () => {
    const [obligation] = mapImportedInstallmentsToObligations(
      [makeInstallment()],
      [makeCard({ billingCycle: { statementClosingDay: 5, billingDayOfMonth: 0 } })],
    );
    expect(hasUnknownBillingDay(obligation!)).toBe(true);
  });

  it('carries the PER-MONTH payment, never the plan total (§7.4)', () => {
    const [obligation] = mapImportedInstallmentsToObligations(
      [makeInstallment({ totalAmount: 3_600, monthlyPayment: 1_200 })],
      [makeCard()],
    );
    expect(obligation?.amount).toBe(1_200);
    expect(obligation?.amount).not.toBe(3_600);
    expect(obligation?.type).toBe(ObligationType.InstallmentCharge);
  });

  it('keeps the merchant name as the description and preserves the id', () => {
    const [obligation] = mapImportedInstallmentsToObligations(
      [makeInstallment({ installmentId: 'inst-9', merchantName: 'Shufersal' })],
      [makeCard()],
    );
    expect(obligation?.obligationId).toBe('inst-9');
    expect(obligation?.description).toBe('Shufersal');
  });
});

describe('mapper → Purchase Gate seam (DR-007)', () => {
  it('an undated obligation still counts against the projection', () => {
    // End to end: a card the user deleted leaves its installment undated.
    // That money may still leave the account, so it must not vanish.
    const obligations = mapImportedInstallmentsToObligations(
      [makeInstallment({ billingCardId: 'deleted-card', monthlyPayment: 1_500 })],
      [makeCard()],
    );
    expect(remainingObligationsThisMonth(obligations, 15)).toBe(1_500);

    const verdict = evaluateCashflowVerdict({
      remainingBalance: 2_000,
      monthlyIncome: 10_000,
      purchaseAmount: 1_000,
      isEssential: true,
      obligations,
      todayDayOfMonth: 15,
    });
    expect(verdict.verdict).toBe('blocked');
    expect(verdict.obligationsStillDue).toBe(1_500);
  });

  it('a dated obligation already paid this month does not double-charge', () => {
    const obligations = mapImportedInstallmentsToObligations(
      [makeInstallment({ monthlyPayment: 1_500 })],
      [makeCard({ billingCycle: { statementClosingDay: 5, billingDayOfMonth: 3 } })],
    );
    // Today is the 20th; the 3rd already left the account.
    expect(remainingObligationsThisMonth(obligations, 20)).toBe(0);
  });

  it('maps an empty installment list to no obligations', () => {
    expect(mapImportedInstallmentsToObligations([], [makeCard()])).toEqual([]);
  });
});
