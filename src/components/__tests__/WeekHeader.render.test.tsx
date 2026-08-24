/**
 * A6 IN THREE LOCALES, WITH HEBREW AND ARABIC CONTENT SPECIFICALLY — flag L13a.
 *
 *   > *"Latin-only fixtures are, by themselves, evidence of nothing. Every text gate is validated
 *   > against Hebrew and Arabic content specifically."*
 *
 * A suite that rendered the week header in English and asserted seven cells would pass against a
 * table filled in with `S M T W T F S` three times. So every assertion below either reads the
 * actual script or checks something a wrong script cannot satisfy.
 *
 * The header is rendered per language by driving `useLanguage` — the same hook the app uses — so
 * what is being tested is the component's behaviour and not a re-implementation of it.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

import { WeekHeader } from '../WeekHeader';
import {
  DAY_LETTERS,
  DAY_NAMES,
  WEEK_ORDER,
  WEEK_STARTS_ON,
  isIsolated,
  ltrNumerals,
} from '../../utils/calendar';

jest.mock('../../hooks/useLanguage', () => ({
  useLanguage: jest.fn(),
}));

import { useLanguage } from '../../hooks/useLanguage';

const mockLanguage = (language: 'he' | 'ar' | 'en'): void => {
  (useLanguage as jest.Mock).mockReturnValue({ language });
};

const HEBREW = /[֐-׿]/;
const ARABIC = /[؀-ۿ]/;

const textsOf = (node: unknown): string[] => {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === 'string') { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n && typeof n === 'object' && 'children' in n) walk((n as { children: unknown }).children);
  };
  walk(node);
  return out;
};

describe('WeekHeader — A6: Sunday-first with he/ar day letters, in three locales', () => {
  it('starts the week on Sunday, and the order is a full week', () => {
    expect(WEEK_STARTS_ON).toBe(0);
    expect([...WEEK_ORDER]).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it.each([['he'], ['ar'], ['en']] as const)('renders seven cells in %s', (language) => {
    mockLanguage(language);
    const { queryByTestId } = render(<WeekHeader />);
    for (const day of WEEK_ORDER) {
      expect(queryByTestId(`week-header-day-${String(day)}`)).toBeTruthy();
    }
    expect(queryByTestId('week-header-day-7')).toBeNull();
  });

  it('renders HEBREW letters in Hebrew — not a Latin table wearing a Hebrew label', () => {
    mockLanguage('he');
    const { toJSON } = render(<WeekHeader />);
    const letters = textsOf(toJSON()).filter((s) => s.trim() !== '');

    expect(letters).toHaveLength(7);
    expect(letters.every((l) => HEBREW.test(l))).toBe(true);
    // Sunday is aleph — the first cell is the first day, whatever side of the screen it lands on.
    expect(letters[0]).toBe('א');
  });

  it('renders ARABIC letters in Arabic', () => {
    mockLanguage('ar');
    const { toJSON } = render(<WeekHeader />);
    const letters = textsOf(toJSON()).filter((s) => s.trim() !== '');

    expect(letters).toHaveLength(7);
    expect(letters.every((l) => ARABIC.test(l))).toBe(true);
    expect(letters[0]).toBe('ح');
  });

  it('gives every cell a full day name to read aloud — a letter is not a day', () => {
    for (const language of ['he', 'ar', 'en'] as const) {
      mockLanguage(language);
      const { getByTestId } = render(<WeekHeader />);
      for (const day of WEEK_ORDER) {
        const cell = getByTestId(`week-header-day-${String(day)}`);
        expect(cell.props.accessibilityLabel).toBe(DAY_NAMES[language][day]);
        expect(String(cell.props.accessibilityLabel).length).toBeGreaterThan(1);
      }
    }
  });

  it('gives the three locales THREE DIFFERENT tables — the L13a check', () => {
    // If somebody fills the Hebrew row with Latin, this is what catches it.
    const he = DAY_LETTERS.he.join('');
    const ar = DAY_LETTERS.ar.join('');
    const en = DAY_LETTERS.en.join('');
    expect(new Set([he, ar, en]).size).toBe(3);
    expect(HEBREW.test(he)).toBe(true);
    expect(ARABIC.test(ar)).toBe(true);
    expect(HEBREW.test(en)).toBe(false);
    expect(ARABIC.test(en)).toBe(false);
  });
});

describe('numerals stay LTR inside RTL text — A6’s third clause', () => {
  it('wraps a date in a directional isolate', () => {
    const wrapped = ltrNumerals('12/08/2026');
    expect(isIsolated(wrapped)).toBe(true);
    // U+2066 LEFT-TO-RIGHT ISOLATE … U+2069 POP DIRECTIONAL ISOLATE
    expect(wrapped.codePointAt(0)).toBe(0x2066);
    expect(wrapped.codePointAt(wrapped.length - 1)).toBe(0x2069);
  });

  it('leaves the digits and separators untouched — an isolate reorders nothing itself', () => {
    expect(ltrNumerals('12/08/2026')).toContain('12/08/2026');
  });

  it('an unwrapped string is not mistaken for an isolated one', () => {
    expect(isIsolated('12/08/2026')).toBe(false);
  });
});
