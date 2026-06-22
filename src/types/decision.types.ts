// /src/types/decision.types.ts

import type { CardIssuer } from './card.types';
import type { Currency } from './purchase.types';

/** Final purchase verdict rendered by DecisionScreen. */
export enum DecisionVerdict {
  Approve = 'approve',
  Warn = 'warn',
  Block = 'block',
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
 * Every field maps to something the UI displays — no engine-internal fields.
 */
export interface PurchaseDecision {
  readonly verdict: DecisionVerdict;

  /** Reasoning shown to the user, one field per language. */
  readonly reasonHe: string; // Hebrew
  readonly reasonAr: string; // Arabic

  /**
   * Card the engine recommends paying with. null when no better card applies
   * (e.g. a blocked verdict where recommending a card is meaningless).
   */
  readonly recommendedCard: RecommendedCard | null;

  /**
   * ₪ the user saves by following the recommendation vs. their default card.
   * 0 when there is no saving to surface.
   */
  readonly savingsAmount: number;
  readonly currency: Currency;
}

// ── الـ imports المُصحَّحة ──────────────────────────────────────────
// UserCard      -> CardInput   (aliased to keep usage sites untouched)
// PurchaseInput -> Purchase    (aliased likewise)
// CardRecommendation: لا يوجد نوع مقابل — تم توجيه alternatives للنوع المحلي RecommendedCard (الخيار A)
import type { CardInput as UserCard } from './card.types';
import type { Purchase as PurchaseInput } from './purchase.types';
import type { Benefit } from './benefit.types';

export interface DecisionContext {
  readonly purchaseInput: PurchaseInput;
  readonly availableCards: readonly UserCard[];
  readonly activeBenefits: readonly Benefit[];
}

export interface DecisionSummary {
  readonly primary: PurchaseDecision;
  readonly alternatives: readonly RecommendedCard[]; // ⚠️ كان CardRecommendation (غير موجود) — راجع الخيار B
  readonly context: DecisionContext;
  readonly timestamp: number;
}