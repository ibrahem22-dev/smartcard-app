import {
  blocked,
  conflict,
  historical,
  known,
  unknown,
} from '../authorityValue';
import {
  FORBIDDEN_UNAVAILABLE_RENDERINGS,
  assertSafeRendering,
  presentAuthority,
  rendersAsZeroAmount,
} from '../presentation';

/** A deliberately hostile formatter: the kind that turns absence into "0%". */
const sloppyFormat = (value: number | undefined): string =>
  `${(value ?? 0).toFixed(1)}%`;

describe('W1-AS-03 UI-safe presentation', () => {
  it('never emits an amount for an unavailable value', () => {
    for (const value of [
      unknown('no_source'),
      blocked('integration_off'),
      conflict<number>([], 'disagree'),
    ]) {
      const presented = presentAuthority(value, sloppyFormat);
      expect(presented.amountText).toBeNull();
      expect(presented.mayShowAsVerified).toBe(false);
    }
  });

  it('never calls the formatter on an unavailable value', () => {
    // This is what stops `value ?? 0` from ever producing "0.0%".
    const format = jest.fn(sloppyFormat);
    presentAuthority(unknown('no_source'), format);
    presentAuthority(blocked('off'), format);
    presentAuthority(conflict<number>([], 'x'), format);
    expect(format).not.toHaveBeenCalled();
  });

  it('distinguishes withheld from unknown from disputed', () => {
    expect(presentAuthority(unknown('r'), sloppyFormat).tone).toBe('UNAVAILABLE');
    expect(presentAuthority(blocked('r'), sloppyFormat).tone).toBe('WITHHELD');
    expect(presentAuthority(conflict<number>([], 'r'), sloppyFormat).tone).toBe(
      'DISPUTED',
    );
  });

  it('shows a historical number but never as verified', () => {
    const presented = presentAuthority(
      historical(1.5, 'VERIFIED', '2019-01-01'),
      sloppyFormat,
    );
    expect(presented.tone).toBe('STALE');
    expect(presented.amountText).toBe('1.5%');
    expect(presented.mayShowAsVerified).toBe(false);
  });

  it('shows bundled data without a verified affordance', () => {
    const presented = presentAuthority(
      known(2.8, 'ESTIMATE', '2026-01-01'),
      sloppyFormat,
    );
    expect(presented.tone).toBe('UNVERIFIED_INPUT');
    expect(presented.amountText).toBe('2.8%');
    expect(presented.mayShowAsVerified).toBe(false);
  });

  it('marks official authority verified', () => {
    const presented = presentAuthority(
      known(2.8, 'VERIFIED', '2026-01-01'),
      sloppyFormat,
    );
    expect(presented.tone).toBe('VERIFIED');
    expect(presented.mayShowAsVerified).toBe(true);
  });

  it('rejects every forbidden rendering of an unavailable value', () => {
    const presented = presentAuthority(unknown('no_source'), sloppyFormat);
    for (const forbidden of FORBIDDEN_UNAVAILABLE_RENDERINGS) {
      expect(() => assertSafeRendering(presented, forbidden)).toThrow(
        /rendered as/,
      );
    }
    expect(() => assertSafeRendering(presented, '—')).not.toThrow();
  });

  it('rejects a zero amount at any precision or currency form', () => {
    // Regression: an exact-match list let "0.00%" through. Zero-ness is now
    // detected structurally, so new precisions cannot evade it.
    const presented = presentAuthority(unknown('no_source'), sloppyFormat);
    for (const zero of ['0', '0%', '0.0%', '0.00%', '0.000', '₪0', '$0.00', '-0']) {
      expect(() => assertSafeRendering(presented, zero)).toThrow(/zero amount/);
    }
  });

  it('does not reject a genuine non-zero or non-numeric rendering', () => {
    const presented = presentAuthority(unknown('no_source'), sloppyFormat);
    for (const safe of ['—', 'לא ידוע', 'unknown', '2.8%']) {
      expect(() => assertSafeRendering(presented, safe)).not.toThrow();
    }
  });

  it('rendersAsZeroAmount is precise about what counts as zero', () => {
    expect(rendersAsZeroAmount('0.00%')).toBe(true);
    expect(rendersAsZeroAmount('₪0')).toBe(true);
    expect(rendersAsZeroAmount('0.01')).toBe(false);
    expect(rendersAsZeroAmount('unknown')).toBe(false);
    expect(rendersAsZeroAmount('')).toBe(false);
    // "10" must not be mistaken for zero by a sloppy strip.
    expect(rendersAsZeroAmount('10')).toBe(false);
  });
});
