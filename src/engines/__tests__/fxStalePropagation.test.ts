import type { FxRate } from '../../data/adapter/vocabulary';
import { compareAbroad } from '../fx';

const rate: FxRate = {
  currency: 'USD',
  quoteUnit: 1,
  rateIlsPerQuoteUnit: 3.7,
  rateDate: '2026-08-01',
  fetchDate: '2026-08-01',
  source: 'BUNDLED',
  provenance: 'ESTIMATE',
  rateBasis: 'representative',
};

function compare(asOfDate: string) {
  return compareAbroad({
    amount: 100,
    currency: 'USD',
    mode: 'purchase',
    cards: [{ cardId: 'card-a', fxPercent: 2.5 }],
    rate,
    asOfDate,
  });
}

describe('FX stale-data propagation', () => {
  it('does not mark a rate stale at the seven-calendar-day boundary', () => {
    const result = compare('2026-08-08');
    expect(result.rateFreshness.stale).toBe(false);
    expect(result.ranked[0]?.quote.stale).toBeUndefined();
  });

  it('marks the rate and every derived quote stale after seven calendar days', () => {
    const result = compare('2026-08-09');
    expect(result.rateFreshness.stale).toBe(true);
    expect(result.ranked[0]?.quote.stale).toBe(true);
    expect(result.rateFreshness.businessDaysAreAuthoritative).toBe(false);
    expect(result.rateFreshness.deferredBy).toBe('OD-31');
  });
});
