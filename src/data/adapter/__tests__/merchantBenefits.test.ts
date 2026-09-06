/**
 * THE MERCHANT→BENEFIT EDGE, MEASURED — including the fact that it is almost always absent.
 *
 * These cases exist to keep an honest "no" honest. If a later pack publication actually links
 * Shufersal to a card benefit, the case naming that absence fails and somebody reads the diff —
 * which is the correct outcome, and the reason the absence is asserted rather than assumed.
 */
import {
  merchantBenefitsFor,
  merchantsWithEvidencedBenefits,
} from '../merchantBenefits';

const QUICK = [
  'merch:shufersal',
  'merch:carrefour',
  'merch:rami-levy-stores',
  'merch:super-pharm',
  'merch:sonol',
];

describe('merchant benefits', () => {
  it('reads the shipped benefits pack and finds the merchant edge on very few rows', () => {
    const linked = merchantsWithEvidencedBenefits();
    expect(Array.isArray(linked)).toBe(true);
    /* The adapter's own note: the estate declares the pair on a tiny minority of rows. */
    expect(linked.length).toBeLessThan(20);
  });

  it('reports NO_EVIDENCED_BENEFIT for a merchant the corpus links to nothing', () => {
    const reading = merchantBenefitsFor('merch:shufersal', ['card:max:anything']);
    expect(reading.usable).toEqual([]);
    expect(reading.evidencedForMerchant).toEqual([]);
    expect(reading.absence).toBe('NO_EVIDENCED_BENEFIT');
  });

  it('reports NOT_LINKED_TO_A_CARD when a benefit names the merchant and no card', () => {
    /* Super-Pharm is the one quick merchant the corpus links at all, and the single benefit that
       names it carries an empty cardIds — so it cannot be attached to any wallet. */
    const reading = merchantBenefitsFor('merch:super-pharm', ['card:max:anything']);
    expect(reading.evidencedForMerchant.length).toBeGreaterThan(0);
    expect(reading.usable).toEqual([]);
    expect(reading.absence).toBe('NOT_LINKED_TO_A_CARD');
  });

  it('never claims a merchant-specific benefit for a quick merchant the corpus cannot support', () => {
    for (const merchantId of QUICK) {
      const reading = merchantBenefitsFor(merchantId, ['card:max:a', 'card:cal:b']);
      expect(reading.usable).toEqual([]);
      expect(reading.absence).toBeDefined();
    }
  });

  it('distinguishes a wallet miss from a corpus absence', () => {
    const linked = merchantsWithEvidencedBenefits();
    const withCards = linked
      .map((id) => ({ id, reading: merchantBenefitsFor(id, []) }))
      .filter((row) => row.reading.absence !== 'NO_EVIDENCED_BENEFIT');
    /* Whatever the corpus holds, an empty wallet can never produce a usable benefit — and the
       reason must never be reported as "the corpus has nothing". */
    for (const row of withCards) {
      expect(row.reading.usable).toEqual([]);
      expect(row.reading.absence).not.toBe('NO_EVIDENCED_BENEFIT');
    }
  });

  it('reads an unknown merchant id as an absence, not as an error', () => {
    const reading = merchantBenefitsFor('merch:not-a-real-merchant', ['card:x']);
    expect(reading.absence).toBe('NO_EVIDENCED_BENEFIT');
  });
});
