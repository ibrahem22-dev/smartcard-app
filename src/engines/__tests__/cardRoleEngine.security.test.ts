import { recommendCard } from '../cardRoleEngine';
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
    id: 'security-user',
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

describe('cardRoleEngine rate security', () => {
  test.each([
    { cashbackRate: 1.5 },
    { cashbackRate: -0.1 },
    { cashbackRate: Number.NaN },
    { foreignTransactionFee: 1.5 },
    { foreignTransactionFee: -0.1 },
    { foreignTransactionFee: Number.POSITIVE_INFINITY },
  ])('excludes card with invalid rate input %#', (override: Partial<CardInput>) => {
    const invalid = makeCard({ cardId: 'invalid', ...override });
    const fallback = makeCard({ cardId: 'fallback' });

    const result = recommendCard(
      [invalid, fallback],
      PurchaseCategory.Groceries,
      makeUser(),
      false,
    );

    expect(result?.card.cardId).toBe('fallback');
  });

  test('returns null when every active card has invalid rate input', () => {
    const result = recommendCard(
      [
        makeCard({ cardId: 'bad-cashback', cashbackRate: 1.5 }),
        makeCard({ cardId: 'bad-fx', foreignTransactionFee: -0.1 }),
      ],
      PurchaseCategory.Groceries,
      makeUser(),
      false,
    );

    expect(result).toBeNull();
  });

  test.each([
    { cashbackRate: 0 },
    { cashbackRate: 1 },
    { foreignTransactionFee: 0 },
    { foreignTransactionFee: 1 },
  ])('keeps card with valid rate boundary %#', (override: Partial<CardInput>) => {
    const card = makeCard({ cardId: 'valid-boundary', ...override });

    const result = recommendCard(
      [card],
      PurchaseCategory.Groceries,
      makeUser(),
      false,
    );

    expect(result?.card.cardId).toBe('valid-boundary');
  });
});
