/**
 * MVP_SCOPE §7.4 — Purchase Gate inputs, thresholds and obligation semantics.
 *
 * Every value here is a BUSINESS_RULE in the sense of
 * `src/authority/claimClassification.ts`: a product parameter the Owner chose,
 * not a financial fact about the world. §7.4 grants Claude Code authority to
 * tune them, which is exactly why they live in one named, testable place
 * instead of as magic numbers inside engine branches.
 *
 * These are NOT financial authority. A verdict computed from them is advice
 * about the user's own entered numbers — it never asserts anything about what
 * an issuer charges.
 */

import type { Obligation } from '../types/cashflow.types';
import {
  PURCHASE_WARNING_BUFFER_RATIO_OF_INCOME,
  PURCHASE_WAIT_24H_RATIO_OF_INCOME,
  PURCHASE_BLOCKED_UTILIZATION_RATIO,
  PURCHASE_WARNING_UTILIZATION_RATIO,
} from '../config/financial';

export const PURCHASE_GATE_RULES = {
  /** §7.4 `warning` — post-purchase buffer below this share of monthly income. */
  warningBufferRatioOfIncome: PURCHASE_WARNING_BUFFER_RATIO_OF_INCOME,
  /** §7.4 `wait_24h` — a single non-essential purchase at or above this share. */
  wait24hPurchaseRatioOfIncome: PURCHASE_WAIT_24H_RATIO_OF_INCOME,
  /**
   * Credit-utilisation guards. §7.4 does not address utilisation; these are
   * retained from the existing engine as ADDITIONAL protection, not as a
   * competing definition of the cashflow verdicts.
   */
  blockedUtilizationRatio: PURCHASE_BLOCKED_UTILIZATION_RATIO,
  warningUtilizationRatio: PURCHASE_WARNING_UTILIZATION_RATIO,
} as const;

export type PurchaseGateRules = typeof PURCHASE_GATE_RULES;

/**
 * True when an obligation's billing day is not known.
 *
 * `mapImportedInstallmentsToObligations` deliberately emits `dayOfMonth = 0`
 * when the billing card is missing or its `billingDayOfMonth` is invalid,
 * rather than inventing a day (LOCK-007). Zero is therefore a sentinel for
 * UNKNOWN, not a real calendar day.
 */
export function hasUnknownBillingDay(obligation: Obligation): boolean {
  return (
    !Number.isInteger(obligation.dayOfMonth) ||
    obligation.dayOfMonth < 1 ||
    obligation.dayOfMonth > 31
  );
}

/**
 * Obligations still ahead in the current billing month.
 *
 * §7.4: "an obligation counts against the current month when its due date
 * falls within the current billing month."
 *
 * `Obligation` carries `dayOfMonth` (1-31), not a date — obligations recur
 * monthly. So the meaningful reading is: an obligation whose day has already
 * passed has already left the account and is therefore already reflected in
 * `currentBalance`; counting it again would double-charge the user's buffer.
 * Only obligations from today onward are still to come. See DR-002.
 *
 * UNKNOWN billing days FAIL CLOSED and are counted. The plain comparison
 * `dayOfMonth >= todayDayOfMonth` silently dropped them, because the UNKNOWN
 * sentinel is 0 and `0 >= 1` is false — so a commitment the app could not date
 * vanished from the projection, made the balance look healthier than it was,
 * and could approve a purchase the user cannot afford. An undated obligation
 * is money that may still leave the account; it is counted. See DR-007.
 */
export function remainingObligationsThisMonth(
  obligations: readonly Obligation[],
  todayDayOfMonth: number,
): number {
  return obligations
    .filter(
      (obligation) =>
        hasUnknownBillingDay(obligation) ||
        obligation.dayOfMonth >= todayDayOfMonth,
    )
    .reduce((total, obligation) => total + obligation.amount, 0);
}

/**
 * Balance projected after this purchase AND after every obligation still due
 * this month. §7.4's `blocked` rule tests this against zero.
 *
 * `Obligation.amount` is already a per-month figure —
 * `mapImportedInstallmentsToObligations` maps an imported plan to
 * `installment.monthlyPayment`, not its total — which satisfies §7.4's
 * "installments count at their per-month amount, not their total".
 */
export function projectedBalanceAfterPurchase(
  remainingBalance: number,
  purchaseAmount: number,
  obligationsStillDue: number,
): number {
  return remainingBalance - purchaseAmount - obligationsStillDue;
}

export type CashflowVerdict = 'blocked' | 'warning' | 'wait_24h' | 'approved';

export interface CashflowVerdictInput {
  readonly remainingBalance: number;
  readonly monthlyIncome: number;
  readonly purchaseAmount: number;
  readonly isEssential: boolean;
  readonly obligations: readonly Obligation[];
  readonly todayDayOfMonth: number;
}

export interface CashflowVerdictResult {
  readonly verdict: CashflowVerdict;
  /** Machine-readable rule that fired, for the UI and for tests. */
  readonly rule:
    | 'PROJECTED_BALANCE_NEGATIVE'
    | 'BUFFER_BELOW_THRESHOLD'
    | 'LARGE_NON_ESSENTIAL_PURCHASE'
    | 'WITHIN_THRESHOLDS';
  readonly projectedBalance: number;
  readonly obligationsStillDue: number;
  readonly bufferRatio: number;
  readonly purchaseRatioOfIncome: number;
}

/**
 * §7.4 cashflow verdict.
 *
 * Rules are evaluated in the order §7.4 lists them — blocked, warning,
 * wait_24h, approved — rather than an order of my choosing. See DR-003.
 */
export function evaluateCashflowVerdict(
  input: CashflowVerdictInput,
  rules: PurchaseGateRules = PURCHASE_GATE_RULES,
): CashflowVerdictResult {
  const obligationsStillDue = remainingObligationsThisMonth(
    input.obligations,
    input.todayDayOfMonth,
  );
  const projectedBalance = projectedBalanceAfterPurchase(
    input.remainingBalance,
    input.purchaseAmount,
    obligationsStillDue,
  );
  const postPurchaseBuffer = input.remainingBalance - input.purchaseAmount;
  const bufferRatio = postPurchaseBuffer / input.monthlyIncome;
  const purchaseRatioOfIncome = input.purchaseAmount / input.monthlyIncome;

  const shape = {
    projectedBalance,
    obligationsStillDue,
    bufferRatio,
    purchaseRatioOfIncome,
  };

  if (projectedBalance < 0) {
    return { verdict: 'blocked', rule: 'PROJECTED_BALANCE_NEGATIVE', ...shape };
  }
  if (bufferRatio < rules.warningBufferRatioOfIncome) {
    return { verdict: 'warning', rule: 'BUFFER_BELOW_THRESHOLD', ...shape };
  }
  if (
    !input.isEssential &&
    purchaseRatioOfIncome >= rules.wait24hPurchaseRatioOfIncome
  ) {
    return {
      verdict: 'wait_24h',
      rule: 'LARGE_NON_ESSENTIAL_PURCHASE',
      ...shape,
    };
  }
  return { verdict: 'approved', rule: 'WITHIN_THRESHOLDS', ...shape };
}
