/**
 * W5 — wizard writes UserCard + CardProduct through the adapter, never a raw dataset row.
 */
jest.mock('expo-crypto', () => ({
  randomUUID: (): string => '11111111-1111-4111-8111-111111111111',
}));

import { CardIssuer } from '../../../types/card.types';
import { currentCatalogProducts } from '../catalogSearch';
import { isRawDatasetValue, writeWizardCard } from '../wizardVault';

const BASE = {
  displayName: 'My Max',
  last4: '1234',
  issuer: CardIssuer.Max,
  creditLimit: 10_000,
  currentBalance: 2_500,
} as const;

describe('W5 wizard vault write — adapter, not a raw dataset', () => {
  it('a catalog pick persists a UserCard whose product id is the catalog id', () => {
    const catalog = currentCatalogProducts()[0];
    if (catalog === undefined) throw new Error('no CURRENT catalog product');
    const written = writeWizardCard({ ...BASE, catalogCardId: catalog.cardId });
    expect(written.user.cardProductId).toBe(catalog.cardId);
    expect(written.product.cardProductId).toBe(catalog.cardId);
    expect(written.user.last4).toBe('1234');
    expect(written.user).not.toHaveProperty('issuer');
    expect(written.product).not.toHaveProperty('last4');
    expect(isRawDatasetValue(written.user)).toBe(false);
    expect(isRawDatasetValue(written.product)).toBe(false);
    expect(isRawDatasetValue(written)).toBe(false);
  });

  it('the generic path mints a local product id that is not a catalog row', () => {
    const written = writeWizardCard(BASE);
    expect(written.user.cardProductId.startsWith('manual:')).toBe(true);
    expect(currentCatalogProducts().some(p => p.cardId === written.user.cardProductId)).toBe(
      false,
    );
    expect(isRawDatasetValue(written.product)).toBe(false);
  });

  it('refuses a catalog id that is not a CURRENT product rather than writing a dataset row', () => {
    expect(() => writeWizardCard({ ...BASE, catalogCardId: 'card:not-in-catalog' })).toThrow(
      /CURRENT product/,
    );
  });
});
