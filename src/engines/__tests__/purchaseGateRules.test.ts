/**
 * MVP_SCOPE §7.4 — Purchase Gate thresholds and obligation semantics.
 */

import {
  PURCHASE_GATE_RULES,
  evaluateCashflowVerdict,
  hasUnknownBillingDay,
  projectedBalanceAfterPurchase,
  remainingObligationsThisMonth,
  type CashflowVerdictInput,
} from '../purchaseGateRules';
import { PurchaseCategory } from '../../types/purchase.types';
import type { Obligation } from '../../types/cashflow.types';

function obligation(dayOfMonth: number, amount: number): Obligation {
  return {
    obligationId: `o-${dayOfMonth}-${amount}`,
    type: 'installment' as Obligation['type'],
    amount,
    dayOfMonth,
    description: 'test',
    category: PurchaseCategory.Other,
    cardId: null,
  };
}

const BASE: CashflowVerdictInput = {
  remainingBalance: 10_000,
  monthlyIncome: 10_000,
  purchaseAmount: 100,
  isEssential: false,
  obligations: [],
  todayDayOfMonth: 1,
};

describe('§7.4 thresholds are the Owner-decided values', () => {
  it('pins the two cashflow thresholds', () => {
    expect(PURCHASE_GATE_RULES.warningBufferRatioOfIncome).toBe(0.1);
    expect(PURCHASE_GATE_RULES.wait24hPurchaseRatioOfIncome).toBe(0.25);
  });
});

describe('§7.4 obligation semantics', () => {
  it('counts only obligations still ahead in the billing month', () => {
    const obligations = [obligation(5, 500), obligation(20, 700)];
    // On the 10th the 5th has already left the account.
    expect(remainingObligationsThisMonth(obligations, 10)).toBe(700);
    // On the 1st both are still to come.
    expect(remainingObligationsThisMonth(obligations, 1)).toBe(1200);
    // An obligation due today still counts.
    expect(remainingObligationsThisMonth(obligations, 20)).toBe(700);
  });

  it('counts an obligation whose billing day is UNKNOWN (fails closed)', () => {
    // mapImportedInstallmentsToObligations emits dayOfMonth 0 when the billing
    // card is missing or its billingDayOfMonth is invalid (LOCK-007) rather
    // than inventing a day. A plain `dayOfMonth >= today` comparison dropped
    // those silently, understating commitments and over-approving purchases.
    expect(remainingObligationsThisMonth([obligation(0, 900)], 15)).toBe(900);
    expect(remainingObligationsThisMonth([obligation(0, 900)], 1)).toBe(900);
  });

  it('treats an out-of-range day as unknown rather than as a date', () => {
    expect(hasUnknownBillingDay(obligation(0, 1))).toBe(true);
    expect(hasUnknownBillingDay(obligation(32, 1))).toBe(true);
    expect(hasUnknownBillingDay(obligation(-3, 1))).toBe(true);
    expect(hasUnknownBillingDay(obligation(1, 1))).toBe(false);
    expect(hasUnknownBillingDay(obligation(31, 1))).toBe(false);
  });

  it('blocks a purchase that an undated obligation makes unaffordable', () => {
    // The user-visible consequence of the bug: without fail-closed counting
    // this returned `approved`.
    const result = evaluateCashflowVerdict({
      ...BASE,
      remainingBalance: 2000,
      purchaseAmount: 1000,
      obligations: [obligation(0, 1500)],
      todayDayOfMonth: 15,
      isEssential: true,
    });
    expect(result.verdict).toBe('blocked');
    expect(result.obligationsStillDue).toBe(1500);
  });

  it('uses the per-month amount, never a running total', () => {
    // mapImportedInstallmentsToObligations stores monthlyPayment; three
    // monthly instalments of 400 owe 400 this month, not 1200.
    expect(remainingObligationsThisMonth([obligation(15, 400)], 1)).toBe(400);
  });

  it('projects balance after purchase AND obligations', () => {
    expect(projectedBalanceAfterPurchase(5000, 1000, 1500)).toBe(2500);
  });
});

describe('§7.4 verdicts', () => {
  it('blocks when the projected balance goes negative', () => {
    const result = evaluateCashflowVerdict({
      ...BASE,
      remainingBalance: 2000,
      purchaseAmount: 1000,
      obligations: [obligation(28, 1500)],
    });
    expect(result.verdict).toBe('blocked');
    expect(result.rule).toBe('PROJECTED_BALANCE_NEGATIVE');
    expect(result.projectedBalance).toBe(-500);
  });

  it('does not block on a purchase the user can afford after obligations', () => {
    const result = evaluateCashflowVerdict({
      ...BASE,
      remainingBalance: 5000,
      purchaseAmount: 1000,
      obligations: [obligation(28, 1500)],
      isEssential: true,
    });
    expect(result.verdict).toBe('approved');
    expect(result.projectedBalance).toBe(2500);
  });

  it('catches the purchase affordable today but not after the 28th', () => {
    // This is the case the obligation rule exists for.
    const affordableToday = evaluateCashflowVerdict({
      ...BASE,
      remainingBalance: 2000,
      purchaseAmount: 900,
      obligations: [obligation(28, 1500)],
      isEssential: true,
    });
    expect(affordableToday.verdict).toBe('blocked');
    // Same purchase once that obligation has already been paid.
    const afterItCleared = evaluateCashflowVerdict({
      ...BASE,
      remainingBalance: 2000,
      monthlyIncome: 2000,
      purchaseAmount: 900,
      obligations: [obligation(28, 1500)],
      todayDayOfMonth: 29,
      isEssential: true,
    });
    expect(afterItCleared.verdict).toBe('approved');
  });

  it('warns when the post-purchase buffer is below 10% of income', () => {
    const result = evaluateCashflowVerdict({
      ...BASE,
      remainingBalance: 1000,
      monthlyIncome: 10_000,
      purchaseAmount: 500,
      isEssential: true,
    });
    // buffer 500 / income 10000 = 5% < 10%
    expect(result.verdict).toBe('warning');
    expect(result.rule).toBe('BUFFER_BELOW_THRESHOLD');
  });

  it('defers a large non-essential purchase at 25% of income', () => {
    const result = evaluateCashflowVerdict({
      ...BASE,
      remainingBalance: 10_000,
      monthlyIncome: 10_000,
      purchaseAmount: 2500,
      isEssential: false,
    });
    expect(result.verdict).toBe('wait_24h');
    expect(result.rule).toBe('LARGE_NON_ESSENTIAL_PURCHASE');
  });

  it('does not defer the same purchase when it is essential', () => {
    const result = evaluateCashflowVerdict({
      ...BASE,
      remainingBalance: 10_000,
      monthlyIncome: 10_000,
      purchaseAmount: 2500,
      isEssential: true,
    });
    expect(result.verdict).toBe('approved');
  });

  it('applies §7.4 rules in the order the decision lists them', () => {
    // Both "buffer below 10%" and "non-essential >= 25%" apply here; §7.4
    // lists warning before wait_24h, so warning wins. See DR-003.
    const result = evaluateCashflowVerdict({
      ...BASE,
      remainingBalance: 3000,
      monthlyIncome: 10_000,
      purchaseAmount: 2600,
      isEssential: false,
    });
    expect(result.purchaseRatioOfIncome).toBeGreaterThanOrEqual(0.25);
    expect(result.bufferRatio).toBeLessThan(0.1);
    expect(result.verdict).toBe('warning');
  });

  it('approves when nothing applies', () => {
    const result = evaluateCashflowVerdict(BASE);
    expect(result.verdict).toBe('approved');
    expect(result.rule).toBe('WITHIN_THRESHOLDS');
  });
});
