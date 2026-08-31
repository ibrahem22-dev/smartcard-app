/**
 * C11 / T2 — THE RENDERED PERCENTAGE TEXT, PINNED TO ITS UNIT.
 *
 * These assertions exist because nothing like them did. `formatPercent` appended a percent sign
 * without multiplying by 100, so every load percentage the app rendered was a hundred times too
 * small — Home's threshold ticks read `0.35%` and `0.5%` on every run, for every user, regardless
 * of data — and forty-six gates, 1,190 tests and three cross-surface agreement properties were
 * green the entire time. The agreement properties could not see it: every surface was handed the
 * same correct ratio and formatted it the same wrong way, so they agreed. Agreement is not
 * correctness.
 *
 * What was missing was not a better property. It was a test that looked at the STRING a user
 * reads. So each case below asserts an exact rendered string, and the negative case asserts the
 * old output can no longer be produced. Raised as OQ-P5-003, carried through P5, ruled by the
 * Owner as OQ-MDC-004 option 1.
 *
 * The case names are required BY NAME by tools/mdc/gates/debt-retirement.mjs. Renaming one without
 * updating the gate turns the gate red, which is the intended coupling: the gate must not be able
 * to pass because a case quietly disappeared.
 */
import { formatPercent, ratioFromPercent } from '../money';
import {
  INSTALLMENT_STRONG_WARNING_RATIO_OF_INCOME,
  INSTALLMENT_BLOCKED_RATIO_OF_INCOME,
} from '../../config/financial';
import type { AppLanguage } from '../../i18n/locale';

const LANGUAGES: readonly AppLanguage[] = ['he', 'ar', 'en'];

describe('formatPercent renders a ratio as a percentage', () => {
  it('renders a ratio as its percentage: 0.41 becomes 41%', () => {
    expect(formatPercent(0.41, 'he')).toBe('41%');
  });

  it('never renders a ratio as a fraction of a percent', () => {
    // The exact defect, stated as the string it used to produce.
    expect(formatPercent(0.41, 'he')).not.toBe('0.41%');
    expect(formatPercent(0.35, 'he')).not.toBe('0.35%');
    expect(formatPercent(0.5, 'he')).not.toBe('0.5%');
  });

  it('renders the two shipped load thresholds as 35% and 50%', () => {
    // Read from the config the engine actually uses, not from literals typed here: if someone
    // changes the thresholds these assertions follow them, and if someone changes their UNIT
    // these assertions break, which is the point.
    expect(INSTALLMENT_STRONG_WARNING_RATIO_OF_INCOME).toBeLessThan(1);
    expect(INSTALLMENT_BLOCKED_RATIO_OF_INCOME).toBeLessThan(1);
    expect(formatPercent(INSTALLMENT_STRONG_WARNING_RATIO_OF_INCOME, 'he')).toBe('35%');
    expect(formatPercent(INSTALLMENT_BLOCKED_RATIO_OF_INCOME, 'he')).toBe('50%');
  });

  it('renders a whole percentage without a decimal tail from floating point', () => {
    // 0.35 * 100 is 35.000000000000004 in IEEE 754. A reader must never see that.
    expect(formatPercent(0.35, 'he')).toBe('35%');
    expect(formatPercent(0.07, 'he')).toBe('7%');
    expect(formatPercent(0.29, 'he')).toBe('29%');
  });

  it('keeps two decimals at most, as a quoted rate does', () => {
    expect(formatPercent(0.1314, 'he')).toBe('13.14%');
    expect(formatPercent(0.185, 'he')).toBe('18.5%');
    expect(formatPercent(0.123456, 'he')).toBe('12.35%');
  });

  it('renders zero and one as 0% and 100%', () => {
    expect(formatPercent(0, 'he')).toBe('0%');
    expect(formatPercent(1, 'he')).toBe('100%');
  });

  it('renders the same percentage in he, ar and en', () => {
    for (const language of LANGUAGES) {
      expect(formatPercent(0.41, language)).toContain('41');
      expect(formatPercent(0.41, language)).toContain('%');
      expect(formatPercent(0.41, language)).not.toContain('0.41');
    }
  });
});

describe('an already-percent figure is converted, not given a second formatter', () => {
  it('converts an already-percent figure through ratioFromPercent', () => {
    // The four call sites the Owner ruling names hold values the pack states in percent.
    expect(formatPercent(ratioFromPercent(18.5), 'he')).toBe('18.5%');
    expect(formatPercent(ratioFromPercent(2), 'he')).toBe('2%');
    expect(formatPercent(ratioFromPercent(0.5), 'he')).toBe('0.5%');
  });

  it('round-trips: a percentage converted to a ratio renders as itself', () => {
    for (const p of [0, 0.5, 2, 13.14, 18.5, 35, 50, 100]) {
      expect(formatPercent(ratioFromPercent(p), 'en')).toBe(
        `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(p)}%`,
      );
    }
  });
});
