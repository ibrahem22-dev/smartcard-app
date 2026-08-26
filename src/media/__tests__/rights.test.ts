import { maskLast4 } from '../maskLast4';
import { rightsVerdict } from '../rights';
import type { MediaRecord } from '../types';

describe('rightsVerdict — M3 fail-closed', () => {
  it('absence of rightsState is UNRESOLVED and never renderable', () => {
    const rec: MediaRecord = {
      mediaKind: 'MERCHANT_LOGO',
      subjectKind: 'merchant',
      subjectId: '*',
      fallbackClass: 'benefit',
      sourceUrl: 'https://example.com/logo.svg',
    };
    expect(rightsVerdict(rec, true).renderable).toBe(false);
    expect(rightsVerdict(rec, true).why).toMatch(/UNRESOLVED/);
  });

  it('a session-named rightsDecidedBy is refused even when marked CLEARED', () => {
    const rec: MediaRecord = {
      mediaKind: 'MERCHANT_LOGO',
      subjectKind: 'merchant',
      subjectId: '*',
      fallbackClass: 'benefit',
      rightsState: 'CLEARED',
      rightsBasis: 'appears freely usable',
      rightsDecidedBy: 'media-enrichment-campaign session s07',
      rightsDecidedAt: '2026-08-25',
    };
    expect(rightsVerdict(rec, true).renderable).toBe(false);
    expect(rightsVerdict(rec, true).selfGranted).toBe(true);
  });
});

describe('maskLast4 — M5 digits from last4 alone', () => {
  it('omitted last4 yields no mask', () => {
    expect(maskLast4(undefined)).toBeNull();
    expect(maskLast4('')).toBeNull();
  });

  it('four digits become the unmirrored masked group', () => {
    expect(maskLast4('5564')).toBe('•••• •••• •••• 5564');
  });

  it('anything that is not exactly four digits is refused', () => {
    expect(maskLast4('56')).toBeNull();
    expect(maskLast4('12345')).toBeNull();
    expect(maskLast4('abcd')).toBeNull();
  });
});
