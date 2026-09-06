/**
 * MERCHANT RADAR'S DATA, MEASURED AGAINST THE SHIPPED PACK — not against a fixture.
 *
 * Every assertion below reads the real `taxonomy` pack the app bundles. The five merchants the
 * Owner named for the checkout chips are asserted BY ID, because a chip that resolves to nothing
 * is the failure this whole module is arranged to prevent, and because an id typed into a screen
 * would be a second home for a fact the pack already owns.
 */
import {
  allMerchants,
  merchantById,
  merchantHaystack,
  merchantName,
  merchantNameIsFallback,
  merchantPackIdentity,
  normalizeMerchantText,
  quickMerchants,
  resolveMerchantAlias,
  searchMerchants,
  QUICK_MERCHANT_IDS,
} from '../merchantDirectory';

describe('merchant directory', () => {
  it('reads the shipped taxonomy pack rather than a fixture', () => {
    const identity = merchantPackIdentity();
    expect(identity.datasetId).toBe('smartcard-canonical-v2');
    expect(allMerchants().length).toBeGreaterThan(200);
  });

  it('resolves every quick merchant the Owner named to a real canonical row', () => {
    const resolved = quickMerchants();
    expect(resolved.map((m) => m.merchantId)).toEqual(QUICK_MERCHANT_IDS);
    for (const merchant of resolved) {
      expect(merchant.canonicalName.trim()).not.toBe('');
      expect(merchant.entityKind).toBe('MERCHANT');
    }
  });

  it('keeps the Owner-named chips in the Owner-named order', () => {
    expect(quickMerchants().map((m) => m.merchantId)).toEqual([
      'merch:shufersal',
      'merch:carrefour',
      'merch:rami-levy-stores',
      'merch:super-pharm',
      'merch:sonol',
    ]);
  });

  it('carries the categories the estate published for the quick merchants', () => {
    const category = (id: string): string | undefined =>
      merchantById(id)?.canonicalCategory;
    expect(category('merch:shufersal')).toBe('GROCERY');
    expect(category('merch:carrefour')).toBe('GROCERY');
    expect(category('merch:rami-levy-stores')).toBe('GROCERY');
    expect(category('merch:super-pharm')).toBe('PHARMACY_HEALTH_BEAUTY');
    expect(category('merch:sonol')).toBe('FUEL');
  });

  it('resolves a Hebrew alias to its canonical merchant', () => {
    expect(resolveMerchantAlias('קרפור')?.merchantId).toBe('merch:carrefour');
    expect(resolveMerchantAlias('רמי לוי')?.merchantId).toBe('merch:rami-levy-stores');
    expect(resolveMerchantAlias('סופר פארם')?.merchantId).toBe('merch:super-pharm');
  });

  it('resolves an Arabic name to its canonical merchant', () => {
    expect(resolveMerchantAlias('شوفرسال')?.merchantId).toBe('merch:shufersal');
    expect(resolveMerchantAlias('سونول')?.merchantId).toBe('merch:sonol');
  });

  it('resolves an English name and a bare domain alias', () => {
    expect(resolveMerchantAlias('Shufersal')?.merchantId).toBe('merch:shufersal');
    expect(resolveMerchantAlias('shufersal.co.il')?.merchantId).toBe('merch:shufersal');
  });

  it('normalises punctuation so a hyphenated brand matches its spaced spelling', () => {
    expect(normalizeMerchantText('Super-Pharm')).toBe(normalizeMerchantText('Super Pharm'));
    expect(resolveMerchantAlias('Super Pharm')?.merchantId).toBe('merch:super-pharm');
  });

  it('returns nothing for an unknown merchant rather than the nearest one', () => {
    expect(resolveMerchantAlias('a shop nobody recorded')).toBeUndefined();
    expect(resolveMerchantAlias('')).toBeUndefined();
  });

  it('searches partial text and puts an exact match first', () => {
    const hits = searchMerchants('שופרסל');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.merchantId).toBe('merch:shufersal');
  });

  it('bounds a search so a one-letter query cannot return the whole pack', () => {
    expect(searchMerchants('a').length).toBeLessThanOrEqual(8);
    expect(searchMerchants('a', { limit: 3 }).length).toBeLessThanOrEqual(3);
    expect(searchMerchants('')).toEqual([]);
  });

  it('shows a published name per language and reports when it is falling back', () => {
    const shufersal = merchantById('merch:shufersal');
    if (shufersal === undefined) throw new Error('merch:shufersal must exist in the shipped pack');
    expect(merchantName(shufersal, 'he')).toBe(shufersal.nameHe);
    expect(merchantName(shufersal, 'ar')).toBe(shufersal.nameAr);
    expect(merchantName(shufersal, 'en')).toBe(shufersal.nameEn);
    expect(merchantNameIsFallback(shufersal, 'ar')).toBe(false);

    const ramiLevy = merchantById('merch:rami-levy-stores');
    if (ramiLevy === undefined) throw new Error('merch:rami-levy-stores must exist');
    /* The estate searched for an Arabic name and recorded an evidenced absence. The directory
       falls back to a name somebody published and SAYS it is falling back. */
    expect(ramiLevy.nameAr).toBeUndefined();
    expect(merchantNameIsFallback(ramiLevy, 'ar')).toBe(true);
    expect(merchantName(ramiLevy, 'ar').trim()).not.toBe('');
  });

  it('never returns an empty display name in any language', () => {
    for (const merchant of allMerchants()) {
      for (const language of ['he', 'ar', 'en'] as const) {
        expect(merchantName(merchant, language).trim()).not.toBe('');
      }
      expect(merchantHaystack(merchant).length).toBeGreaterThan(0);
    }
  });

  it('reads a merchant that is not in the pack as absent, not as an error', () => {
    expect(merchantById('merch:not-a-real-merchant')).toBeUndefined();
  });
});
