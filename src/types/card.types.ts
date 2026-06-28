// /src/types/card.types.ts

import type { Currency, PurchaseCategory } from './purchase.types';

/**
 * The only three credit-card issuers operating in Israel.
 * Isracard also issues Amex; CAL issues Visa + Diners.
 */
export enum CardIssuer {
  Max = 'max',
  Isracard = 'isracard',
  Cal = 'cal',
}

export enum CardNetwork {
  Visa = 'visa',
  Mastercard = 'mastercard',
  Amex = 'amex',
  Diners = 'diners',
}

/** The single primary classification cardRoleEngine assigns to a card. */
export enum CardRole {
  Daily = 'daily',
  Travel = 'travel',
  Subscriptions = 'subscriptions',
  Installments = 'installments',
  Education = 'education',
  Benefits = 'benefits',
}

/**
 * Israeli billing model: the bank account is debited (חיוב) on a fixed day each
 * month, which can differ PER CARD. The statement cycle closes a few days before
 * that. Both are day-of-month values (1-31).
 */
export interface CardBillingCycle {
  readonly statementClosingDay: number;
  readonly billingDayOfMonth: number;
}

/** מסגרת אשראי — framework limit and current usage. availableCredit is derived
 *  by the engines (creditLimit - currentBalance) and intentionally NOT stored,
 *  to avoid a second source of truth. */
export interface CardCreditFramework {
  readonly creditLimit: number;    // total framework (₪)
  readonly currentBalance: number; // amount already charged this cycle (₪)
}

/** Financial rates and fees associated with a card. */
export interface CardRates {
  readonly creditInterestRate: number;
  readonly installmentInterestRate: number;
  readonly cardLoanInterestRate: number;
  readonly foreignExchangeCommission: number;
  readonly monthlyFee: number;
  readonly source: string;
  /** ISO 8601 date. */
  readonly lastUpdated: string;
}

/** Current card-fee discount details. */
export interface CardFeeInfo {
  readonly originalFee: number;
  readonly discountPercent: number;
  readonly effectiveFee: number;
  /** ISO 8601 date. */
  readonly discountEndDate?: string;
  readonly discountSource?: string;
}

export interface CardInput {
  readonly cardId: string;
  readonly displayName: string;
  readonly last4: string;
  readonly issuer: CardIssuer;
  readonly network: CardNetwork;
  readonly currency: Currency;
  readonly framework: CardCreditFramework;
  readonly billingCycle: CardBillingCycle;

  /** Roles this card is *capable* of filling (capability tags). May be empty. */
  readonly roleTags: readonly CardRole[];
  /** The single role assigned by cardRoleEngine. null until assigned. */
  readonly primaryRole: CardRole | null;

  /** Categories where this card yields elevated rewards — drives both role
   *  assignment and recommendCard ranking. */
  readonly rewardCategories: readonly PurchaseCategory[];
  /** Baseline reward as a fraction (e.g. 0.02 = 2%). */
  readonly cashbackRate: number;
  /** FX fee as a fraction (e.g. 0.03 = 3%); low value favors the travel role. */
  readonly foreignTransactionFee: number;
  /** Whether this card can split charges into תשלומים. */
  readonly supportsInstallments: boolean;
  readonly annualFee: number; // ₪
  readonly isActive: boolean;

  /** Issuer/bank association used for the +5 bank-match bonus in recommendCard. */
  readonly bankName?: string;
  /** True when the user could not identify their מועדון at onboarding. */
  readonly unknownClub?: boolean;
  readonly cardRates?: CardRates;
  readonly cardFee?: CardFeeInfo;
  readonly hasForeignCurrencyAccount?: boolean;
  readonly foreignCurrencyType?: string;
  /** Bank foreign-exchange commission as a percentage. */
  readonly bankFxCommission?: number;
  /** ISO 8601 date. */
  readonly cardIssuanceDate?: string;
}

/** Ranked card pick returned by cardRoleEngine.recommendCard. */
export interface CardRecommendation {
  readonly card: CardInput;
  /** 0–100 suitability score for the purchase context. */
  readonly score: number;
  readonly scoreReason: string;
  readonly scoreReasonAr: string;
}
