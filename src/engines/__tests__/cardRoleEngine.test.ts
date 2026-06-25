import { assignCardRole, recommendCard } from '../cardRoleEngine';
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
    id: 'user-role',
    bankName: 'לאומי',
    monthlyIncome: 12_000,
    currentBalance: 6_000,
    dangerThreshold: 1_200,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeCard(overrides: Partial<CardInput> = {}): CardInput {
  return {
    cardId: 'card-role',
    displayName: 'Role Test Card',
    last4: '4242',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: {
      creditLimit: 15_000,
      currentBalance: 500,
    },
    billingCycle: {
      statementClosingDay: 25,
      billingDayOfMonth: 10,
    },
    roleTags: [CardRole.Daily],
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

describe('cardRoleEngine', () => {
  test('assignCardRole returns an existing primary role unchanged', () => {
    const card = makeCard({ primaryRole: CardRole.Travel });

    expect(assignCardRole(card, makeUser())).toBe(CardRole.Travel);
  });

  test('assignCardRole picks travel when FX fee is low', () => {
    const card = makeCard({
      primaryRole: null,
      roleTags: [],
      rewardCategories: [],
      foreignTransactionFee: 0.01,
    });

    expect(assignCardRole(card, makeUser())).toBe(CardRole.Travel);
  });

  test('assignCardRole picks subscriptions from reward categories', () => {
    const card = makeCard({
      primaryRole: null,
      roleTags: [],
      rewardCategories: [PurchaseCategory.Subscriptions],
      foreignTransactionFee: 0.03,
    });

    expect(assignCardRole(card, makeUser())).toBe(CardRole.Subscriptions);
  });

  test('assignCardRole defaults to daily for a generic card', () => {
    const card = makeCard({
      primaryRole: null,
      roleTags: [],
      rewardCategories: [PurchaseCategory.Other],
      cashbackRate: 0.005,
      foreignTransactionFee: 0.03,
    });

    expect(assignCardRole(card, makeUser())).toBe(CardRole.Daily);
  });

  test('recommendCard happy path ranks the category-matching card highest', () => {
    const groceriesCard = makeCard({
      cardId: 'groceries',
      rewardCategories: [PurchaseCategory.Groceries],
      cashbackRate: 0.02,
    });
    const diningCard = makeCard({
      cardId: 'dining',
      rewardCategories: [PurchaseCategory.Dining],
      cashbackRate: 0.03,
    });

    const result = recommendCard(
      [diningCard, groceriesCard],
      PurchaseCategory.Groceries,
      makeUser(),
      false,
    );

    expect(result).not.toBeNull();
    expect(result?.card.cardId).toBe('groceries');
    expect(result?.score).toBeGreaterThan(50);
  });

  test('recommendCard returns null for an empty active-card list', () => {
    const inactive = makeCard({ isActive: false });

    expect(
      recommendCard([inactive], PurchaseCategory.Groceries, makeUser(), false),
    ).toBeNull();
  });

  test('recommendCard flags unknownClub in scoreReason', () => {
    const card = makeCard({ unknownClub: true });

    const result = recommendCard(
      [card],
      PurchaseCategory.Groceries,
      makeUser(),
      false,
    );

    expect(result?.scoreReason).toContain('מועדון לא ידוע');
    expect(result?.scoreReasonAr.length).toBeGreaterThan(0);
  });

  test('recommendCard weights travel higher for international purchases', () => {
    const travelCard = makeCard({
      cardId: 'travel',
      roleTags: [CardRole.Travel],
      primaryRole: CardRole.Travel,
      rewardCategories: [PurchaseCategory.Travel],
      foreignTransactionFee: 0.01,
    });
    const dailyCard = makeCard({
      cardId: 'daily',
      roleTags: [CardRole.Daily],
      primaryRole: CardRole.Daily,
      rewardCategories: [PurchaseCategory.Groceries],
      foreignTransactionFee: 0.03,
    });

    const result = recommendCard(
      [dailyCard, travelCard],
      PurchaseCategory.Travel,
      makeUser(),
      true,
    );

    expect(result?.card.cardId).toBe('travel');
  });

  test('recommendCard applies the bank-match bonus', () => {
    const matched = makeCard({
      cardId: 'matched',
      bankName: 'לאומי',
      rewardCategories: [PurchaseCategory.Groceries],
    });
    const other = makeCard({
      cardId: 'other',
      bankName: 'דיסקונט',
      rewardCategories: [PurchaseCategory.Groceries],
    });

    const result = recommendCard(
      [other, matched],
      PurchaseCategory.Groceries,
      makeUser({ bankName: 'לאומי' }),
      false,
    );

    expect(result?.card.cardId).toBe('matched');
    expect(result?.scoreReason).toContain('בנק');
  });

  test('recommendCard clamps score to 0-100', () => {
    const highCard = makeCard({
      cashbackRate: 0.5,
      rewardCategories: [
        PurchaseCategory.Groceries,
        PurchaseCategory.Dining,
        PurchaseCategory.Travel,
      ],
      bankName: 'לאומי',
      foreignTransactionFee: 0.001,
      roleTags: [CardRole.Travel],
      primaryRole: CardRole.Travel,
    });

    const result = recommendCard(
      [highCard],
      PurchaseCategory.Groceries,
      makeUser({ bankName: 'לאומי' }),
      true,
    );

    expect(result?.score).toBeLessThanOrEqual(100);
    expect(result?.score).toBeGreaterThanOrEqual(0);
  });

  test('recommendCard handles multiple cards and picks the best score', () => {
    const weak = makeCard({
      cardId: 'weak',
      cashbackRate: 0.001,
      rewardCategories: [PurchaseCategory.Other],
    });
    const strong = makeCard({
      cardId: 'strong',
      cashbackRate: 0.04,
      rewardCategories: [PurchaseCategory.Fuel],
    });

    const result = recommendCard(
      [weak, strong],
      PurchaseCategory.Fuel,
      makeUser(),
      false,
    );

    expect(result?.card.cardId).toBe('strong');
  });

  test('recommendCard keeps the first card when scores tie', () => {
    const first = makeCard({
      cardId: 'first',
      rewardCategories: [PurchaseCategory.Groceries],
      cashbackRate: 0.01,
    });
    const second = makeCard({
      cardId: 'second',
      rewardCategories: [PurchaseCategory.Groceries],
      cashbackRate: 0.01,
    });

    const result = recommendCard(
      [first, second],
      PurchaseCategory.Groceries,
      makeUser(),
      false,
    );

    expect(result?.card.cardId).toBe('first');
  });

  test('assignCardRole picks education from reward categories', () => {
    const card = makeCard({
      primaryRole: null,
      roleTags: [],
      rewardCategories: [PurchaseCategory.Education],
      foreignTransactionFee: 0.03,
      cashbackRate: 0.005,
    });

    expect(assignCardRole(card, makeUser())).toBe(CardRole.Education);
  });

  test('assignCardRole picks installments when tagged and supported', () => {
    const card = makeCard({
      primaryRole: null,
      roleTags: [CardRole.Daily, CardRole.Installments],
      rewardCategories: [PurchaseCategory.Shopping],
      supportsInstallments: true,
      foreignTransactionFee: 0.03,
      cashbackRate: 0.005,
    });

    expect(assignCardRole(card, makeUser())).toBe(CardRole.Installments);
  });

  test('assignCardRole picks benefits for high cashback cards', () => {
    const card = makeCard({
      primaryRole: null,
      roleTags: [],
      rewardCategories: [PurchaseCategory.Other],
      cashbackRate: 0.03,
      foreignTransactionFee: 0.03,
    });

    expect(assignCardRole(card, makeUser())).toBe(CardRole.Benefits);
  });

  test('assignCardRole honors a single role tag when present', () => {
    const card = makeCard({
      primaryRole: null,
      roleTags: [CardRole.Education],
      rewardCategories: [PurchaseCategory.Education],
    });

    expect(assignCardRole(card, makeUser())).toBe(CardRole.Education);
  });
});
