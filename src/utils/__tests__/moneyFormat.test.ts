/**
 * T2 — MONEY & TYPE. The money half, pinned as RENDERED TEXT.
 *
 *   > **T2.** *"every rendered amount uses tabular numerals with thousands-separated shekel
 *   > formatting, and every rendered percentage's TEXT is pinned to its unit"*
 *
 * The percentage half is already pinned next door in `percentUnit.test.ts` and read by C11's
 * debt-retirement gate. This file is the money half, and it exists for the same reason that one
 * does: a formatter can be correct in isolation and still render the wrong string, so the string
 * is what gets asserted.
 *
 * WHY EVERY LOCALE IS CHECKED AND WHY THEY ALL AGREE. `NUMBER_LOCALE` maps Arabic to
 * `ar-IL-u-nu-latn` — Arabic language, LATIN digits, deliberately. Measured before this file was
 * written, because the obvious assumption is wrong in both directions: a bare `ar` locale renders
 * `₪١٨٬٠٠٠٫٠٠` with Arabic-Indic digits and U+066C as the group separator, and a test pinning
 * `18,000.00` against it would fail for a good reason. The app does not use a bare `ar`, so all
 * three shipped locales agree — and that agreement is asserted rather than assumed, so the day
 * somebody drops the `-u-nu-latn` extension this file says so.
 */
import {
  CURRENCY_SIGN,
  TABULAR_NUMERALS,
  formatAmount,
  formatMoney,
} from '../money';

import type { AppLanguage } from '../../i18n/locale';

const LANGUAGES: readonly AppLanguage[] = ['he', 'ar', 'en'];

describe('T2 — money renders as thousands-separated shekels', () => {
  it('renders a shekel amount with thousands separation: 18000 becomes ₪18,000.00', () => {
    expect(formatMoney(18000, 'he')).toBe('₪18,000.00');
  });

  it('separates thousands at every magnitude the app renders', () => {
    expect(formatMoney(500, 'he')).toBe('₪500.00');
    expect(formatMoney(18000, 'he')).toBe('₪18,000.00');
    expect(formatMoney(1234567.5, 'he')).toBe('₪1,234,567.50');
  });

  it('renders the same money text in he, ar and en', () => {
    const rendered = LANGUAGES.map((language) => formatMoney(18000, language));
    expect(new Set(rendered).size).toBe(1);
    expect(rendered[0]).toBe('₪18,000.00');
  });

  it('always renders two fraction digits, so amounts align down a column', () => {
    for (const language of LANGUAGES) {
      expect(formatMoney(500, language)).toMatch(/\.\d{2}$/);
      expect(formatMoney(0, language)).toBe('₪0.00');
    }
  });

  it('carries the currency sign exactly once, at the front', () => {
    const rendered = formatMoney(18000, 'he');
    expect(rendered.startsWith(CURRENCY_SIGN)).toBe(true);
    expect(rendered.split(CURRENCY_SIGN)).toHaveLength(2);
  });

  it('renders digits without the currency sign when the caller asks for an amount', () => {
    expect(formatAmount(18000, 'he')).toBe('18,000.00');
    expect(formatAmount(18000, 'he')).not.toContain(CURRENCY_SIGN);
  });

  it('applies tabular numerals, which is what makes a column of amounts align', () => {
    expect(TABULAR_NUMERALS).toEqual({ fontVariant: ['tabular-nums'] });
  });
});
