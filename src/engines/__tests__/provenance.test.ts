import { PROVENANCE_CHIPS, type ProvenanceChip } from '../../authority/provenanceChip';
import { provenanced } from '../../engines/provenance';
import { convertToIls } from '../../engines/currency';

/**
 * T2 -- every numeric engine output carries a state from the Data Contract vocabulary, and the
 * vocabulary engines use is THE app-side one, not a private copy.
 */

describe('the provenanced wrapper (T2)', () => {
  it('labels a number and refuses to label nothing', () => {
    const p = provenanced(934.85, 'ESTIMATE');
    expect(p).toEqual({ value: 934.85, provenance: 'ESTIMATE' });
    expect(() => provenanced(undefined as unknown as number, 'ESTIMATE')).toThrow(/nothing/);
  });

  it('carries the Stale modifier beside the chip, never instead of it', () => {
    const p = provenanced(100, 'VERIFIED', true);
    expect(p.stale).toBe(true);
    expect(p.provenance).toBe('VERIFIED');
  });

  it('only speaks the Data Contract four states', () => {
    expect(PROVENANCE_CHIPS).toEqual(['USER', 'VERIFIED', 'ESTIMATE', 'UNKNOWN']);
    const legal: readonly ProvenanceChip[] = PROVENANCE_CHIPS;
    for (const chip of legal) expect(legal).toContain(chip);
  });
});

describe('convertToIls output provenance (T2)', () => {
  const rate = {
    currency: 'JPY',
    quoteUnit: 100,
    rateIlsPerQuoteUnit: 1.8697,
    rateDate: '2026-08-24',
    fetchDate: '2026-08-24',
    source: 'BUNDLED',
    provenance: 'ESTIMATE',
    rateBasis: 'BOI_REPRESENTATIVE',
  } as const;

  it('the derived ILS figure is a member of the contract vocabulary, always ESTIMATE', () => {
    const r = convertToIls({ amount: 50_000, currency: 'JPY' }, rate, { percent: 2.75 });
    expect(PROVENANCE_CHIPS).toContain(r.provenance);
    expect(r.provenance).toBe('ESTIMATE');
  });
});
