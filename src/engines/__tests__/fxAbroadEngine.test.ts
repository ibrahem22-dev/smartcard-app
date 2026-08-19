import { rankCardsAbroad } from '../fxAbroadEngine';
import { resolveFxAbroad } from '../../hooks/useFxAbroad';
import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import { Currency, PurchaseCategory } from '../../types/purchase.types';

function makeCard(overrides: Partial<CardInput> = {}): CardInput {
  return {
    cardId: 'fx-test',
    displayName: 'FX Test Card',
    last4: '4242',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: { creditLimit: 15_000, currentBalance: 500 },
    billingCycle: { statementClosingDay: 25, billingDayOfMonth: 10 },
    roleTags: [CardRole.Travel],
    primaryRole: null,
    rewardCategories: [PurchaseCategory.Groceries],
    cashbackRate: 0.01,
    foreignTransactionFee: 0.03,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
    ...overrides,
  };
}

describe('resolveFxAbroad', () => {
  test('resolves a covered CAL card matched by a Hebrew alias', () => {
    const card = makeCard({ issuer: CardIssuer.Cal, displayName: 'שופרסל' });
    const result = resolveFxAbroad(card);

    expect(result.status).toBe('verified');
    if (result.status === 'verified') {
      expect(result.triple.cardId).toBe('cal-shufersal-visa');
      expect(result.triple.tier).toBe('A');
      expect(result.triple.fxPurchasePct.value).toBe(3);
      expect(result.triple.withdrawalSameCurrency.value).toBe(16);
      expect(result.triple.withdrawalSameCurrency.unit).toBe('ils');
    }
  });

  test('resolves American Express Platinum by exact English name', () => {
    const card = makeCard({
      issuer: CardIssuer.Isracard,
      displayName: 'American Express Platinum',
    });
    const result = resolveFxAbroad(card);

    expect(result.status).toBe('verified');
    if (result.status === 'verified') {
      expect(result.triple.cardId).toBe('card-amex-platinacard');
      expect(result.triple.fxPurchasePct.value).toBe(2.5);
    }
  });

  test('an uncovered card resolves to unknown — NO silent default', () => {
    const card = makeCard({
      issuer: CardIssuer.Cal,
      displayName: 'Some Unlisted Card 9987',
    });
    const result = resolveFxAbroad(card);

    expect(result.status).toBe('unknown');
    if (result.status === 'unknown') {
      expect(result.reason).toBe('no_verified_fx_data');
    }
  });

  test('every resolved leg carries source provenance (url + hash + date)', () => {
    const result = resolveFxAbroad(
      makeCard({ issuer: CardIssuer.Cal, displayName: 'שופרסל' }),
    );
    expect(result.status).toBe('verified');
    if (result.status === 'verified') {
      const leg = result.triple.fxPurchasePct;
      expect(leg.source.url).toMatch(/^https?:\/\//);
      expect(leg.source.hash.length).toBeGreaterThan(0);
      expect(leg.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('rankCardsAbroad', () => {
  const platinum = makeCard({
    cardId: 'u-amex',
    issuer: CardIssuer.Isracard,
    displayName: 'American Express Platinum',
  });
  const shufersal = makeCard({
    cardId: 'u-cal',
    issuer: CardIssuer.Cal,
    displayName: 'שופרסל',
  });
  const uncovered = makeCard({
    cardId: 'u-x',
    issuer: CardIssuer.Cal,
    displayName: 'Some Unlisted Card 9987',
  });

  test('ranks only Tier-A cards, cheapest purchase fee first', () => {
    const { ranked, unknown } = rankCardsAbroad(
      [shufersal, platinum, uncovered],
      'purchase',
    );

    // Platinum 2.5% < Shufersal 3% ; uncovered is not ranked.
    expect(ranked.map((entry) => entry.card.cardId)).toEqual(['u-amex', 'u-cal']);
    expect(ranked[0]?.leg.value).toBe(2.5);
    expect(unknown.map((card) => card.cardId)).toEqual(['u-x']);
  });

  test('cashWithdrawal mode selects the foreign-cash-withdrawal leg', () => {
    const { ranked } = rankCardsAbroad([platinum], 'cashWithdrawal');

    expect(ranked).toHaveLength(1);
    // Amex Platinum foreign cash withdrawal = 3.5%.
    expect(ranked[0]?.leg.value).toBe(3.5);
  });

  test('an all-unknown card list yields an empty ranking, never a default', () => {
    const { ranked, unknown } = rankCardsAbroad([uncovered], 'purchase');

    expect(ranked).toHaveLength(0);
    expect(unknown).toHaveLength(1);
  });
});
