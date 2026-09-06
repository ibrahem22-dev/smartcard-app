/**
 * MERCHANT RADAR'S COMPOSITION, over the real corpus.
 *
 * The corpus links a benefit to a merchant on six rows out of seven hundred, so almost every case
 * here is about the honest NO — and specifically about the three different NOs staying apart.
 */
import { merchantAdvice } from '../merchantRadar';
import { vaultCard } from './cardFixture';

const QUICK = [
  'merch:shufersal',
  'merch:carrefour',
  'merch:rami-levy-stores',
  'merch:super-pharm',
  'merch:sonol',
];

describe('merchant radar', () => {
  it('returns null for an id the taxonomy does not hold', () => {
    expect(merchantAdvice('merch:not-a-real-merchant', [])).toBeNull();
  });

  it('answers every Owner-named quick merchant, and never with a fabricated benefit', () => {
    const cards = [vaultCard({ cardId: 'v1', cardProductId: 'card:max:skymax' })];
    for (const merchantId of QUICK) {
      const advice = merchantAdvice(merchantId, cards);
      expect(advice).not.toBeNull();
      expect(advice?.kind).toBe('NO_VERIFIED_MERCHANT_BENEFIT');
      expect(advice?.usableBenefits).toEqual([]);
      expect(advice?.absence).toBeDefined();
      expect(advice?.merchant.merchantId).toBe(merchantId);
    }
  });

  it('keeps "the corpus records nothing" apart from "the record names no card"', () => {
    const cards = [vaultCard({ cardId: 'v1', cardProductId: 'card:max:skymax' })];
    expect(merchantAdvice('merch:shufersal', cards)?.absence).toBe('NO_EVIDENCED_BENEFIT');
    /* Super-Pharm is the one quick merchant any benefit names, and that benefit names no card. */
    expect(merchantAdvice('merch:super-pharm', cards)?.absence).toBe('NOT_LINKED_TO_A_CARD');
  });

  it('returns the merchant’s published names so a surface never has to invent one', () => {
    const advice = merchantAdvice('merch:carrefour', []);
    expect(advice?.merchant.nameHe).toBe('קרפור');
    expect(advice?.merchant.nameEn).toBe('Carrefour');
    expect(advice?.merchant.nameAr).toBe('كارفور');
  });

  it('carries the wallet-level ranking, which is empty when nothing priced the wallet', () => {
    const cards = [
      vaultCard({ cardId: 'v1', cardProductId: 'card:max:skymax' }),
      vaultCard({ cardId: 'v2' }),
    ];
    const advice = merchantAdvice('merch:sonol', cards);
    expect(advice?.generalRanking).not.toBeNull();
    /* Nothing supplies a wallet-level cost here, so the engine ranks none and reports both as
       unpriced rather than inventing an order. */
    expect(advice?.generalRanking?.ranked).toEqual([]);
    expect(advice?.generalRanking?.unknownCostCards.length).toBe(2);
  });

  it('returns a null ranking for an empty wallet rather than an empty one', () => {
    expect(merchantAdvice('merch:sonol', [])?.generalRanking).toBeNull();
  });

  it('joins on the canonical product id, not on the vault id', () => {
    /* A vault card with no product id can match nothing, which is the honest outcome and never a
       wildcard that would attach every benefit to an unidentified card. */
    const unidentified = [vaultCard({ cardId: 'v1' })];
    for (const merchantId of QUICK) {
      expect(merchantAdvice(merchantId, unidentified)?.usableBenefits).toEqual([]);
    }
  });
});
