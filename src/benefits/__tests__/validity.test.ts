import { hasClosed, resolveStackingPair } from '../validity';

describe('the benefits matching kernels (PD-P3-007)', () => {
  it('closes a dated benefit only after its inclusive valid-until day', () => {
    expect(hasClosed('2026-08-21', '2026-08-22')).toBe(true);
    expect(hasClosed('2026-08-22', '2026-08-22')).toBe(false);
    expect(hasClosed('2026-08-23', '2026-08-22')).toBe(false);
  });

  it('keeps missing and UNTIL_FURTHER_NOTICE windows open', () => {
    expect(hasClosed(undefined, '2026-08-22')).toBe(false);
    expect(hasClosed('UNTIL_FURTHER_NOTICE', '2026-08-22')).toBe(false);
  });

  it('refuses malformed clocks instead of ordering them lexically', () => {
    expect(() => hasClosed('2026-02-30', '2026-08-22')).toThrow(/real calendar date/);
    expect(() => hasClosed('2026-08-21', '22-08-2026')).toThrow(/yyyy-mm-dd/);
  });

  it('resolves stacking to all three contract outcomes', () => {
    expect(resolveStackingPair('STACKS', 'STACKS')).toBe('MAY_SUM');
    expect(resolveStackingPair('MUTUALLY_EXCLUSIVE', 'STACKS'))
      .toBe('MUST_NOT_SUM_EXPLICIT');
    expect(resolveStackingPair('UNKNOWN', 'STACKS')).toBe('MUST_NOT_SUM_DEFAULT');
    expect(resolveStackingPair(undefined, 'STACKS')).toBe('MUST_NOT_SUM_DEFAULT');
  });
});
