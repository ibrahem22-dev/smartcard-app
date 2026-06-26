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
import { MONETARY_MAX_ILS, MONETARY_MIN_ILS } from '../../utils/monetary';

function makeCard(overrides: Partial<CardInput> = {}): CardInput {
  return {
    cardId: 'card-purchase',
    displayName: 'Purchase Test Card',
    last4: '1111',
    issuer: CardIssuer.Isracard,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: {
      creditLimit: 100_000,
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
    foreignTransactionFee: 0.025,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
    ...overrides,
  };
}

function makePurchase(overrides: Partial<OneTimePurchase> = {}): PurchaseInput {
  const base: OneTimePurchase = {
    purchaseId: 'purchase-1',
    amount: 100,
    currency: Currency.ILS,
    category: PurchaseCategory.Groceries,
    date: '2026-06-01',
    cardId: 'card-purchase',
    merchantName: 'Shufersal',
    isEssential: true,
    isInternational: false,
    isInstallment: false,
    installmentPlan: null,
  };

  return { ...base, ...overrides };
}

function makeObligation(overrides: Partial<Obligation> = {}): Obligation {
  return {
    obligationId: 'obligation-1',
    type: ObligationType.StandingOrder,
    amount: 1_000,
    dayOfMonth: 5,
    description: 'Rent',
    category: PurchaseCategory.Other,
    cardId: null,
    ...overrides,
  };
}

function makeGateInput(overrides: Partial<PurchaseGateInput> = {}): PurchaseGateInput {
  return {
    snapshotDate: '2026-06-25T12:00:00.000Z',
    currentBalance: 5_000,
    remainingBalance: 5_000,
    monthlyIncome: 10_000,
    obligations: [],
    lastPurchaseDate: null,
    availableCards: [makeCard()],
    ...overrides,
  };
}

describe('purchaseGate.evaluatePurchase', () => {
  test('happy path approves when post-purchase buffer exceeds 20% of income', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 100 }),
      makeGateInput({ remainingBalance: 3_000, monthlyIncome: 10_000 }),
    );

    expect(result.verdict).toBe('approved');
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.reasonAr.length).toBeGreaterThan(0);
  });

  test('minimum valid amount is accepted', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: MONETARY_MIN_ILS }),
      makeGateInput({ remainingBalance: 3_000 }),
    );

    expect(result.verdict).not.toBe('blocked');
  });

  test('maximum valid amount is evaluated without throwing', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: MONETARY_MAX_ILS }),
      makeGateInput({
        currentBalance: MONETARY_MAX_ILS,
        remainingBalance: MONETARY_MAX_ILS,
        monthlyIncome: MONETARY_MAX_ILS,
        availableCards: [
          makeCard({
            framework: {
              creditLimit: MONETARY_MAX_ILS,
              currentBalance: 0,
            },
          }),
        ],
      }),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('rejects negative amounts with blocked verdict', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: -100 }),
      makeGateInput(),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('rejects NaN amounts', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: Number.NaN }),
      makeGateInput(),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('rejects amounts above the ILS 999,999 cap', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: MONETARY_MAX_ILS + 1 }),
      makeGateInput({ remainingBalance: MONETARY_MAX_ILS }),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('rejects zero amount', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 0 }),
      makeGateInput(),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('returns wait_24h for non-essential purchase with 5-15% income buffer', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 9_000, currency: Currency.ILS, isEssential: false }),
      makeGateInput({
        currentBalance: 20_000,
        remainingBalance: 10_000,
        monthlyIncome: 10_000,
      }),
    );

    expect(result.verdict).toBe('wait_24h');
  });

  test('essential purchase stays warning instead of wait_24h in 5-15% range', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 9_000, isEssential: true }),
      makeGateInput({
        currentBalance: 20_000,
        remainingBalance: 10_000,
        monthlyIncome: 10_000,
      }),
    );

    expect(result.verdict).toBe('warning');
  });

  test('returns warning when buffer is 5-20% of income', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 8_500 }),
      makeGateInput({
        currentBalance: 20_000,
        remainingBalance: 10_000,
        monthlyIncome: 10_000,
      }),
    );

    expect(result.verdict).toBe('warning');
  });

  test('skips exchange-fee warning when the purchase card is unknown', (): void => {
    const result = evaluatePurchase(
      makePurchase({ isInternational: true, cardId: 'missing-card' }),
      makeGateInput({ availableCards: [] }),
    );

    expect(result.exchangeFeeWarning).toBeUndefined();
  });

  test('attaches exchange-fee warning to a blocked verdict', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 500, isInternational: true }),
      makeGateInput({ currentBalance: 500, remainingBalance: 600 }),
    );

    expect(result.verdict).toBe('blocked');
    expect(result.exchangeFeeWarning).toContain('עמלת המרה');
  });

  test('returns blocked when buffer is below 5% of income', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 9_600 }),
      makeGateInput({
        currentBalance: 9_900,
        remainingBalance: 10_000,
        monthlyIncome: 10_000,
      }),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('adds exchange-fee warning for international purchases', (): void => {
    const result = evaluatePurchase(
      makePurchase({ isInternational: true }),
      makeGateInput(),
    );

    expect(result.exchangeFeeWarning).toContain('עמלת המרה');
  });

  test('does not add exchange-fee warning for domestic purchases', (): void => {
    const result = evaluatePurchase(
      makePurchase({ isInternational: false }),
      makeGateInput(),
    );

    expect(result.exchangeFeeWarning).toBeUndefined();
  });

  test('blocks when zero income is supplied', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 100 }),
      makeGateInput({ monthlyIncome: 0 }),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('blocks when charge return formula predicts bounced card billing', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 2_000 }),
      makeGateInput({
        currentBalance: 2_500,
        remainingBalance: 8_000,
        obligations: [makeObligation({ amount: 600, dayOfMonth: 5 })],
      }),
    );

    expect(result.verdict).toBe('blocked');
    expect(result.reason).toContain('חזרת חיוב');
  });

  test('blocks when credit utilization exceeds 90%', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 1_001 }),
      makeGateInput({
        currentBalance: 8_000,
        remainingBalance: 8_000,
        availableCards: [
          makeCard({
            framework: {
              creditLimit: 10_000,
              currentBalance: 8_000,
            },
          }),
        ],
      }),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('warns when credit utilization exceeds 70%', (): void => {
    const result = evaluatePurchase(
      makePurchase({ amount: 1_001 }),
      makeGateInput({
        currentBalance: 8_000,
        remainingBalance: 8_000,
        availableCards: [
          makeCard({
            framework: {
              creditLimit: 10_000,
              currentBalance: 6_000,
            },
          }),
        ],
      }),
    );

    expect(result.verdict).toBe('warning');
  });
});
