import { evaluatePurchase } from '../purchaseGate';
import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import type { CashflowSnapshot } from '../../types/cashflow.types';
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

function makeCashflow(overrides: Partial<CashflowSnapshot> = {}): CashflowSnapshot {
  return {
    snapshotDate: '2026-06-25T12:00:00.000Z',
    remainingBalance: 5_000,
    lastPurchaseDate: null,
    availableCards: [makeCard()],
    ...overrides,
  };
}

describe('purchaseGate.evaluatePurchase', () => {
  test('happy path approves when buffer exceeds 20% of purchase amount', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: 100 }),
      makeCashflow({ remainingBalance: 250 }),
    );

    expect(result.verdict).toBe('approved');
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.reasonAr.length).toBeGreaterThan(0);
  });

  test('minimum valid amount is accepted', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: MONETARY_MIN_ILS }),
      makeCashflow({ remainingBalance: 1 }),
    );

    expect(result.verdict).not.toBe('blocked');
    expect(result.reason).not.toContain('אינו תקין');
  });

  test('maximum valid amount is accepted', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: MONETARY_MAX_ILS }),
      makeCashflow({ remainingBalance: MONETARY_MAX_ILS * 2 }),
    );

    expect(result.verdict).toBe('approved');
  });

  test('rejects negative amounts with blocked verdict', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: -100 }),
      makeCashflow(),
    );

    expect(result.verdict).toBe('blocked');
    expect(result.reasonAr).toContain('غير صالح');
  });

  test('rejects NaN amounts', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: Number.NaN }),
      makeCashflow(),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('rejects amounts above the ₪999,999 cap', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: MONETARY_MAX_ILS + 1 }),
      makeCashflow({ remainingBalance: 2_000_000 }),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('rejects zero amount', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: 0 }),
      makeCashflow(),
    );

    expect(result.verdict).toBe('blocked');
  });

  test('returns wait_24h after a large purchase within 24 hours', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: 600, currency: Currency.ILS }),
      makeCashflow({
        snapshotDate: '2026-06-25T12:00:00.000Z',
        lastPurchaseDate: '2026-06-25T08:00:00.000Z',
        remainingBalance: 5_000,
      }),
    );

    expect(result.verdict).toBe('wait_24h');
  });

  test('returns warning when balance covers purchase but not the approval buffer', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: 100 }),
      makeCashflow({ remainingBalance: 110 }),
    );

    expect(result.verdict).toBe('warning');
  });

  test('ignores malformed last-purchase timestamps for wait_24h', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: 600 }),
      makeCashflow({
        lastPurchaseDate: 'not-a-date',
        remainingBalance: 5_000,
      }),
    );

    expect(result.verdict).toBe('approved');
  });

  test('skips exchange-fee warning when the purchase card is unknown', () => {
    const result = evaluatePurchase(
      makePurchase({ isInternational: true, cardId: 'missing-card' }),
      makeCashflow({ availableCards: [] }),
    );

    expect(result.exchangeFeeWarning).toBeUndefined();
  });

  test('attaches exchange-fee warning to a blocked verdict', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: 500, isInternational: true }),
      makeCashflow({ remainingBalance: 50 }),
    );

    expect(result.verdict).toBe('blocked');
    expect(result.exchangeFeeWarning).toContain('עמלת המרה');
  });

  test('returns blocked when remaining balance is insufficient', () => {
    const result = evaluatePurchase(
      makePurchase({ amount: 500 }),
      makeCashflow({ remainingBalance: 100 }),
    );

    expect(result.verdict).toBe('blocked');
    expect(result.reason).toContain('אינה מספיקה');
  });

  test('adds exchange-fee warning for international purchases', () => {
    const result = evaluatePurchase(
      makePurchase({ isInternational: true }),
      makeCashflow(),
    );

    expect(result.exchangeFeeWarning).toContain('עמלת המרה');
  });

  test('does not add exchange-fee warning for domestic purchases', () => {
    const result = evaluatePurchase(
      makePurchase({ isInternational: false }),
      makeCashflow(),
    );

    expect(result.exchangeFeeWarning).toBeUndefined();
  });
});
