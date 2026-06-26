import {
  getDailyProjection,
  getSafeSpendingLimit,
  getUpcomingCharges,
} from '../cashflowRadar';
import { ObligationType, type MonthInput, type Obligation } from '../../types/cashflow.types';
import { Currency, PurchaseCategory } from '../../types/purchase.types';

function makeObligation(overrides: Partial<Obligation> = {}): Obligation {
  return {
    obligationId: 'security-obligation',
    type: ObligationType.StandingOrder,
    amount: 100,
    dayOfMonth: 5,
    description: 'security',
    category: PurchaseCategory.Utilities,
    cardId: null,
    ...overrides,
  };
}

function makeMonth(overrides: Partial<MonthInput> = {}): MonthInput {
  return {
    year: 2026,
    month: 7,
    currency: Currency.ILS,
    openingBalance: 1_000,
    monthlyIncome: 1_000,
    incomeDayOfMonth: 1,
    obligations: [],
    dangerThreshold: 0,
    ...overrides,
  };
}

describe('cashflowRadar monetary security', () => {
  test.each([0.005, 1_000_000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'invalid openingBalance %p returns a zero-state projection',
    (openingBalance: number) => {
      const projection = getDailyProjection(makeMonth({ openingBalance }));

      expect(projection[0]?.projectedBalance).toBe(0);
      expect(projection[0]?.outflow).toBe(0);
      expect(projection[0]?.inflow).toBe(0);
      expect(getSafeSpendingLimit(makeMonth({ openingBalance }))).toBe(0);
    },
  );

  test.each([0.005, 1_000_000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'invalid monthlyIncome %p returns a zero-state projection',
    (monthlyIncome: number) => {
      const projection = getDailyProjection(makeMonth({ monthlyIncome }));

      expect(projection[0]?.projectedBalance).toBe(0);
      expect(projection[0]?.outflow).toBe(0);
      expect(projection[0]?.inflow).toBe(0);
      expect(getSafeSpendingLimit(makeMonth({ monthlyIncome }))).toBe(0);
    },
  );

  test.each([0.01, 999_999])(
    'valid monetary boundaries %p are accepted for openingBalance and income',
    (amount: number) => {
      const projection = getDailyProjection(makeMonth({
        openingBalance: amount,
        monthlyIncome: 0.01,
      }));

      expect(projection[0]?.projectedBalance).toBeCloseTo(amount + 0.01, 5);
    },
  );

  test.each([0.005, 1_000_000, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'invalid obligation amount %p is ignored',
    (amount: number) => {
      const month = makeMonth({
        obligations: [makeObligation({ amount })],
      });
      const projection = getDailyProjection(month);
      const upcoming = getUpcomingCharges(month);

      expect(projection[4]?.outflow).toBe(0);
      expect(upcoming).toHaveLength(0);
    },
  );

  test('valid obligation boundary amounts are included', () => {
    const month = makeMonth({
      obligations: [
        makeObligation({ obligationId: 'min', amount: 0.01, dayOfMonth: 5 }),
        makeObligation({ obligationId: 'max', amount: 999_999, dayOfMonth: 6 }),
      ],
    });

    expect(getUpcomingCharges(month)).toHaveLength(2);
  });
});
