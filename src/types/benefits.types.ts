import type { CardInput } from './card.types';
import type { PurchaseInput } from './purchase.types';

export type BenefitType = 'cashback' | 'discount';

export interface Benefit {
  readonly category: string;
  readonly type: BenefitType;
  /** Percentage of the purchase amount saved. */
  readonly value: number;
  readonly isInternationalOnly: boolean;
  readonly description: string;
}

export interface BenefitsClub {
  readonly benefits: readonly Benefit[];
}

export interface BenefitsIssuer {
  readonly clubs: Readonly<Record<string, BenefitsClub>>;
}

export interface BenefitsDB {
  readonly issuers: Readonly<Record<string, BenefitsIssuer>>;
}

export interface BenefitMatch {
  readonly card: CardInput;
  readonly benefit: Benefit;
  readonly estimatedSaving: number;
}

/** A completed purchase; cardId identifies the card that was actually used. */
export type Transaction = PurchaseInput;

export interface MissedSavingRow {
  readonly transaction: Transaction;
  readonly bestCard: CardInput;
  readonly missedAmount: number;
}

export interface MissedSavings {
  readonly totalMissed: number;
  readonly breakdown: readonly MissedSavingRow[];
}
