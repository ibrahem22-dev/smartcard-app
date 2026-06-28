import {
  calculateMissedSavings,
  findBestCard,
} from '../benefitsMatcher';
import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import type {
  Benefit,
  BenefitsClub,
  BenefitsDB,
  BenefitsIssuer,
  Transaction,
} from '../../types/benefits.types';
import {
  Currency,
  PurchaseCategory,
  type OneTimePurchase,
} from '../../types/purchase.types';

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

function makePurchase(
  overrides: Partial<OneTimePurchase> = {},
): OneTimePurchase {
  return {
    purchaseId: 'purchase-1',
    amount: 100,
    currency: Currency.ILS,
    category: PurchaseCategory.Groceries,
    date: '2026-06-28',
    cardId: 'used-card',
    merchantName: 'Supermarket',
    isEssential: true,
    isInternational: false,
    isInstallment: false,
    installmentPlan: null,
    ...overrides,
  };
}

function makeBenefit(overrides: Partial<Benefit> = {}): Benefit {
  return {
    category: PurchaseCategory.Groceries,
    type: 'cashback',
    value: 2.5,
    isInternationalOnly: false,
    description: '2.5% cashback',
    ...overrides,
  };
}

interface DatabaseEntry {
  readonly issuer: string;
  readonly club: string;
  readonly benefits: readonly Benefit[];
}

function makeBenefitsDB(entries: readonly DatabaseEntry[] = []): BenefitsDB {
  const issuers: Record<string, BenefitsIssuer> = {};

  entries.forEach((entry: DatabaseEntry): void => {
    const existingClubs = issuers[entry.issuer]?.clubs ?? {};
    const clubs: Record<string, BenefitsClub> = {
      ...existingClubs,
      [entry.club]: { benefits: entry.benefits },
    };
    issuers[entry.issuer] = { clubs };
  });

  return { issuers };
}

const GOLD_DB = makeBenefitsDB([
  {
    issuer: 'Max',
    club: 'Max Gold',
    benefits: [makeBenefit()],
  },
]);

describe('findBestCard', () => {
  test('returns an empty array when cards are empty', () => {
    expect(findBestCard([], makePurchase(), GOLD_DB)).toEqual([]);
  });

  test('returns an empty array for an empty benefits database', () => {
    expect(findBestCard([makeCard()], makePurchase(), makeBenefitsDB())).toEqual(
      [],
    );
  });

  test('excludes a benefit when the purchase category does not match', () => {
    expect(
      findBestCard(
        [makeCard()],
        makePurchase({ category: PurchaseCategory.Fuel }),
        GOLD_DB,
      ),
    ).toEqual([]);
  });

  test('excludes an international-only benefit for a domestic purchase', () => {
    const database = makeBenefitsDB([
      {
        issuer: 'Max',
        club: 'Max Gold',
        benefits: [makeBenefit({ isInternationalOnly: true })],
      },
    ]);

    expect(findBestCard([makeCard()], makePurchase(), database)).toEqual([]);
  });

  test('includes an international-only benefit for an international purchase', () => {
    const benefit = makeBenefit({ isInternationalOnly: true });
    const database = makeBenefitsDB([
      { issuer: 'Max', club: 'Max Gold', benefits: [benefit] },
    ]);

    expect(
      findBestCard(
        [makeCard()],
        makePurchase({ isInternational: true }),
        database,
      ),
    ).toEqual([
      { card: makeCard(), benefit, estimatedSaving: 2.5 },
    ]);
  });

  test('does not apply a Max Gold benefit to a Max Platinum card', () => {
    expect(
      findBestCard(
        [makeCard({ displayName: 'Max Platinum' })],
        makePurchase(),
        GOLD_DB,
      ),
    ).toEqual([]);
  });

  test('does not match a club belonging to another issuer', () => {
    expect(
      findBestCard(
        [makeCard({ issuer: CardIssuer.Isracard })],
        makePurchase(),
        GOLD_DB,
      ),
    ).toEqual([]);
  });

  test('returns a zero-value matched benefit with zero estimated saving', () => {
    const benefit = makeBenefit({ value: 0 });
    const database = makeBenefitsDB([
      { issuer: 'Max', club: 'Max Gold', benefits: [benefit] },
    ]);

    expect(findBestCard([makeCard()], makePurchase(), database)[0]).toEqual({
      card: makeCard(),
      benefit,
      estimatedSaving: 0,
    });
  });

  test('sorts multiple matching cards by estimated saving descending', () => {
    const platinumCard = makeCard({
      cardId: 'max-platinum',
      displayName: 'Max Platinum',
    });
    const database = makeBenefitsDB([
      { issuer: 'Max', club: 'Max Gold', benefits: [makeBenefit({ value: 2 })] },
      {
        issuer: 'Max',
        club: 'Max Platinum',
        benefits: [makeBenefit({ value: 5 })],
      },
    ]);

    const result = findBestCard(
      [makeCard(), platinumCard],
      makePurchase({ amount: 200 }),
      database,
    );

    expect(result.map(match => match.card.cardId)).toEqual([
      'max-platinum',
      'max-gold',
    ]);
    expect(result.map(match => match.estimatedSaving)).toEqual([10, 4]);
  });

  test('uses the highest-value eligible benefit when a club has several', () => {
    const database = makeBenefitsDB([
      {
        issuer: 'Max',
        club: 'Max Gold',
        benefits: [
          makeBenefit({ value: 1 }),
          makeBenefit({ value: 4 }),
          makeBenefit({ value: 3 }),
        ],
      },
    ]);

    expect(findBestCard([makeCard()], makePurchase(), database)[0]?.benefit.value)
      .toBe(4);
  });

  test('excludes inactive cards', () => {
    expect(
      findBestCard([makeCard({ isActive: false })], makePurchase(), GOLD_DB),
    ).toEqual([]);
  });

  test('rejects a non-positive purchase amount without throwing', () => {
    expect(findBestCard([makeCard()], makePurchase({ amount: -1 }), GOLD_DB))
      .toEqual([]);
    expect(findBestCard([makeCard()], makePurchase({ amount: 0 }), GOLD_DB))
      .toEqual([]);
    expect(
      findBestCard(
        [makeCard()],
        makePurchase({ amount: Number.NaN }),
        GOLD_DB,
      ),
    ).toEqual([]);
  });

  test('rounds estimated savings to agorot', () => {
    expect(
      findBestCard(
        [makeCard()],
        makePurchase({ amount: 99.99 }),
        GOLD_DB,
      )[0]?.estimatedSaving,
    ).toBe(2.5);
  });

  test('handles invalid and duplicate benefit values deterministically', () => {
    const first = makeBenefit({ description: 'first equal benefit' });
    const database = makeBenefitsDB([
      {
        issuer: 'Max',
        club: 'Max Gold',
        benefits: [
          makeBenefit({ value: Number.NaN }),
          first,
          makeBenefit({ description: 'second equal benefit' }),
        ],
      },
    ]);

    const result = findBestCard([makeCard()], makePurchase(), database);

    expect(result[0]?.benefit).toBe(first);
    expect(result[0]?.estimatedSaving).toBe(2.5);
  });
});

describe('calculateMissedSavings', () => {
  test('returns zero and no breakdown for zero transactions', () => {
    expect(calculateMissedSavings([makeCard()], [], GOLD_DB)).toEqual({
      totalMissed: 0,
      breakdown: [],
    });
  });

  test('returns empty gracefully for an empty benefits database', () => {
    expect(
      calculateMissedSavings(
        [makeCard()],
        [makePurchase()],
        makeBenefitsDB(),
      ),
    ).toEqual({ totalMissed: 0, breakdown: [] });
  });

  test('records saving when a non-used card has a benefit', () => {
    const transaction = makePurchase({ amount: 200 });
    const result = calculateMissedSavings(
      [makeCard()],
      [transaction],
      GOLD_DB,
    );

    expect(result.totalMissed).toBe(5);
    expect(result.breakdown[0]).toEqual({
      transaction,
      bestCard: makeCard(),
      missedAmount: 5,
    });
  });

  test('subtracts the benefit earned by the card that was used', () => {
    const usedCard = makeCard({
      cardId: 'used-card',
      displayName: 'Max Basic',
    });
    const database = makeBenefitsDB([
      { issuer: 'Max', club: 'Max Gold', benefits: [makeBenefit({ value: 5 })] },
      { issuer: 'Max', club: 'Max Basic', benefits: [makeBenefit({ value: 2 })] },
    ]);

    expect(
      calculateMissedSavings(
        [usedCard, makeCard()],
        [makePurchase({ amount: 100 })],
        database,
      ).totalMissed,
    ).toBe(3);
  });

  test('does not report a row when the used card is already best', () => {
    const usedCard = makeCard({ cardId: 'used-card' });

    expect(
      calculateMissedSavings(
        [usedCard],
        [makePurchase()],
        GOLD_DB,
      ),
    ).toEqual({ totalMissed: 0, breakdown: [] });
  });

  test('uses the highest-value alternative card', () => {
    const platinumCard = makeCard({
      cardId: 'platinum',
      displayName: 'Max Platinum',
    });
    const database = makeBenefitsDB([
      { issuer: 'Max', club: 'Max Gold', benefits: [makeBenefit({ value: 2 })] },
      {
        issuer: 'Max',
        club: 'Max Platinum',
        benefits: [makeBenefit({ value: 7 })],
      },
    ]);

    const result = calculateMissedSavings(
      [makeCard(), platinumCard],
      [makePurchase()],
      database,
    );

    expect(result.breakdown[0]?.bestCard.cardId).toBe('platinum');
    expect(result.totalMissed).toBe(7);
  });

  test('keeps input card order when equal-value alternatives tie', () => {
    const first = makeCard({ cardId: 'first' });
    const second = makeCard({ cardId: 'second' });

    expect(
      calculateMissedSavings(
        [first, second],
        [makePurchase()],
        GOLD_DB,
      ).breakdown[0]?.bestCard.cardId,
    ).toBe('first');
  });

  test('calculates a three-transaction breakdown and total', () => {
    const transactions: readonly Transaction[] = [
      makePurchase({ purchaseId: 'one', amount: 100 }),
      makePurchase({ purchaseId: 'two', amount: 200 }),
      makePurchase({ purchaseId: 'three', amount: 300 }),
    ];
    const result = calculateMissedSavings(
      [makeCard()],
      transactions,
      GOLD_DB,
    );

    expect(result.breakdown.map(row => row.missedAmount)).toEqual([2.5, 5, 7.5]);
    expect(result.totalMissed).toBe(15);
  });

  test('skips domestic transactions for international-only benefits', () => {
    const database = makeBenefitsDB([
      {
        issuer: 'Max',
        club: 'Max Gold',
        benefits: [makeBenefit({ isInternationalOnly: true })],
      },
    ]);

    expect(
      calculateMissedSavings(
        [makeCard()],
        [makePurchase()],
        database,
      ),
    ).toEqual({ totalMissed: 0, breakdown: [] });
  });

  test('includes international transactions for international-only benefits', () => {
    const database = makeBenefitsDB([
      {
        issuer: 'Max',
        club: 'Max Gold',
        benefits: [makeBenefit({ value: 3, isInternationalOnly: true })],
      },
    ]);

    expect(
      calculateMissedSavings(
        [makeCard()],
        [makePurchase({ amount: 150, isInternational: true })],
        database,
      ).totalMissed,
    ).toBe(4.5);
  });

  test('ignores zero-value alternatives', () => {
    const database = makeBenefitsDB([
      {
        issuer: 'Max',
        club: 'Max Gold',
        benefits: [makeBenefit({ value: 0 })],
      },
    ]);

    expect(
      calculateMissedSavings(
        [makeCard()],
        [makePurchase()],
        database,
      ),
    ).toEqual({ totalMissed: 0, breakdown: [] });
  });

  test('rounds the aggregate total to agorot', () => {
    const transactions = [
      makePurchase({ purchaseId: 'one', amount: 33.33 }),
      makePurchase({ purchaseId: 'two', amount: 33.33 }),
      makePurchase({ purchaseId: 'three', amount: 33.33 }),
    ];

    expect(
      calculateMissedSavings([makeCard()], transactions, GOLD_DB).totalMissed,
    ).toBe(2.49);
  });
});
