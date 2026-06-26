import { evaluateInstallment } from '../installmentGate';
import { InstallmentWarningLevel, type Installment, type InstallmentRequest } from '../../types/installment.types';
import { Currency, PurchaseCategory } from '../../types/purchase.types';

function makeRequest(overrides: Partial<InstallmentRequest> = {}): InstallmentRequest {
  return {
    purchaseId: 'security-purchase',
    billingCardId: 'security-card',
    totalAmount: 1_200,
    currency: Currency.ILS,
    category: PurchaseCategory.Shopping,
    numPayments: 12,
    billingDayOfMonth: 10,
    ...overrides,
  };
}

function makeInstallment(overrides: Partial<Installment> = {}): Installment {
  return {
    installmentId: 'security-installment',
    purchaseId: 'existing-purchase',
    billingCardId: 'security-card',
    totalAmount: 1_200,
    currency: Currency.ILS,
    category: PurchaseCategory.Shopping,
    numPayments: 12,
    monthlyPayment: 100,
    paymentsRemaining: 12,
    billingDayOfMonth: 10,
    nextChargeDate: '2026-07-10',
    ...overrides,
  };
}

describe('installmentGate monetary security', () => {
  test.each([
    0.005,
    1_000_000,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('blocks invalid request totalAmount %p', (totalAmount: number) => {
    const decision = evaluateInstallment(
      makeRequest({ totalAmount }),
      [],
      10_000,
    );

    expect(decision.approved).toBe(false);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.Blocked);
  });

  test.each([0.01, 999_999])('accepts boundary request totalAmount %p', (totalAmount: number) => {
    const decision = evaluateInstallment(
      makeRequest({ totalAmount, numPayments: 2 }),
      [],
      999_999,
    );

    expect(decision.approved).toBe(true);
    expect(decision.warningLevel).not.toBe(InstallmentWarningLevel.Blocked);
  });

  test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'blocks corrupt monthly income %p',
    (monthlyIncome: number) => {
      const decision = evaluateInstallment(makeRequest(), [], monthlyIncome);

      expect(decision.approved).toBe(false);
      expect(decision.warningLevel).toBe(InstallmentWarningLevel.Blocked);
    },
  );

  test('skips corrupt existing monthly payments while summing load', () => {
    const decision = evaluateInstallment(
      makeRequest({ totalAmount: 1_200, numPayments: 12 }),
      [
        makeInstallment({ installmentId: 'valid', monthlyPayment: 100 }),
        makeInstallment({ installmentId: 'too-large', monthlyPayment: 1_000_000 }),
        makeInstallment({ installmentId: 'negative', monthlyPayment: -1 }),
      ],
      10_000,
    );

    expect(decision.resultingLoadRatio).toBeCloseTo(0.02, 5);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.None);
  });
});
