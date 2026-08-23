import { useMemo } from 'react';

import {
  calculateCardLoan,
  calculateInstallmentInterest,
} from '../engines/interestCalculator';
import type { InterestResult } from '../types/interest.types';

/**
 * THE SEAM BETWEEN THE INTEREST ENGINE AND THE SCREEN THAT SHOWS ITS RESULT.
 *
 * Execution Model §9.4 rule 2: a surface renders an engine's RESULT and never performs the
 * derivation itself. `InterestCalculatorScreen` was calling `calculateInstallmentInterest` and
 * `calculateCardLoan` directly inside a `useMemo`, which made the screen the place where the
 * calculation happened. This hook is where it happens now.
 *
 * NO ARITHMETIC MOVED. The engine functions are untouched and are still the only thing that
 * computes; what moved is the decision of WHICH one to call and WHEN, out of the render tree.
 * `usePurchaseGate` already established this shape in this codebase — the interest screen was the
 * one surface that had skipped it.
 *
 * The null contract is the screen's existing one, preserved exactly: incomplete input yields null,
 * and an engine that throws yields null rather than a partial result, because a half-computed
 * number about somebody's money is worse than no number.
 */
export type InterestCalculation = 'installment' | 'cardLoan';

export function useInterestResult(
  kind: InterestCalculation,
  amount: number | null,
  months: number | null,
  rate: number | null,
): InterestResult | null {
  return useMemo<InterestResult | null>(() => {
    if (amount === null || months === null || rate === null) return null;
    try {
      return kind === 'installment'
        ? calculateInstallmentInterest(amount, months, rate)
        : calculateCardLoan(amount, months, rate);
    } catch {
      return null;
    }
  }, [kind, amount, months, rate]);
}
