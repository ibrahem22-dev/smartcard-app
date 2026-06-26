import {
  calculateMonthlyRisk,
  detectMinus,
  getDailyProjection,
  getSafeSpendingLimit,
  getUpcomingCharges,
  predictChargeReturn,
} from '../cashflowRadar';
import {
  ObligationType,
  type DayBalance,
  type MonthInput,
  type Obligation,
  RiskLevel,
} from '../../types/cashflow.types';
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
    id: 'user-cashflow',
    bankName: 'לאומי',
    monthlyIncome: 10_000,
    currentBalance: 5_000,
    dangerThreshold: 1_000,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeCard(overrides: Partial<CardInput> = {}): CardInput {
  return {
    cardId: 'card-cashflow',
    displayName: 'Cashflow Test Card',
    last4: '4321',
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
    roleTags: [CardRole.Daily],
    primaryRole: CardRole.Daily,
    rewardCategories: [PurchaseCategory.Utilities],
    cashbackRate: 0.01,
    foreignTransactionFee: 0.03,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
    ...overrides,
  };
}

function makeObligation(overrides: Partial<Obligation> = {}): Obligation {
  const card = makeCard();

  return {
    obligationId: 'obligation-test',
    type: ObligationType.StandingOrder,
    amount: 500,
    dayOfMonth: 5,
    description: 'rent',
    category: PurchaseCategory.Utilities,
    cardId: card.cardId,
    ...overrides,
  };
}

function makeMonth(overrides: Partial<MonthInput> = {}): MonthInput {
  const user = makeUser();

  return {
    year: 2026,
    month: 7,
    currency: Currency.ILS,
    openingBalance: user.currentBalance,
    monthlyIncome: user.monthlyIncome,
    incomeDayOfMonth: 1,
    obligations: [],
    dangerThreshold: user.dangerThreshold,
    ...overrides,
  };
}

describe('cashflowRadar', () => {
  test('detectMinus flags a projection that dips below zero', () => {
    const projection: readonly DayBalance[] = [
      {
        date: '2026-07-01',
        dayOfMonth: 1,
        projectedBalance: 100,
        outflow: 0,
        inflow: 0,
        isOverdraft: false,
        belowDanger: false,
      },
      {
        date: '2026-07-02',
        dayOfMonth: 2,
        projectedBalance: -1,
        outflow: 101,
        inflow: 0,
        isOverdraft: true,
        belowDanger: true,
      },
    ];

    expect(detectMinus(projection)).toBe(true);
  });

  test('detectMinus returns false when every projected balance stays positive', () => {
    const projection: readonly DayBalance[] = [
      {
        date: '2026-07-01',
        dayOfMonth: 1,
        projectedBalance: 100,
        outflow: 0,
        inflow: 0,
        isOverdraft: false,
        belowDanger: false,
      },
      {
        date: '2026-07-02',
        dayOfMonth: 2,
        projectedBalance: 50,
        outflow: 50,
        inflow: 0,
        isOverdraft: false,
        belowDanger: false,
      },
    ];

    expect(detectMinus(projection)).toBe(false);
  });

  test('getDailyProjection returns a full 30-day window with explicit day-1 and day-30 values', () => {
    const user = makeUser({ currentBalance: 1_000, monthlyIncome: 3_000 });
    const month = makeMonth({
      openingBalance: user.currentBalance,
      monthlyIncome: user.monthlyIncome,
      incomeDayOfMonth: 1,
      obligations: [
        makeObligation({ obligationId: 'day-01', amount: 200, dayOfMonth: 1 }),
        makeObligation({ obligationId: 'day-30', amount: 400, dayOfMonth: 30 }),
      ],
      dangerThreshold: 500,
    });

    const projection = getDailyProjection(month);

    expect(projection).toHaveLength(31);
    expect(projection[0]?.date).toBe('2026-07-01');
    expect(projection[0]?.projectedBalance).toBe(3_800);
    expect(projection[29]?.date).toBe('2026-07-30');
    expect(projection[29]?.projectedBalance).toBe(3_400);
  });

  test('getDailyProjection includes day-31 obligations in a 31-day month', () => {
    const month = makeMonth({
      year: 2026,
      month: 1,
      openingBalance: 1_000,
      monthlyIncome: 0.01,
      incomeDayOfMonth: 31,
      obligations: [
        makeObligation({ obligationId: 'jan-31', amount: 300, dayOfMonth: 31 }),
      ],
      dangerThreshold: 0,
    });

    const projection = getDailyProjection(month);

    expect(projection).toHaveLength(31);
    expect(projection[30]?.date).toBe('2026-01-31');
    expect(projection[30]?.outflow).toBe(300);
    expect(projection[30]?.projectedBalance).toBeCloseTo(700.01, 5);
  });

  test('getDailyProjection marks danger and overdraft days correctly', () => {
    const month = makeMonth({
      openingBalance: 300,
      monthlyIncome: 0.01,
      incomeDayOfMonth: 1,
      obligations: [
        makeObligation({ obligationId: 'large-charge', amount: 500, dayOfMonth: 2 }),
      ],
      dangerThreshold: 100,
    });

    const projection = getDailyProjection(month);

    expect(projection[0]?.projectedBalance).toBeCloseTo(300.01, 5);
    expect(projection[0]?.belowDanger).toBe(false);
    expect(projection[1]?.projectedBalance).toBeCloseTo(-199.99, 5);
    expect(projection[1]?.isOverdraft).toBe(true);
    expect(projection[1]?.belowDanger).toBe(true);
  });

  test('getDailyProjection clamps day-31 obligations to the last day of February', () => {
    const month = makeMonth({
      year: 2026,
      month: 2,
      openingBalance: 1_000,
      monthlyIncome: 0.01,
      incomeDayOfMonth: 31,
      obligations: [
        makeObligation({ obligationId: 'end-of-month', amount: 250, dayOfMonth: 31 }),
      ],
      dangerThreshold: 0,
    });

    const projection = getDailyProjection(month);

    expect(projection[27]?.date).toBe('2026-02-28');
    expect(projection[27]?.outflow).toBe(250);
    expect(projection[27]?.projectedBalance).toBeCloseTo(750.01, 5);
    expect(projection[29]?.date).toBe('2026-03-02');
  });

  test('getUpcomingCharges returns obligations sorted ascending by due date', () => {
    const month = makeMonth({
      obligations: [
        makeObligation({ obligationId: 'charge-20', dayOfMonth: 20 }),
        makeObligation({ obligationId: 'charge-03', dayOfMonth: 3 }),
        makeObligation({ obligationId: 'charge-10', dayOfMonth: 10 }),
      ],
    });

    const upcoming = getUpcomingCharges(month);

    expect(upcoming).toHaveLength(3);
    expect(upcoming[0]?.obligationId).toBe('charge-03');
    expect(upcoming[1]?.obligationId).toBe('charge-10');
    expect(upcoming[2]?.obligationId).toBe('charge-20');
  });

  test('getUpcomingCharges sorts same-day obligations by id for stable ordering', () => {
    const month = makeMonth({
      obligations: [
        makeObligation({ obligationId: 'b-charge', dayOfMonth: 7 }),
        makeObligation({ obligationId: 'a-charge', dayOfMonth: 7 }),
      ],
    });

    const upcoming = getUpcomingCharges(month);

    expect(upcoming[0]?.obligationId).toBe('a-charge');
    expect(upcoming[1]?.obligationId).toBe('b-charge');
  });

  test('getUpcomingCharges handles an empty obligation array without crashing', () => {
    const month = makeMonth({ obligations: [] });

    const upcoming = getUpcomingCharges(month);

    expect(upcoming).toHaveLength(0);
  });

  test('getUpcomingCharges filters invalid and non-positive obligations', () => {
    const month = makeMonth({
      obligations: [
        makeObligation({ obligationId: 'valid', amount: 100, dayOfMonth: 2 }),
        makeObligation({ obligationId: 'zero', amount: 0, dayOfMonth: 3 }),
        makeObligation({ obligationId: 'negative', amount: -1, dayOfMonth: 4 }),
        makeObligation({ obligationId: 'bad-day', amount: 100, dayOfMonth: 32 }),
      ],
    });

    const upcoming = getUpcomingCharges(month);

    expect(upcoming).toHaveLength(1);
    expect(upcoming[0]?.obligationId).toBe('valid');
  });

  test('getSafeSpendingLimit returns 0 when already in minus', () => {
    const month = makeMonth({ openingBalance: -10 });

    expect(getSafeSpendingLimit(month)).toBe(0);
  });

  test('getSafeSpendingLimit returns 0 when monthly income is zero', () => {
    const month = makeMonth({
      openingBalance: 5_000,
      monthlyIncome: 0,
      obligations: [],
      dangerThreshold: 1_000,
    });

    expect(getSafeSpendingLimit(month)).toBe(0);
  });

  test('getSafeSpendingLimit returns the correct positive limit when cashflow is healthy', () => {
    const month = makeMonth({
      openingBalance: 5_000,
      monthlyIncome: 2_000,
      incomeDayOfMonth: 10,
      obligations: [
        makeObligation({ obligationId: 'rent', amount: 1_500, dayOfMonth: 5 }),
        makeObligation({ obligationId: 'utilities', amount: 300, dayOfMonth: 20 }),
      ],
      dangerThreshold: 1_000,
    });

    expect(getSafeSpendingLimit(month)).toBe(2_500);
  });

  test('charge return risk within seven days forces safe spending limit to 0', () => {
    const month = makeMonth({
      openingBalance: 1_000,
      monthlyIncome: 0.01,
      incomeDayOfMonth: 20,
      obligations: [
        makeObligation({
          obligationId: 'card-billing',
          type: ObligationType.CardBilling,
          amount: 1_200,
          dayOfMonth: 6,
        }),
      ],
      dangerThreshold: 0,
    });
    const projection = getDailyProjection(month);

    expect(projection[5]?.projectedBalance).toBe(-200);
    expect(detectMinus(projection.slice(0, 7))).toBe(true);
    expect(getSafeSpendingLimit(month)).toBe(0);
  });

  test('predictChargeReturn flags a card whose billing charge would bounce', () => {
    const risk = predictChargeReturn(
      [makeCard({
        cardId: 'risk-card',
        framework: {
          creditLimit: 20_000,
          currentBalance: 2_000,
        },
        billingCycle: {
          statementClosingDay: 25,
          billingDayOfMonth: 10,
        },
      })],
      [makeObligation({ amount: 600, dayOfMonth: 5 })],
      2_500,
    );

    expect(risk.atRisk).toBe(true);
    expect(risk.cardId).toBe('risk-card');
    expect(risk.shortfall).toBe(100);
  });

  test('predictChargeReturn returns no risk when balance covers obligations and card charge', () => {
    const risk = predictChargeReturn(
      [makeCard({
        framework: {
          creditLimit: 20_000,
          currentBalance: 1_000,
        },
      })],
      [makeObligation({ amount: 500, dayOfMonth: 5 })],
      3_000,
    );

    expect(risk.atRisk).toBe(false);
    expect(risk.cardId).toBeNull();
  });

  test('calculateMonthlyRisk returns safe score for healthy cashflow', () => {
    const risk = calculateMonthlyRisk(makeMonth({
      openingBalance: 5_000,
      monthlyIncome: 5_000,
      obligations: [makeObligation({ amount: 500, dayOfMonth: 10 })],
      dangerThreshold: 500,
    }));

    expect(risk.score).toBe(0);
    expect(risk.level).toBe(RiskLevel.Safe);
    expect(risk.hasOverdraftRisk).toBe(false);
  });

  test('calculateMonthlyRisk returns critical score for overdraft and charge return risk', () => {
    const risk = calculateMonthlyRisk(makeMonth({
      openingBalance: 500,
      monthlyIncome: 0.01,
      incomeDayOfMonth: 20,
      obligations: [
        makeObligation({ amount: 800, dayOfMonth: 3 }),
        makeObligation({ amount: 200, dayOfMonth: 4 }),
      ],
      dangerThreshold: 100,
    }));

    expect(risk.score).toBeGreaterThanOrEqual(75);
    expect(risk.level).toBe(RiskLevel.Critical);
    expect(risk.hasOverdraftRisk).toBe(true);
    expect(risk.daysBelowDanger).toBeGreaterThan(0);
  });
});
