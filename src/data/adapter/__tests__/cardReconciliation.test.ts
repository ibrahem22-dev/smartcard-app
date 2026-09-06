/**
 * LEGACY CARD RECONCILIATION — classify, offer, never adopt.
 *
 * The directive's instruction is that existing cards are not destroyed and that an ambiguous match
 * is never chosen silently. These cases hold both halves, and the second is the one that would be
 * easy to lose: a unique name match still classifies as AMBIGUOUS, on purpose.
 */
import { CardIssuer } from '../../../types/card.types';
import {
  adoptCanonicalProduct,
  reconcileAll,
  reconcileCard,
} from '../cardReconciliation';
import { catalogProductById } from '../cardCatalog';

describe('card reconciliation', () => {
  it('reads a stored catalog id as already canonical', () => {
    const reading = reconcileCard({
      cardId: 'v1',
      cardProductId: 'card:max:skymax',
      displayName: 'whatever the user called it',
      issuer: CardIssuer.Max,
    });
    expect(reading.state).toBe('CANONICALLY_RESOLVED');
    expect(reading.reason).toBe('PRODUCT_ID_IS_A_CURRENT_CATALOG_ROW');
    expect(reading.product?.cardId).toBe('card:max:skymax');
    expect(reading.candidates).toEqual([]);
  });

  it('offers a name match as AMBIGUOUS and never adopts it', () => {
    const product = catalogProductById('card:max:skymax');
    if (product === undefined) throw new Error('card:max:skymax must exist');
    const reading = reconcileCard({
      cardId: 'v1',
      cardProductId: 'manual:abc',
      displayName: product.nameHe ?? product.nameEn ?? 'SKYMAX',
      issuer: CardIssuer.Max,
    });
    expect(reading.state).toBe('AMBIGUOUS');
    expect(reading.reason).toBe('NAME_MATCHES_CATALOG_PRODUCTS');
    expect(reading.candidates.map((c) => c.cardId)).toContain('card:max:skymax');
    /* Even a UNIQUE match is offered rather than taken. */
    expect(reading.product).toBeUndefined();
  });

  it('reports UNRESOLVED for a name the catalog does not publish', () => {
    const reading = reconcileCard({
      cardId: 'v1',
      cardProductId: 'manual:abc',
      displayName: 'הכרטיס הכחול של סבתא',
      issuer: CardIssuer.Cal,
    });
    expect(reading.state).toBe('UNRESOLVED');
    expect(reading.reason).toBe('NO_CATALOG_PRODUCT_MATCHES');
    expect(reading.candidates).toEqual([]);
  });

  it('reports UNRESOLVED, not a crash, for an empty display name', () => {
    const reading = reconcileCard({
      cardId: 'v1', displayName: '   ', issuer: CardIssuer.Isracard,
    });
    expect(reading.state).toBe('UNRESOLVED');
  });

  it('narrows candidates by the legacy issuer, keeping amex under isracard', () => {
    /* The estate's own caveat: Amex-IL cards are issued inside the Isracard group, so a card the
       user stored as Isracard must still be able to match an Amex product. */
    const amex = catalogProductById('card:amex-il:adif-american-express');
    if (amex === undefined) throw new Error('amex product must exist');
    const asIsracard = reconcileCard({
      cardId: 'v1',
      cardProductId: 'manual:abc',
      displayName: amex.nameHe ?? 'מועדון עדיף',
      issuer: CardIssuer.Isracard,
    });
    expect(asIsracard.candidates.map((c) => c.cardId)).toContain(amex.cardId);

    const asMax = reconcileCard({
      cardId: 'v1',
      cardProductId: 'manual:abc',
      displayName: amex.nameHe ?? 'מועדון עדיף',
      issuer: CardIssuer.Max,
    });
    expect(asMax.candidates.map((c) => c.cardId)).not.toContain(amex.cardId);
  });

  it('matches a name whose punctuation differs from the catalog spelling', () => {
    const product = catalogProductById('card:max:skymax');
    if (product === undefined) throw new Error('missing product');
    const name = product.nameEn ?? product.nameHe ?? '';
    const reading = reconcileCard({
      cardId: 'v1', cardProductId: 'manual:abc', displayName: '  ' + name.toLowerCase() + ' ',
      issuer: CardIssuer.Max,
    });
    expect(reading.candidates.map((c) => c.cardId)).toContain('card:max:skymax');
  });

  it('classifies a whole vault and keeps every card', () => {
    const rows = reconcileAll([
      { cardId: 'a', cardProductId: 'card:max:skymax', displayName: 'x', issuer: CardIssuer.Max },
      { cardId: 'b', cardProductId: 'manual:1', displayName: 'nothing like a real card', issuer: CardIssuer.Cal },
    ]);
    expect(rows.map((r) => r.cardId)).toEqual(['a', 'b']);
    expect(rows[0]?.state).toBe('CANONICALLY_RESOLVED');
    expect(rows[1]?.state).toBe('UNRESOLVED');
  });

  it('hands back the canonical fields a confirmed product contributes', () => {
    const adopted = adoptCanonicalProduct('card:leumi:leumi-united-airlines-credit-card');
    expect(adopted?.issuerOrgId).toBe('org:leumi');
    expect(adopted?.issuerKind).toBe('BANK');
    expect(adopted?.networkIds).toContain('net:visa');
    expect(adoptCanonicalProduct('card:not-real')).toBeUndefined();
  });
});
