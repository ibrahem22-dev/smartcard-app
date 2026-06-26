// /src/types/cashflow.types.ts

import type { CardInput } from './card.types';
import type { Currency, PurchaseCategory } from './purchase.types';

/** Risk band derived from a 0-100 score. */
export enum RiskLevel {
  Safe = 'safe',         // 0-24
  Caution = 'caution',   // 25-49
  Elevated = 'elevated', // 50-74
  Critical = 'critical', // 75-100
}

/** Kind of certain future outflow. */
export enum ObligationType {
  StandingOrder = 'standing_order', // הוראת קבע: rent, loans, insurance, tuition
  InstallmentCharge = 'installment_charge', // תשלומים monthly charge
  CardBilling = 'card_billing',     // full credit-card statement charge (חיוב)
}

/**
 * A certain future outflow used in cashflow projection.
 * הוראת קבע and card billing charges both reduce the projected balance.
 */
export interface Obligation {
  readonly obligationId: string;
  readonly type: ObligationType;
  readonly amount: number; // ₪
  /** Day of month (1-31) the outflow occurs. */
  readonly dayOfMonth: number;
  readonly description: string;
  readonly category: PurchaseCategory;
  /** Card this obligation bills to, when applicable. References CardInput.cardId. */
  readonly cardId: string | null;
}

/** Projected balance on a single calendar day — powers the Cashflow Calendar. */
export interface DayBalance {
  /** ISO 8601 (yyyy-mm-dd). */
  readonly date: string;
  /** Day of month (1-31), denormalized for fast calendar rendering. */
  readonly dayOfMonth: number;
  /** Projected end-of-day bank balance (₪). May be negative (מינוס). */
  readonly projectedBalance: number;
  /** Sum of obligations charged this day (₪). */
  readonly outflow: number;
  /** Income credited this day (₪). */
  readonly inflow: number;
  /** projectedBalance < 0 → in מינוס. */
  readonly isOverdraft: boolean;
  /** projectedBalance < dangerThreshold → flag danger zone. */
  readonly belowDanger: boolean;
}

/**
 * Full pre-loaded month snapshot. Built from MMKV data by the caller and passed
 * to cashflowRadar — the engine never fetches. Self-contained: monthly income,
 * recurring expenses, balances and the danger threshold all live here.
 */
export interface MonthInput {
  readonly year: number;
  /** 1-12. */
  readonly month: number;
  readonly currency: Currency;

  /** Bank balance at the first day of the month (₪). */
  readonly openingBalance: number;
  /** Net monthly income (₪). */
  readonly monthlyIncome: number;
  /** Day of month (1-31) income is credited. */
  readonly incomeDayOfMonth: number;

  /** All certain recurring outflows: הוראת קבע, installments, card billings. */
  readonly obligations: readonly Obligation[];

  /**
   * Balance floor below which a day is flagged dangerous. 0 captures pure מינוס;
   * a positive value enforces a safety buffer above zero.
   */
  readonly dangerThreshold: number;
}

/** Output of cashflowRadar.calculateMonthlyRisk. */
export interface RiskScore {
  /** 0 (safe) … 100 (critical). */
  readonly score: number;
  readonly level: RiskLevel;
  /** Lowest projected balance across the month (₪). */
  readonly lowestProjectedBalance: number;
  /** Date (yyyy-mm-dd) of the lowest projected balance. */
  readonly lowestBalanceDate: string;
  /** True if any day projects below 0 (מינוס somewhere in the month). */
  readonly hasOverdraftRisk: boolean;
  /** Number of days the projection sits below dangerThreshold. */
  readonly daysBelowDanger: number;
  readonly reason: string;    // Hebrew
  readonly reasonAr: string;  // Arabic
}

/** Output of cashflowRadar.predictChargeReturn (חזרת חיוב). */
export interface ChargeReturnRisk {
  /** True when balance is predicted insufficient for an upcoming charge. */
  readonly atRisk: boolean;
  /** References CardInput.cardId of the card whose charge would bounce, if any. */
  readonly cardId: string | null;
  /** The charge amount that would bounce (₪). */
  readonly chargeAmount: number;
  /** Projected balance available on the billing date (₪). */
  readonly projectedBalanceOnDate: number;
  /** Shortfall = chargeAmount - projectedBalanceOnDate, when atRisk (₪). */
  readonly shortfall: number;
  /** ISO 8601 (yyyy-mm-dd) of the billing date checked. */
  readonly billingDate: string;
  readonly reason: string;    // Hebrew
  readonly reasonAr: string;  // Arabic
}

/** Row consumed by CalendarScreen for the flat upcoming-charge view. */
export interface CashflowCalendarCharge {
  readonly date: string;
  readonly cardName: string;
  readonly amount: number;
  readonly riskLevel: number;
}

/** Snapshot consumed by purchaseGate.evaluatePurchase. */
export interface CashflowSnapshot {
  /** ISO 8601 timestamp/date when this snapshot was produced. */
  readonly snapshotDate: string;
  /** Projected balance remaining after known cashflow obligations (₪). */
  readonly remainingBalance: number;
  /** ISO 8601 timestamp/date of the previous purchase. null when unknown. */
  readonly lastPurchaseDate: string | null;
  /** Cards available to the decision engine for metadata such as FX fee. */
  readonly availableCards: readonly CardInput[];
}
