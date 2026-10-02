import { convertToIls, perOne } from '../currency';
import type { FxRate } from '@smartcard/data-authority-adapter';

/**
 * X1–X3 — THE ENGINE'S ARITHMETIC, INCLUDING THE UNIT TRAP (OD-23b, ADR-013).
 *
 * The rate used is read from the REAL bundled snapshot where a JPY control is needed, so the
 * control is about shipped bytes rather than a fixture.
 */

const jpy = (rateIlsPerQuoteUnit: number, quoteUnit = 100, rateDate = '2026-08-18'): FxRate => ({
  currency: 'JPY',
  quoteUnit,
  rateIlsPerQuoteUnit,
  rateDate,
  fetchDate: '2026-08-25',
  source: 'BUNDLED',
  provenance: 'ESTIMATE',
  rateBasis: 'BOI_REPRESENTATIVE',
});

describe('X1 — the quoteUnit divide is implemented, once, in the engine', () => {
  it('50,000 JPY at the shipped rate converts to 934.85 ILS — not 93,485.00', () => {
    // The contract's own numbers, from ADR-020 §4 and the handoff.
    const result = convertToIls({ amount: 50_000, currency: 'JPY' }, jpy(1.8697));
    expect(result.referenceIls).toBeCloseTo(934.85, 2);
    expect(result.effectiveIls).toBeCloseTo(934.85, 2);
  });

  it('perOne normalises per-100 AND per-10 quotations through one function', () => {
    expect(perOne(jpy(186.97))).toBeCloseTo(1.8697, 6);
    expect(perOne({
      quoteUnit: 10, rateIlsPerQuoteUnit: 0.003,
    })).toBeCloseTo(0.0003, 9);
    expect(perOne({
      quoteUnit: 1, rateIlsPerQuoteUnit: 2.986,
    })).toBeCloseTo(2.986, 9);
  });

  it('the card’s FX percentage lands on top of the reference figure, and ranks on effectiveIls', () => {
    const r = convertToIls({ amount: 50_000, currency: 'JPY' }, jpy(1.8697), { percent: 2.75 });
    expect(r.referenceIls).toBeCloseTo(934.85, 2);
    expect(r.fxPercentApplied).toBe(2.75);
    expect(r.effectiveIls).toBeCloseTo(934.85 * 1.0275, 2);
    expect(r.effectiveIls).toBeGreaterThan(r.referenceIls);
  });

  it('a non-positive or non-finite amount is refused, not priced', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => convertToIls({ amount: bad, currency: 'JPY' }, jpy(1.8697))).toThrow();
    }
  });
});

describe('X4 controls — watched firing', () => {
  it('CONTROL: with the divide removed, 50,000 JPY reads 93,485.00 — a factor of exactly one hundred', () => {
    // The negative control the contract names for X1, run as arithmetic rather than by deleting
    // code: this is what every figure becomes if any caller skips perOne.
    const rate = jpy(1.8697);
    const withDivide = 50_000 * perOne(rate);
    const withoutDivide = 50_000 * rate.rateIlsPerQuoteUnit;
    expect(withDivide).toBeCloseTo(934.85, 2);
    expect(withoutDivide).toBeCloseTo(93485.0, 2);
    expect(withoutDivide / withDivide).toBeCloseTo(rate.quoteUnit, 9);
  });

  it('CONTROL: a VERIFIED-provenance input still produces an ESTIMATE output — never inherited', () => {
    // X3's downgrade, exercised against an input pretending to carry the strongest grade there is.
    const verifiedish = { ...jpy(1.8697), provenance: 'VERIFIED' as unknown as 'ESTIMATE' };
    const r = convertToIls({ amount: 50_000, currency: 'JPY' }, verifiedish);
    expect(verifiedish.provenance as unknown as string).toBe('VERIFIED');
    expect(r.provenance).toBe('ESTIMATE');
  });
});
