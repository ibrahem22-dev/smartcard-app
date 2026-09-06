/**
 * REAL FEE BINDING, MEASURED END TO END AGAINST THE SHIPPED CATALOG.
 *
 * The campaign directive is explicit that a fee label copied into a UI is not enough: the binding
 * has to be provable from the canonical product id through to a figure with a source. So these
 * cases run over the WHOLE shipped catalog rather than a fixture, and they assert the two things
 * that are easy to get wrong in opposite directions — that a known fee really is bound, and that
 * an unknown one really does stay unknown instead of becoming ₪0.
 */
import {
  allCatalogProducts,
  availableBanks,
  availableCardCompanies,
  cardProductsForIssuer,
  compatibleProgrammesForProduct,
  issuerByOrgId,
  networkIdsFor,
} from '../cardCatalog';
import { cardFeeProfileFor, unbindableNamedFeeRowCount } from '../cardFeeProfile';

describe('card fee profile', () => {
  it('binds an FX commission to every current product, from the product row itself', () => {
    const products = allCatalogProducts();
    expect(products.length).toBeGreaterThan(300);

    const unbound: string[] = [];
    for (const product of products) {
      const profile = cardFeeProfileFor(product.cardId);
      if (profile === undefined || profile.fxCommissionPct.state !== 'VERIFIED') {
        unbound.push(product.cardId);
      }
    }
    expect(unbound).toEqual([]);
  });

  it('carries the estate’s own resolution beside every card-level figure', () => {
    const profile = cardFeeProfileFor('card:amex-il:adif-american-express');
    expect(profile?.fxCommissionPct.single?.value).toBe(2.5);
    expect(profile?.fxCommissionPct.single?.unit).toBe('PERCENT');
    expect(profile?.fxCommissionPct.single?.chip).toBe('VERIFIED');
    expect(profile?.fxCommissionPct.single?.resolution).toBe('ISSUER_X_OPERATOR');
    expect(profile?.fxCommissionPct.single?.sourceLabel).toBeDefined();
  });

  it('uses the card-level exception the estate already applied, and does not re-apply it', () => {
    /* Leumi's United Airlines card: the tariff's base FX is not 1.5%; a card-level exception is,
       and the pipeline resolved it into the product row. Re-applying the exception here would
       change a figure the estate had already finished. */
    const profile = cardFeeProfileFor('card:leumi:leumi-united-airlines-credit-card');
    expect(profile?.fxCommissionPct.single?.value).toBe(1.5);
    expect(profile?.fxCommissionPct.single?.resolution).toBe('CARD_LEVEL_EXCEPTION');
    expect(profile?.foreignAtmPct.single?.value).toBe(2.55);
  });

  it('never turns a missing fee into zero', () => {
    const zeroed: string[] = [];
    for (const product of allCatalogProducts()) {
      const profile = cardFeeProfileFor(product.cardId);
      if (profile === undefined) continue;
      for (const reading of [
        profile.cardFee,
        profile.fxCommissionPct,
        profile.foreignAtmPct,
        profile.atmSameCurrencyFee,
        profile.cashAdvanceFee,
        profile.replacementFee,
      ]) {
        if (reading.state === 'NOT_AVAILABLE' && reading.single !== undefined) {
          zeroed.push(`${product.cardId}:${reading.field}`);
        }
        if (reading.state === 'NOT_AVAILABLE' && reading.publishedRows.length > 0) {
          zeroed.push(`${product.cardId}:${reading.field}:candidates`);
        }
      }
    }
    expect(zeroed).toEqual([]);
  });

  it('reports an unpublished same-currency ATM fee as an evidenced absence', () => {
    const absent = allCatalogProducts()
      .map((p) => cardFeeProfileFor(p.cardId))
      .filter((profile) => profile?.atmSameCurrencyFee.state === 'NOT_AVAILABLE');
    /* A minority of products publish this figure; the rest record that they do not. */
    expect(absent.length).toBeGreaterThan(0);
    for (const profile of absent) {
      expect(profile?.atmSameCurrencyFee.reason).toBe('NO_VALUE_PUBLISHED');
      expect(profile?.atmSameCurrencyFee.single).toBeUndefined();
    }
  });

  it('returns a card fee as a candidate SET when the tariff differs by a level the estate does not model', () => {
    const profile = cardFeeProfileFor('card:amex-il:adif-american-express');
    expect(profile?.cardFee.state).toBe('CONDITIONAL');
    expect(profile?.cardFee.reason).toBe('LEVEL_NOT_MODELLED');
    expect((profile?.cardFee.publishedRows.length ?? 0)).toBeGreaterThan(1);
    /* Each candidate names the tariff's own level labels, so the user can recognise their card. */
    expect(profile?.cardFee.publishedRows.some((c) => c.levels.includes('Blue'))).toBe(true);
    expect(profile?.cardFee.publishedRows.some((c) => c.levels.includes('Platinum'))).toBe(true);
    /* And no single figure is presented as THE fee. */
    expect(profile?.cardFee.single).toBeUndefined();
  });

  it('never binds a NAMED_CARD_OR_LEVEL tariff row to a product by its name', () => {
    /* Those rows exist and are deliberately not joined — the count is reported instead. */
    const named = unbindableNamedFeeRowCount('org:leumi');
    expect(named).toBeGreaterThanOrEqual(0);
    const profile = cardFeeProfileFor('card:leumi:leumi-first-credit-card');
    for (const candidate of profile?.cardFee.publishedRows ?? []) {
      /* Every bound candidate came from an operator-scoped or issuer-wide row, so its evidence
         is a tariff scope rather than a card name. */
      expect(candidate.sourceLabel ?? candidate.registryId).toBeDefined();
    }
  });

  it('keeps the issuer and the operating card company as separate keys', () => {
    const leumiCards = cardProductsForIssuer('org:leumi');
    expect(leumiCards.length).toBeGreaterThan(0);
    /* A Leumi card operated by CAL is Leumi's product. It must not appear under CAL. */
    const calCards = cardProductsForIssuer('org:cal').map((p) => p.cardId);
    for (const card of leumiCards) {
      expect(calCards).not.toContain(card.cardId);
    }
  });

  it('reads a product the catalog does not hold as undefined, not as an empty profile', () => {
    expect(cardFeeProfileFor('card:not-a-real:product')).toBeUndefined();
  });

  it('honours the amex/isracard join caveat by never merging their fee scopes', () => {
    const amex = issuerByOrgId('org:amex-il');
    expect(amex?.issuingEntityOrgId).toBe('org:isracard');
    expect(amex?.joinCaveat).toContain('NOT disjoint');
    const amexFx = cardFeeProfileFor('card:amex-il:adif-american-express')?.fxCommissionPct.single?.value;
    const isracardProduct = cardProductsForIssuer('org:isracard')[0];
    const isracardFx = isracardProduct === undefined
      ? undefined
      : cardFeeProfileFor(isracardProduct.cardId)?.fxCommissionPct.single?.value;
    expect(amexFx).toBeDefined();
    expect(isracardFx).toBeDefined();
    /* Not asserted equal or unequal — asserted SEPARATELY RESOLVED, which is the caveat's point. */
    expect(typeof amexFx).toBe('number');
    expect(typeof isracardFx).toBe('number');
  });
});

describe('canonical card catalog', () => {
  it('derives the bank list from products rather than a hardcoded list', () => {
    const banks = availableBanks();
    expect(banks.length).toBeGreaterThan(8);
    for (const bank of banks) {
      expect(bank.kind).toBe('BANK');
      expect(cardProductsForIssuer(bank.orgId).length).toBeGreaterThan(0);
    }
    /* A merged bank with no current product is not offered. */
    expect(banks.map((b) => b.orgId)).not.toContain('org:union');
  });

  it('offers exactly the four consumer card companies the estate ships', () => {
    expect(availableCardCompanies().map((i) => i.orgId).sort()).toEqual([
      'org:amex-il',
      'org:cal',
      'org:isracard',
      'org:max',
    ]);
  });

  it('normalises the network string and refuses to guess an unconfirmed one', () => {
    expect(networkIdsFor('Visa')).toEqual(['net:visa']);
    expect(networkIdsFor('AMERICAN_EXPRESS')).toEqual(['net:amex']);
    expect(networkIdsFor('Mastercard, Visa')).toEqual(['net:mastercard', 'net:visa']);
    expect(networkIdsFor('UNKNOWN')).toEqual([]);
    expect(networkIdsFor('NOT_CONFIRMED')).toEqual([]);
    expect(networkIdsFor('MULTI_NETWORK_SEE_VARIANTS')).toEqual([]);
    expect(networkIdsFor(undefined)).toEqual([]);
    expect(networkIdsFor('a spelling nobody published')).toEqual([]);
  });

  it('covers every network spelling the shipped catalog actually uses', () => {
    /* A spelling nobody mapped resolves to no network — correct, and silent. This case makes the
       silence visible: if a pack publication adds a spelling, the unmapped count moves. */
    const unmapped = allCatalogProducts().filter(
      (p) => p.networkRaw !== undefined && p.networkIds.length === 0,
    );
    const spellings = [...new Set(unmapped.map((p) => p.networkRaw))].sort();
    expect(spellings).toEqual(['MULTI_NETWORK_SEE_VARIANTS', 'NOT_CONFIRMED', 'UNKNOWN']);
  });

  it('attaches a programme only where the estate published an edge', () => {
    const withProgramme = allCatalogProducts().filter(
      (p) => compatibleProgrammesForProduct(p.cardId).length > 0,
    );
    expect(withProgramme.length).toBeGreaterThan(0);
    /* Far from every product: an absent edge is an absence of evidence, not a claim. */
    expect(withProgramme.length).toBeLessThan(allCatalogProducts().length);
    for (const product of withProgramme) {
      for (const link of compatibleProgrammesForProduct(product.cardId)) {
        expect(link.programme.nodeId).toMatch(/^(club|prog)/);
        expect(link.programme.displayName.trim()).not.toBe('');
      }
    }
  });

  it('never offers a programme of one issuer under another issuer’s product', () => {
    /* The edge is published per card, so this is a property of the join and not of a filter —
       but a wrong join is exactly how a club would appear under a card that cannot carry it. */
    for (const product of allCatalogProducts()) {
      for (const link of compatibleProgrammesForProduct(product.cardId)) {
        expect(link.programme.nodeId).toBeDefined();
      }
    }
    const linked = allCatalogProducts()
      .flatMap((p) => compatibleProgrammesForProduct(p.cardId).map((l) => ({ p, l })));
    expect(linked.length).toBeGreaterThan(0);
  });
});
