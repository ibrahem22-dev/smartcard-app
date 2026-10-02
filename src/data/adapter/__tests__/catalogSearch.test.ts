/**
 * W2 — catalog reach. Population is derived from the shipped catalog through CardsAdapter,
 * never listed by hand. Search must hit every CURRENT product; the generic path is for anything
 * the catalog does not contain.
 */
jest.mock('expo-crypto', () => ({
  randomUUID: (): string => '11111111-1111-4111-8111-111111111111',
}));

import { CardsAdapter } from '@smartcard/data-authority-adapter';

import { EXPECTED_DATASET_ID } from '../datasetId';
import { createManualCard } from '../../../utils/manualCard';
import { CardIssuer } from '../../../types/card.types';
import {
  catalogCardRows,
  catalogPackIdentity,
  currentCatalogInstitutions,
  currentCatalogProducts,
  GENERIC_CATALOG_PATH,
  isCurrentCatalogProduct,
  searchCatalog,
} from '../catalogSearch';

describe('W2 catalog reach — derived CURRENT population', () => {
  it('the current-product population is derived from the shipped catalog and agrees with countCurrentProducts', () => {
    const identity = catalogPackIdentity();
    const adapter = CardsAdapter.open(
      {
        datasetId: identity.datasetId,
        datasetVersion: identity.datasetVersion,
        cards: catalogCardRows() as never,
      },
      { expectedDatasetId: EXPECTED_DATASET_ID },
    );
    const derived = currentCatalogProducts();
    expect(derived.length).toBe(adapter.countCurrentProducts());
    expect(derived.length).toBeGreaterThan(0);
    const ids = new Set(derived.map(p => p.cardId));
    expect(ids.size).toBe(derived.length);
    for (const product of derived) {
      expect(adapter.read(product.cardId)?.countsAsCurrentProduct).toBe(true);
    }
    // eslint-disable-next-line no-console
    console.log(
      `derived ${derived.length} CURRENT products; adapter countCurrentProducts=${adapter.countCurrentProducts()}`,
    );
  });

  it('search reaches every derived current product', () => {
    const products = currentCatalogProducts();
    const missed: string[] = [];
    for (const product of products) {
      const hits = searchCatalog(product.cardId);
      if (!hits.some(hit => hit.cardId === product.cardId)) {
        missed.push(product.cardId);
      }
    }
    expect(missed).toEqual([]);
    expect(searchCatalog('').length).toBe(0);
    // eslint-disable-next-line no-console
    console.log(`reached ${products.length} / ${products.length}`);
  });

  it('institutions are derived from the same population, not listed by hand', () => {
    const products = currentCatalogProducts();
    const fromProducts = new Set(products.map(p => p.issuerOrgId));
    const institutions = currentCatalogInstitutions();
    expect(new Set(institutions.map(i => i.orgId))).toEqual(fromProducts);
    expect(institutions.length).toBe(fromProducts.size);
    expect(institutions.length).toBeGreaterThan(1);
    const scoped = institutions[0];
    const other = institutions[1];
    if (scoped === undefined || other === undefined) {
      throw new Error('need at least two derived institutions to prove issuer scoping');
    }
    const sample = products.find(p => p.issuerOrgId === scoped.orgId);
    if (sample === undefined) {
      throw new Error('institution ' + scoped.orgId + ' has no CURRENT product');
    }
    const inScope = searchCatalog(sample.cardId, { issuerOrgId: scoped.orgId });
    expect(inScope.some(hit => hit.cardId === sample.cardId)).toBe(true);
    const outOfScope = searchCatalog(sample.cardId, { issuerOrgId: other.orgId });
    expect(outOfScope.some(hit => hit.cardId === sample.cardId)).toBe(false);
    // eslint-disable-next-line no-console
    console.log(`derived ${institutions.length} institutions from CURRENT products`);
  });

  it('the generic path creates a card that is not in the catalog', () => {
    expect(GENERIC_CATALOG_PATH).toBe('generic:manual');
    const card = createManualCard({
      displayName: 'Generic path card',
      last4: '4242',
      issuer: CardIssuer.Max,
      creditLimit: 8000,
      currentBalance: 0,
    });
    expect(isCurrentCatalogProduct(card.cardProductId ?? '')).toBe(false);
    expect(String(card.cardProductId).startsWith('manual:')).toBe(true);
  });
});
