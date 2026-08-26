jest.mock('expo-crypto', () => ({
  randomUUID: (): string => '11111111-1111-4111-8111-111111111111',
}));

import { createManualCard } from '../manualCard';
import { CardIssuer, CardNetwork, splitEngineCard } from '../../types/card.types';
import { Currency } from '../../types/purchase.types';

const BASE = {
  displayName: 'My Max',
  last4: '1234',
  issuer: CardIssuer.Max,
  creditLimit: 10000,
  currentBalance: 2500,
} as const;

describe('createManualCard (LOCK-007: unknown stays unknown)', () => {
  test('uses the user-entered credit framework verbatim', () => {
    const card = createManualCard(BASE);
    expect(card.framework.creditLimit).toBe(10000);
    expect(card.framework.currentBalance).toBe(2500);
    expect(card.displayName).toBe('My Max');
    expect(card.last4).toBe('1234');
    expect(card.issuer).toBe(CardIssuer.Max);
    expect(card.isActive).toBe(true);
    expect(card.currency).toBe(Currency.ILS);
    expect(card.cardId).toMatch(/[0-9a-f-]{36}/i);
  });

  test('unknown FX fee stays unknown (NaN) so the gate skips, never 0%', () => {
    const card = createManualCard(BASE);
    expect(Number.isFinite(card.foreignTransactionFee)).toBe(false);
  });

  test('unknown billing day is invalid (0) so charge-return excludes the card', () => {
    const card = createManualCard(BASE);
    expect(card.billingCycle.billingDayOfMonth).toBe(0);
  });

  test('known FX fee and billing day are preserved', () => {
    const card = createManualCard({
      ...BASE,
      foreignTransactionFee: 0.03,
      billingDayOfMonth: 10,
    });
    expect(card.foreignTransactionFee).toBeCloseTo(0.03);
    expect(card.billingCycle.billingDayOfMonth).toBe(10);
  });

  test('does not fabricate rewards/roles', () => {
    const card = createManualCard(BASE);
    expect(card.roleTags).toEqual([]);
    expect(card.primaryRole).toBeNull();
    expect(card.rewardCategories).toEqual([]);
    expect(card.network).toBe(CardNetwork.Mastercard);
  });

  test('the stored split puts last4 on UserCard and issuer on CardProduct, never artwork', () => {
    const card = createManualCard(BASE);
    expect(card.cardProductId).toBe('manual:' + card.cardId);
    const { user, product } = splitEngineCard(card);
    expect(user.last4).toBe('1234');
    expect(user).not.toHaveProperty('issuer');
    expect(user).not.toHaveProperty('artworkUrl');
    expect(product.issuer).toBe(CardIssuer.Max);
    expect(product).not.toHaveProperty('last4');
    expect(product).not.toHaveProperty('artworkUrl');
  });
});
