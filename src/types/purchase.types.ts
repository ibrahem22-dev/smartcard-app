// /src/types/purchase.types.ts

export enum Currency {
  ILS = 'ILS',
  USD = 'USD',
  EUR = 'EUR',
}

export enum PurchaseCategory {
  Groceries = 'groceries',
  Dining = 'dining',
  Fuel = 'fuel',
  Transport = 'transport',
  Travel = 'travel',
  Subscriptions = 'subscriptions',
  Education = 'education',
  Health = 'health',
  Entertainment = 'entertainment',
  Shopping = 'shopping',
  Utilities = 'utilities',
  Other = 'other',
}

/** תשלומים — a purchase split into fixed monthly payments on a single card. */
export interface InstallmentPlan {
  /** Number of monthly payments. Always >= 2 for a real installment plan. */
  readonly numMonths: number;
  /** ₪ charged each month. amount / numMonths, but stored explicitly because
   *  Israeli issuers sometimes round the first/last payment differently. */
  readonly monthlyPayment: number;
  /** ISO 8601 date (yyyy-mm-dd) of the first monthly charge. */
  readonly firstChargeDate: string;
}

interface BasePurchase {
  readonly purchaseId: string;
  /** Total price in `currency` (full amount, NOT the monthly installment). */
  readonly amount: number;
  readonly currency: Currency;
  readonly category: PurchaseCategory;
  /** ISO 8601 date (yyyy-mm-dd) the purchase was made. */
  readonly date: string;
  /** References CardInput.cardId — which card was used. */
  readonly cardId: string;
  readonly merchantName: string;
  /** Drives purchaseGate `wait_24h` logic (non-essential + tight buffer). */
  readonly isEssential: boolean;
}

/** A standard single-charge purchase (no תשלומים). */
export interface OneTimePurchase extends BasePurchase {
  readonly isInstallment: false;
  readonly installmentPlan: null;
}

/** A תשלומים purchase — installmentPlan is guaranteed present. */
export interface InstallmentPurchase extends BasePurchase {
  readonly isInstallment: true;
  readonly installmentPlan: InstallmentPlan;
}

/**
 * Discriminated on `isInstallment`. When true, TypeScript narrows
 * `installmentPlan` to a non-null InstallmentPlan, so purchaseGate can read the
 * monthly payment directly with no null check and no `!` assertion.
 */
export type Purchase = OneTimePurchase | InstallmentPurchase;