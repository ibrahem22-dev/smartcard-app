/**
 * CARD DNA'S BOTTOM LINE — and the four ways it correctly refuses to state a net value.
 *
 * The directive asks for benefit value minus card fee and forbids fabricating either operand.
 * These cases are mostly about the refusals, because on the shipped corpus the refusals are the
 * usual answer: only 14 of 378 current products resolve to a single monthly card fee, and nothing
 * in the app has ever measured a realised benefit.
 */
import { cardFeeProfileFor } from '../../../authority/cardCatalogAuthority';
import { allCatalogProducts } from '../../../authority/cardCatalogAuthority';
import { bottomLineFor } from '../bottomLine';

const TODAY = '2026-09-06';

/** A product whose tariff publishes several monthly figures by card level. */
const MULTI_LEVEL = 'card:amex-il:adif-american-express';

describe('card DNA bottom line', () => {
  it('refuses a tariff for a card that is not a catalog product', () => {
    for (const id of [undefined, '', 'manual:abc', 'legacy:xyz']) {
      const reading = bottomLineFor({ cardProductId: id, todayIso: TODAY });
      expect(reading.state).toBe('NOT_A_CANONICAL_PRODUCT');
      expect(reading.netMonthlyValueIls).toBeUndefined();
      expect(reading.monthlyFee).toBeUndefined();
    }
  });

  it('returns the candidate set, and no single fee, when the tariff differs by card level', () => {
    const reading = bottomLineFor({ cardProductId: MULTI_LEVEL, todayIso: TODAY });
    expect(reading.state).toBe('FEE_NEEDS_LEVEL');
    expect(reading.monthlyFee).toBeUndefined();
    expect(reading.netMonthlyValueIls).toBeUndefined();
    expect(reading.feeCandidates.length).toBeGreaterThan(1);
    for (const candidate of reading.feeCandidates) {
      expect(candidate.levels.length).toBeGreaterThan(0);
    }
  });

  it('counts the benefits the estate evidences for the product', () => {
    const reading = bottomLineFor({ cardProductId: 'card:max:skymax', todayIso: TODAY });
    expect(reading.evidencedBenefits.length).toBeGreaterThan(0);
    expect(reading.showableBenefits.length).toBeLessThanOrEqual(reading.evidencedBenefits.length);
    for (const row of reading.showableBenefits) {
      expect(row.validity).not.toBe('EXPIRED');
      expect(row.validity).not.toBe('UPCOMING');
    }
  });

  it('never states a net value without a realised benefit figure', () => {
    /* Over the whole catalog, and with no realised value supplied — which is every real render
       today — nothing may reach the AVAILABLE state. */
    const stated = allCatalogProducts()
      .slice(0, 80)
      .map((p) => bottomLineFor({ cardProductId: p.cardId, todayIso: TODAY }))
      .filter((r) => r.netMonthlyValueIls !== undefined);
    expect(stated).toEqual([]);
  });

  it('subtracts only when the fee is a single figure AND a realised value was supplied', () => {
    const single = allCatalogProducts().find((p) => {
      const fee = cardFeeProfileFor(p.cardId)?.cardFee;
      if (fee === undefined) return false;
      const monthly = fee.candidates.filter((c) => /חודש|monthly/i.test(c.frequency ?? ''));
      const distinct = new Set(monthly.map((c) => `${c.value}|${c.unit}`));
      return distinct.size === 1 && monthly[0]?.unit === 'ILS';
    });
    if (single === undefined) {
      throw new Error('the shipped corpus resolves no product to a single monthly ILS card fee');
    }

    const withoutValue = bottomLineFor({ cardProductId: single.cardId, todayIso: TODAY });
    expect(withoutValue.state).toBe('FEE_ONLY');
    expect(withoutValue.monthlyFee).toBeDefined();
    expect(withoutValue.netMonthlyValueIls).toBeUndefined();

    const fee = withoutValue.monthlyFee?.value as number;
    const withValue = bottomLineFor({
      cardProductId: single.cardId, todayIso: TODAY, realisedBenefitValueIls: 40,
    });
    expect(withValue.state).toBe('AVAILABLE');
    expect(withValue.netMonthlyValueIls).toBeCloseTo(40 - fee, 6);
    expect(withValue.realisedBenefitValueIls).toBe(40);
  });

  it('treats a zero realised value as a fact and not as an absence', () => {
    const single = allCatalogProducts().find((p) => {
      const monthly = (cardFeeProfileFor(p.cardId)?.cardFee.candidates ?? [])
        .filter((c) => /חודש|monthly/i.test(c.frequency ?? ''));
      return new Set(monthly.map((c) => `${c.value}|${c.unit}`)).size === 1 && monthly[0]?.unit === 'ILS';
    });
    if (single === undefined) throw new Error('no single-fee product in the corpus');
    const reading = bottomLineFor({
      cardProductId: single.cardId, todayIso: TODAY, realisedBenefitValueIls: 0,
    });
    /* Zero realised is "you used nothing", which the app can only know if somebody measured it —
       so it IS a value and the net is negative by the fee. It is not the default. */
    expect(reading.state).toBe('AVAILABLE');
    expect(reading.netMonthlyValueIls).toBeLessThan(0);
  });

  it('refuses a non-finite realised value rather than producing NaN', () => {
    const reading = bottomLineFor({
      cardProductId: 'card:max:skymax', todayIso: TODAY, realisedBenefitValueIls: Number.NaN,
    });
    expect(reading.netMonthlyValueIls).toBeUndefined();
  });
});
