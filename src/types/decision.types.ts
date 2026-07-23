// /src/types/decision.types.ts

import type { CardInput as UserCard, CardIssuer } from './card.types';
import type { Obligation } from './cashflow.types';
import type { Currency } from './purchase.types';

/** Final purchase verdict rendered by DecisionScreen. */
export type DecisionVerdict =
  | 'approved'
  | 'warning'
  | 'blocked'
  | 'wait_24h';

export type PurchaseDecisionReasonCode =
  | 'INVALID_AMOUNT'
  | 'INVALID_CASHFLOW_SNAPSHOT'
  | 'INVALID_INCOME';

export interface PurchaseGateInput {
  /** ISO 8601 timestamp/date when this snapshot was produced. */
  readonly snapshotDate: string;
  /** Current bank balance before this purchase and before upcoming card charge. */
  readonly currentBalance: number;
  /** Projected balance available for discretionary spending. */
  readonly remainingBalance: number;
  /** Net monthly income used for buffer percentage thresholds. */
  readonly monthlyIncome: number;
  /** Certain outflows due this month, used for charge-return risk. */
  readonly obligations: readonly Obligation[];
  /** ISO 8601 timestamp/date of the previous purchase. null when unknown. */
  readonly lastPurchaseDate: string | null;
  /** Cards available to the decision engine for metadata such as FX fee. */
  readonly availableCards: readonly UserCard[];
}

/** One row of the international FX-commission comparison (FX-RECOMMEND-01). */
export interface FxComparisonRow {
  readonly cardId: string;
  readonly displayName: string;
  /** Effective FX commission as a percentage (0 for a matched foreign-currency account). */
  readonly commission: number;
}

export interface UsePurchaseGateResult {
  readonly amount: number;
  readonly setAmount: (amount: number) => void;
  readonly isInternational: boolean;
  readonly setIsInternational: (isInternational: boolean) => void;
  readonly verdict: DecisionVerdict | null;
  readonly decision: PurchaseDecision | null;
  readonly exchangeFeeWarning: string | null;
  /**
   * FX-commission comparison for an international purchase. Empty unless
   * isInternational is true AND two or more cards have cardRates defined.
   */
  readonly fxComparison: readonly FxComparisonRow[];
  readonly evaluate: () => DecisionVerdict;
}

/**
 * The card the engine recommends for this purchase. Carries the minimum the
 * screen needs to render a card chip without a second lookup.
 */
export interface RecommendedCard {
  /** References CardInput.cardId. */
  readonly cardId: string;
  readonly displayName: string;
  readonly last4: string;
  readonly issuer: CardIssuer;
}

/**
 * Output of a purchase decision, consumed directly by DecisionScreen (M3).
 * Every field maps to something the UI displays; no engine-internal fields.
 */
export interface PurchaseDecision {
  readonly verdict: DecisionVerdict;

  /** Reasoning shown to the user, one field per language. */
  readonly reason: string;
  readonly reasonAr: string;
  readonly exchangeFeeWarning?: string;

  /**
   * Card the engine recommends paying with. null when no better card applies
   * (e.g. a blocked verdict where recommending a card is meaningless).
   */
  readonly recommendedCard: RecommendedCard | null;

  /**
   * The user saves by following the recommendation vs. their default card.
   * 0 when there is no saving to surface.
   */
  readonly savingsAmount: number;
  readonly currency: Currency;
}
