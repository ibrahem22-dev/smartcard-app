// /src/types/installment.types.ts

import type { Currency, PurchaseCategory } from './purchase.types';

/** Warning severity emitted by installmentGate, keyed to the load thresholds. */
export enum InstallmentWarningLevel {
  None = 'none',         // < 25% income
  Warning = 'warning',   // 25-35%
  Strong = 'strong',     // 35-50%
  Blocked = 'blocked',   // > 50%
}

/**
 * A live תשלומים plan being tracked across months.
 * `purchaseId` references Purchase.purchaseId (BasePurchase) — same field name,
 * no new convention.
 */
export interface Installment {
  readonly installmentId: string;
  /** Back-reference to the originating purchase. Matches Purchase.purchaseId. */
  readonly purchaseId: string;
  /** Card the monthly charge bills to. References CardInput.cardId. */
  readonly billingCardId: string;

  /** Full price of the תשלומים purchase (₪ in `currency`). */
  readonly totalAmount: number;
  readonly currency: Currency;
  readonly category: PurchaseCategory;

  /** Total number of monthly payments in the plan (>= 2). */
  readonly numPayments: number;
  /** ₪ charged each month. */
  readonly monthlyPayment: number;
  /** How many payments are still outstanding (0..numPayments). */
  readonly paymentsRemaining: number;

  /** Day of month (1-31) the charge bills. Israeli billing day is per-card. */
  readonly billingDayOfMonth: number;
  /** ISO 8601 (yyyy-mm-dd) of the next scheduled charge. */
  readonly nextChargeDate: string;
}

/** A proposed new תשלומים plan evaluated by installmentGate before commitment. */
export interface InstallmentRequest {
  readonly purchaseId: string;
  readonly billingCardId: string;
  readonly totalAmount: number;
  readonly currency: Currency;
  readonly category: PurchaseCategory;
  readonly numPayments: number;
  /** Day of month (1-31) the new plan would bill on. */
  readonly billingDayOfMonth: number;
}

/** Per-month cashflow impact line returned by installmentGate. */
export interface MonthlyImpact {
  /** 1-based offset from now: 1 = next month, 2, 3... */
  readonly monthOffset: number;
  /** Total installment load that month if the request is approved (₪). */
  readonly projectedMonthlyLoad: number;
  /** Load as a fraction of monthly income (e.g. 0.32 = 32%). */
  readonly loadRatio: number;
}

/** Output of installmentGate.evaluateInstallment. */
export interface InstallmentDecision {
  readonly approved: boolean;
  readonly warningLevel: InstallmentWarningLevel;
  /** ₪ this request adds to each month's load. */
  readonly monthlyAddition: number;
  /** totalAmount of the request (full cost over the plan). */
  readonly totalCost: number;
  /** New combined load ratio after this request (fraction of income). */
  readonly resultingLoadRatio: number;
  /** Next-3-month projected impact, always length 3. */
  readonly threeMonthImpact: readonly MonthlyImpact[];
  readonly reason: string;    // Hebrew
  readonly reasonAr: string;  // Arabic
}