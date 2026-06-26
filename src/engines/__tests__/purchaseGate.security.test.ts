import { evaluatePurchase } from '../purchaseGate';
import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import {
  ObligationType,
  type Obligation,
} from '../../types/cashflow.types';
import type { PurchaseGateInput } from '../../types/decision.types';
import {
  Currency,
  PurchaseCategory,
  type OneTimePurchase,
  type PurchaseInput,
} from '../../types/purchase.types';

function makeCard(overrides: Partial<CardInput> = {}): CardInput {
  return {
    cardId: 'security-card',
    displayName: 'Security Card',
    last4: '1234',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: {
      creditLimit: 10_000,
      currentBalance: 1_000,
    },
    billingCycle: {
      statementClosingDay: 25,
      billingDayOfMonth: 10,
    },
    roleTags: [CardRole.Daily],
    primaryRole: CardRole.Daily,
    rewardCategories: [PurchaseCategory.Groceries],
    cashbackRate: 0.01,
    foreignTransactionFee: 0.03,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
    ...overrides,
  };
}

function makePurchase(overrides: Partial<OneTimePurchase> = {}): PurchaseInput {
  return {
    purchaseId: 'security-purchase',
    amount: 100,
    currency: Currency.ILS,
    category: PurchaseCategory.Groceries,
    date: '2026-06-26',
    cardId: 'security-card',
    merchantName: 'Security Merchant',
    isEssential: true,
    isInternational: false,
    isInstallment: false,
    installmentPlan: null,
    ...overrides,
  };
}

function makeObligation(overrides: Partial<Obligation> = {}): Obligation {
  return {
    obligationId: 'security-obligation',
    type: ObligationType.StandingOrder,
    amount: 100,
    dayOfMonth: 5,
    description: 'Security obligation',
    category: PurchaseCategory.Other,
    cardId: null,
    ...overrides,
  };
}

function makeGateInput(overrides: Partial<PurchaseGateInput> = {}): PurchaseGateInput {
  return {
    snapshotDate: '2026-06-26T12:00:00.000Z',
    currentBalance: 1_000,
    remainingBalance: 1_000,
    monthlyIncome: 5_000,
    obligations: [],
    lastPurchaseDate: null,
    availableCards: [makeCard()],
    ...overrides,
  };
}

describe('purchaseGate monetary security', (): void => {
  test.each([0.005, 1_000_000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'blocks invalid purchase amount %p',
    (amount: number): void => {
      const result = evaluatePurchase(
        makePurchase({ amount }),
        makeGateInput(),
      );

      expect(result.verdict).toBe('blocked');
    },
  );

  test.each([0.005, 1_000_000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'blocks invalid remainingBalance %p',
    (remainingBalance: number): void => {
      const result = evaluatePurchase(
        makePurchase({ amount: 100 }),
        makeGateInput({ remainingBalance }),
      );

      expect(result.verdict).toBe('blocked');
      expect(result.recommendedCard).toBeNull();
    },
  );

  test.each([0.005, 1_000_000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'blocks invalid currentBalance %p',
    (currentBalance: number): void => {
      const result = evaluatePurchase(
        makePurchase({ amount: 100 }),
        makeGateInput({ currentBalance }),
      );

      expect(result.verdict).toBe('blocked');
    },
  );

  test.each([0.005, 1_000_000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'blocks invalid monthlyIncome %p',
    (monthlyIncome: number): void => {
      const result = evaluatePurchase(
        makePurchase({ amount: 100 }),
        makeGateInput({ monthlyIncome }),
      );

      expect(result.verdict).toBe('blocked');
    },
  );

  test('accepts minimum valid monetary boundary purchase amount', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 0.01 }),
      makeGateInput({ currentBalance: 999_999, remainingBalance: 999_999 }),
    );

    expect(result.verdict).not.toBe('blocked');
  });

  test('evaluates maximum valid monetary boundary purchase amount without throwing', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 999_999 }),
      makeGateInput({
        currentBalance: 999_999,
        remainingBalance: 999_999,
        monthlyIncome: 999_999,
        availableCards: [
          makeCard({
            framework: {
              creditLimit: 999_999,
              currentBalance: 0,
            },
          }),
        ],
      }),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('evaluates minimum valid monetary boundary remainingBalance without throwing', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 0.01 }),
      makeGateInput({ remainingBalance: 0.01 }),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('accepts maximum valid monetary boundary remainingBalance', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 0.01 }),
      makeGateInput({ currentBalance: 999_999, remainingBalance: 999_999 }),
    );

    expect(result.verdict).not.toBe('blocked');
  });

  test('ignores corrupt obligation amounts in charge-return calculation', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 900 }),
      makeGateInput({
        currentBalance: 5_000,
        remainingBalance: 2_000,
        obligations: [
          makeObligation({ amount: Number.NaN, dayOfMonth: 5 }),
          makeObligation({ amount: 1_000_000, dayOfMonth: 5 }),
        ],
      }),
    );

    expect(result.verdict).not.toBe('blocked');
  });
});
