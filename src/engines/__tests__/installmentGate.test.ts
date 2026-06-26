import { evaluateInstallment } from '../installmentGate';
import {
  InstallmentWarningLevel,
  type Installment,
  type InstallmentDecision,
  type InstallmentRequest,
} from '../../types/installment.types';
import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import { Currency, PurchaseCategory } from '../../types/purchase.types';
import type { UserProfile } from '../../types/user.types';

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-test',
    bankName: 'לאומי',
    monthlyIncome: 10_000,
    currentBalance: 8_000,
    dangerThreshold: 2_000,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeCard(overrides: Partial<CardInput> = {}): CardInput {
  return {
    cardId: 'card-test',
    displayName: 'Test Card',
    last4: '1234',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: {
      creditLimit: 20_000,
      currentBalance: 1_000,
    },
    billingCycle: {
      statementClosingDay: 25,
      billingDayOfMonth: 10,
    },
    roleTags: [CardRole.Installments],
    primaryRole: CardRole.Installments,
    rewardCategories: [PurchaseCategory.Shopping],
    cashbackRate: 0.01,
    foreignTransactionFee: 0.03,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
    ...overrides,
  };
}

function makeInstallment(overrides: Partial<Installment> = {}): Installment {
  const card = makeCard();

  return {
    installmentId: 'installment-test',
    purchaseId: 'purchase-existing',
    billingCardId: card.cardId,
    totalAmount: 1_200,
    currency: Currency.ILS,
    category: PurchaseCategory.Shopping,
    numPayments: 12,
    monthlyPayment: 100,
    paymentsRemaining: 12,
    billingDayOfMonth: card.billingCycle.billingDayOfMonth,
    nextChargeDate: '2026-07-10',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<InstallmentRequest> = {}): InstallmentRequest {
  const card = makeCard();

  return {
    purchaseId: 'purchase-new',
    billingCardId: card.cardId,
    totalAmount: 1_200,
    currency: Currency.ILS,
    category: PurchaseCategory.Shopping,
    numPayments: 12,
    billingDayOfMonth: card.billingCycle.billingDayOfMonth,
    ...overrides,
  };
}

function evaluateForUser(
  user: UserProfile,
  request: InstallmentRequest,
  existingInstallments: readonly Installment[] = [],
): InstallmentDecision {
  return evaluateInstallment(request, existingInstallments, user.monthlyIncome);
}

describe('evaluateInstallment', () => {
  test('purchase below danger threshold keeps installments unnecessary and approved', () => {
    const user = makeUser({ dangerThreshold: 2_000 });
    const card = makeCard();
    const request = makeRequest({
      billingCardId: card.cardId,
      totalAmount: user.dangerThreshold - 800,
      numPayments: 12,
    });

    const decision = evaluateForUser(user, request);

    expect(decision.approved).toBe(true);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.None);
    expect(decision.monthlyAddition).toBe(100);
    expect(decision.resultingLoadRatio).toBeCloseTo(0.01, 5);
    expect(decision.threeMonthImpact).toHaveLength(3);
  });

  test('purchase above danger threshold is affordable when split into installments', () => {
    const user = makeUser({ dangerThreshold: 2_000 });
    const card = makeCard();
    const request = makeRequest({
      billingCardId: card.cardId,
      totalAmount: user.dangerThreshold + 2_800,
      numPayments: 12,
    });

    const decision = evaluateForUser(user, request);

    expect(decision.approved).toBe(true);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.None);
    expect(decision.monthlyAddition).toBe(400);
    expect(decision.totalCost).toBe(4_800);
  });

  test('3-month impact that exceeds current balance returns a warning decision', () => {
    const user = makeUser({ monthlyIncome: 10_000, currentBalance: 2_500 });
    const existingInstallments = [
      makeInstallment({ monthlyPayment: 2_000, paymentsRemaining: 3 }),
    ];
    const request = makeRequest({ totalAmount: 6_000, numPayments: 6 });

    const decision = evaluateForUser(user, request, existingInstallments);

    expect(decision.approved).toBe(true);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.Warning);
    expect(decision.threeMonthImpact[0]?.projectedMonthlyLoad ?? 0).toBeGreaterThan(
      user.currentBalance,
    );
  });

  test('empty existing installments input does not crash and returns three impact rows', () => {
    const user = makeUser();
    const request = makeRequest({ totalAmount: 1_200, numPayments: 12 });

    const decision = evaluateForUser(user, request, []);

    expect(decision.approved).toBe(true);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.None);
    expect(decision.threeMonthImpact).toHaveLength(3);
  });

  test('zero installments in request is blocked without throwing', () => {
    const user = makeUser();
    const request = makeRequest({ totalAmount: 1_200, numPayments: 0 });

    const decision = evaluateForUser(user, request);

    expect(decision.approved).toBe(false);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.Blocked);
    expect(decision.monthlyAddition).toBe(0);
  });

  test('exactly 25 percent load returns warning', () => {
    const user = makeUser({ monthlyIncome: 10_000 });
    const request = makeRequest({ totalAmount: 30_000, numPayments: 12 });

    const decision = evaluateForUser(user, request);

    expect(decision.approved).toBe(true);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.Warning);
    expect(decision.resultingLoadRatio).toBeCloseTo(0.25, 5);
  });

  test('PROD-INSTALL-01: exactly 35 percent load returns warning', () => { // PROD-INSTALL-01: 35% is upper bound of Warning band
    const user = makeUser({ monthlyIncome: 10_000 });
    const request = makeRequest({ totalAmount: 42_000, numPayments: 12 });

    const decision = evaluateForUser(user, request);

    expect(decision.approved).toBe(true);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.Warning);
    expect(decision.warningLevel).not.toBe(InstallmentWarningLevel.Strong);
    expect(decision.resultingLoadRatio).toBeCloseTo(0.35, 5);
  });

  test('just above 35 percent load returns strong warning', () => {
    const user = makeUser({ monthlyIncome: 10_000 });
    const request = makeRequest({ totalAmount: 42_120, numPayments: 12 });

    const decision = evaluateForUser(user, request);

    expect(decision.approved).toBe(true);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.Strong);
    expect(decision.resultingLoadRatio).toBeCloseTo(0.351, 5);
  });

  test('exactly 50 percent load returns strong warning', () => {
    const user = makeUser({ monthlyIncome: 10_000 });
    const request = makeRequest({ totalAmount: 60_000, numPayments: 12 });

    const decision = evaluateForUser(user, request);

    expect(decision.approved).toBe(true);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.Strong);
    expect(decision.resultingLoadRatio).toBeCloseTo(0.5, 5);
  });

  test('above 50 percent load is blocked', () => {
    const user = makeUser({ monthlyIncome: 10_000 });
    const request = makeRequest({ totalAmount: 60_120, numPayments: 12 });

    const decision = evaluateForUser(user, request);

    expect(decision.approved).toBe(false);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.Blocked);
    expect(decision.resultingLoadRatio).toBeGreaterThan(0.5);
  });

  test('zero income is blocked without throwing', () => {
    const user = makeUser({ monthlyIncome: 0 });
    const request = makeRequest({ totalAmount: 1_200, numPayments: 12 });

    const decision = evaluateForUser(user, request);

    expect(decision.approved).toBe(false);
    expect(decision.warningLevel).toBe(InstallmentWarningLevel.Blocked);
    expect(decision.resultingLoadRatio).toBe(1);
  });
});
