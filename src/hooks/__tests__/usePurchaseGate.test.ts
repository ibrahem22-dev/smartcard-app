import { evaluatePurchase } from '../../engines/purchaseGate';
import { mapImportedInstallmentsToObligations } from '../mapImportedInstallmentsToObligations';
import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import { ObligationType } from '../../types/cashflow.types';
import type { PurchaseGateInput } from '../../types/decision.types';
import type { ImportedInstallment } from '../../types/installment.types';
import {
  Currency,
  PurchaseCategory,
  type OneTimePurchase,
  type PurchaseInput,
} from '../../types/purchase.types';

function makeCard(overrides: Partial<CardInput> = {}): CardInput {
  return {
    cardId: 'card-gate-1',
    displayName: 'Gate Test Card',
    last4: '4242',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: {
      creditLimit: 20_000,
      currentBalance: 500,
    },
    billingCycle: {
      statementClosingDay: 25,
      billingDayOfMonth: 28,
    },
    roleTags: [CardRole.Daily],
    primaryRole: CardRole.Daily,
    rewardCategories: [PurchaseCategory.Other],
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
    merchantName: 'IKEA',
    totalAmount: 3_000,
    monthsRemaining: 6,
    monthlyPayment: 1_500,
    billingCardId: 'card-gate-1',
    source: 'imported',
    ...overrides,
  };
}

function makePurchase(overrides: Partial<OneTimePurchase> = {}): PurchaseInput {
  const base: OneTimePurchase = {
    purchaseId: 'manual-purchase-check',
    amount: 100,
    currency: Currency.ILS,
    category: PurchaseCategory.Other,
    date: '2026-07-15',
    cardId: 'card-gate-1',
    merchantName: 'בדיקת רכישה',
    isEssential: false,
    isInternational: false,
    isInstallment: false,
    installmentPlan: null,
  };

  return { ...base, ...overrides };
}

function makeGateInput(
  overrides: Partial<PurchaseGateInput> = {},
): PurchaseGateInput {
  return {
    snapshotDate: '2026-07-15T12:00:00.000Z',
    currentBalance: 2_000,
    remainingBalance: 5_000,
    monthlyIncome: 10_000,
    obligations: [],
    lastPurchaseDate: null,
    availableCards: [makeCard()],
    ...overrides,
  };
}

describe('mapImportedInstallmentsToObligations', (): void => {
  test('maps installment fields onto Obligation using the billing card day', (): void => {
    const card = makeCard({ billingCycle: { statementClosingDay: 20, billingDayOfMonth: 12 } });
    const installment = makeInstallment({
      installmentId: 'inst-map',
      monthlyPayment: 450,
      merchantName: 'Super-Pharm',
      billingCardId: card.cardId,
    });

    const mapped = mapImportedInstallmentsToObligations([installment], [card]);

    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toEqual({
      obligationId: 'inst-map',
      type: ObligationType.InstallmentCharge,
      amount: 450,
      dayOfMonth: 12,
      description: 'Super-Pharm',
      category: PurchaseCategory.Other,
      cardId: card.cardId,
    });
  });

  test('leaves dayOfMonth as 0 when card is missing or billing day is unknown (LOCK-007)', (): void => {
    const unknownDayCard = makeCard({
      cardId: 'card-unknown-day',
      billingCycle: { statementClosingDay: 1, billingDayOfMonth: 0 },
    });
    const orphan = makeInstallment({
      installmentId: 'inst-orphan',
      billingCardId: 'missing-card',
    });
    const unknownDay = makeInstallment({
      installmentId: 'inst-unknown-day',
      billingCardId: unknownDayCard.cardId,
    });

    const mapped = mapImportedInstallmentsToObligations(
      [orphan, unknownDay],
      [unknownDayCard],
    );

    expect(mapped[0]?.dayOfMonth).toBe(0);
    expect(mapped[0]?.cardId).toBe('missing-card');
    expect(mapped[1]?.dayOfMonth).toBe(0);
  });
});

describe('usePurchaseGate obligations wiring', (): void => {
  test('mapped installment that triggers charge-return risk blocks vs empty obligations', (): void => {
    const card = makeCard();
    const installment = makeInstallment({ monthlyPayment: 1_500 });
    const mappedObligations = mapImportedInstallmentsToObligations(
      [installment],
      [card],
    );

    expect(mappedObligations[0]?.obligationId).toBe(installment.installmentId);
    expect(mappedObligations[0]?.amount).toBe(1_500);
    expect(mappedObligations[0]?.dayOfMonth).toBe(28);

    // predictChargeReturn defaults to Date.now — pin July 15 so billing day 28
    // is still in the future and the installment obligation is counted.
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 6, 15)));

    try {
      const withEmpty = evaluatePurchase(
        makePurchase({ amount: 100 }),
        makeGateInput({
          availableCards: [card],
          obligations: [],
        }),
      );
      const withInstallment = evaluatePurchase(
        makePurchase({ amount: 100 }),
        makeGateInput({
          availableCards: [card],
          obligations: mappedObligations,
        }),
      );

      expect(withEmpty.verdict).not.toBe('blocked');
      expect(withInstallment.verdict).toBe('blocked');
      expect(withInstallment.reason).toContain('חזרת חיוב');
      expect(withInstallment.reasonAr.length).toBeGreaterThan(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
