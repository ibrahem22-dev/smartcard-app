import { useCallback, useMemo } from 'react';

import { useLanguage } from './useLanguage';
import {
  formatAmount,
  formatMoney,
  formatPercent,
  formatRatioAsPercent,
} from '../utils/money';

/**
 * THE MONEY FORMATTER, BOUND TO THE READER'S LANGUAGE — criterion A7.
 *
 * `src/utils/money.ts` holds the one formatter. It takes a language, because a formatter that read
 * global state would be untestable and would format differently depending on when it was called.
 * This hook is how a component gets the language into it.
 *
 * WHY A HOOK AND NOT A MODULE-LEVEL FUNCTION. The eight formatters this replaces were all
 * module-level — `function formatILS(amount)` at the top of a screen — and that is precisely why
 * every one of them hardcoded `'he-IL'`: a function outside the component tree has no way to ask
 * what language the reader chose, so the author picked one. The shape caused the defect.
 */
export interface UseMoneyResult {
  /** An amount with the shekel sign. Two decimals, always. */
  readonly money: (value: number, fractionDigits?: number) => string;
  /** Digits only, grouped for the reader's language. No currency sign. */
  readonly amount: (value: number, fractionDigits?: number) => string;
  /** A percentage, two decimals maximum, no trailing zeros. */
  readonly percent: (value: number) => string;
  /** A unit ratio such as 0.35 rendered as 35%. */
  readonly ratioPercent: (value: number) => string;
}

export function useMoney(): UseMoneyResult {
  const { language } = useLanguage();

  const money = useCallback(
    (value: number, fractionDigits?: number): string =>
      formatMoney(value, language, fractionDigits),
    [language],
  );

  const amount = useCallback(
    (value: number, fractionDigits?: number): string =>
      formatAmount(value, language, fractionDigits),
    [language],
  );

  const percent = useCallback(
    (value: number): string => formatPercent(value, language),
    [language],
  );

  const ratioPercent = useCallback(
    (value: number): string => formatRatioAsPercent(value, language),
    [language],
  );

  return useMemo(
    () => ({ money, amount, percent, ratioPercent }),
    [money, amount, percent, ratioPercent],
  );
}
