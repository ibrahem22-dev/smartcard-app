import {
  MAJOR_SETTLEMENT_CURRENCIES,
  SMALL_AMOUNT_ADVISORY_THRESHOLD_ILS,
  compareAbroad,
  resolveFxRow,
  type FxRowLike,
} from '../fx';
import { PROVENANCE_CHIPS } from '../../authority/provenanceChip';

/**
 * N3 -- the FX engine's four named behaviours, each watched here by name:
 * ranking through one conversion path; exception resolution most-specific /
 * longest-name-first; the D1 small-amount advisory with suppressed deltas;
 * the minor-currency ATM floor.
 */

const rate = (currency: string, quoteUnit: number, rateIlsPerQuoteUnit: number) => ({
  currency,
  quoteUnit,
  rateIlsPerQuoteUnit,
  rateDate: '2026-08-24',
  fetchDate: '2026-08-24',
  source: 'BUNDLED',
  provenance: 'ESTIMATE',
  rateBasis: 'BOI_REPRESENTATIVE',
} as const);

const jpy = rate('JPY', 100, 186.97); // per 100 JPY -> 1.8697 ILS per JPY

describe('the fx engine ranks through one conversion path', () => {
  it('ranks cards ascending by effective cost — markup and fixed fee included', () => {
    const r = compareAbroad({
      amount: 1_000,
      currency: 'EUR',
      mode: 'purchase',
      rate: rate('EUR', 1, 4.02),
      cards: [
        { cardId: 'expensive-but-flat', fxPercent: 3.0 },
        { cardId: 'cheap-with-fee', fxPercent: 2.5, fixedFeeIls: 5 },
        { cardId: 'cheapest', fxPercent: 2.0 },
      ],
    });
    expect(r.ranked.map((e) => e.cardId)).toEqual(['cheapest', 'cheap-with-fee', 'expensive-but-flat']);
    expect(r.ranked[0]?.quote.effectiveIls).toBeCloseTo(4020 * 1.02, 2);
    for (const e of r.ranked) {
      expect(PROVENANCE_CHIPS).toContain(e.quote.provenance);
      expect(e.quote.provenance).toBe('ESTIMATE');
      expect(e.quote.trace.steps.length).toBeGreaterThan(0);
    }
  });

  it('cards with unknown legs never rank and are named separately', () => {
    const r = compareAbroad({
      amount: 500,
      currency: 'USD',
      mode: 'purchase',
      rate: rate('USD', 1, 3.67),
      cards: [
        { cardId: 'known', fxPercent: 1.5 },
        { cardId: 'unknown-leg' },
      ],
    });
    expect(r.ranked.map((e) => e.cardId)).toEqual(['known']);
    expect(r.unknownCards).toEqual(['unknown-leg']);
  });
});

describe('card-level exceptions resolve longest-name-first', () => {
  const rows: FxRowLike[] = [
    { pairId: 'fx:org:hapoalim|*', appliesToAllOperatorsExcept: ['org:amex-il', 'org:cal'] },
    { pairId: 'fx:org:hapoalim|org:cal' },
  ];

  it('an exact issuer x operator row beats the issuer default', () => {
    expect(resolveFxRow(rows, 'org:hapoalim', 'org:cal')?.pairId).toBe('fx:org:hapoalim|org:cal');
  });

  it('an excepted operator receives NO default — the row does not reach it', () => {
    expect(resolveFxRow(rows, 'org:hapoalim', 'org:amex-il')).toBeUndefined();
  });

  it('an unexcepted operator falls through to the issuer default', () => {
    expect(resolveFxRow(rows, 'org:hapoalim', 'org:isracard')?.pairId).toBe('fx:org:hapoalim|*');
  });

  it('a longer matched name outranks a shorter claim on the same card', () => {
    const wide: FxRowLike[] = [
      { pairId: 'fx:org:x|*' },
      { pairId: 'fx:org:x|org:very-long-operator-name' },
    ];
    expect(resolveFxRow(wide, 'org:x', 'org:very-long-operator-name')?.pairId)
      .toBe('fx:org:x|org:very-long-operator-name');
  });
});

describe('the D1 small-amount advisory (roadmap §5.3 interim behaviour)', () => {
  const base = {
    currency: 'EUR',
    mode: 'purchase' as const,
    rate: rate('EUR', 1, 4.02),
    cards: [{ cardId: 'a', fxPercent: 2.5 }, { cardId: 'b', fxPercent: 3.0 }],
  };

  it('below the cited threshold the advisory fires and savings claims are suppressed', () => {
    const r = compareAbroad({ ...base, amount: 20 }); // ~80 ILS reference
    expect(r.smallAmountAdvisory).toBe(true);
    expect(r.deltasSuppressed).toBe(true);
    expect(SMALL_AMOUNT_ADVISORY_THRESHOLD_ILS).toBe(150);
  });

  it('above the threshold no advisory fires and deltas may be claimed', () => {
    const r = compareAbroad({ ...base, amount: 1_000 }); // ~4000 ILS reference
    expect(r.smallAmountAdvisory).toBe(false);
    expect(r.deltasSuppressed).toBe(false);
  });

  it('the threshold is configurable by the caller, never inline magic', () => {
    const r = compareAbroad({ ...base, amount: 20, smallAmountThresholdIls: 50 });
    expect(r.smallAmountAdvisory).toBe(false);
  });
});

describe('the minor-currency ATM floor (roadmap §7.3 limitation b)', () => {
  it('a foreign ATM figure on a minor currency is labelled a floor, on the entry itself', () => {
    const r = compareAbroad({
      amount: 10_000,
      currency: 'JPY',
      mode: 'atm',
      rate: jpy,
      cards: [{ cardId: 'a', fxPercent: 2.9 }],
    });
    expect(r.ranked[0]?.floor?.reason).toBe('MINOR_CURRENCY_DOUBLE_CONVERSION_UNPRICED');
    const floorStep = r.ranked[0]?.quote.trace.steps.find((s) => s.rule.includes('7.3'));
    expect(floorStep?.detail).toMatch(/FLOOR/);
  });

  it('major settlement currencies and purchase mode carry no floor label', () => {
    const usdAtm = compareAbroad({
      amount: 100, currency: 'USD', mode: 'atm', rate: rate('USD', 1, 3.67),
      cards: [{ cardId: 'a', fxPercent: 2.9 }],
    });
    expect(usdAtm.ranked[0]?.floor).toBeUndefined();
    const jpyPurchase = compareAbroad({
      amount: 10_000, currency: 'JPY', mode: 'purchase', rate: jpy,
      cards: [{ cardId: 'a', fxPercent: 2.9 }],
    });
    expect(jpyPurchase.ranked[0]?.floor).toBeUndefined();
  });

  it('every major settlement currency is named by the cited constant', () => {
    expect([...MAJOR_SETTLEMENT_CURRENCIES]).toEqual(['USD', 'EUR', 'GBP']);
  });
});
