import { useCallback, useMemo } from 'react';

import { useLanguage } from './useLanguage';
import { formatAmount, formatMoney, formatPercent } from '../utils/money';

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

  /**
   * IT TAKES A RATIO. The parameter is named for its unit because the unit is the whole
   * defect: `formatPercent` once appended a percent sign without multiplying, and every
   * load figure the app rendered was a hundred times too small (OQ-P5-003, ruled as
   * OQ-MDC-004 option 1). A figure that is already a percentage converts with
   * `ratioFromPercent` at the call site; there is no second formatter.
   */
  const percent = useCallback(
    (ratio: number): string => formatPercent(ratio, language),
    [language],
  );

  return useMemo(() => ({ money, amount, percent }), [money, amount, percent]);
}
