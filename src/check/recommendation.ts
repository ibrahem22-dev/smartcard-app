/**
 * THE VERDICT'S RECOMMENDATION, COMPOSED — Owner ruling OQ-P5-002, 2026-08-29.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THREE OWNERS, AND THIS FILE CROSSES NONE OF THEM
 *
 * The ruling fixes the semantic separation in as many words:
 *
 *   > *"purchase verdict / affordability state owns BUY / WAIT / DON'T-BUY; card scoring owns
 *   > best-card recommendation, runner-up and reasons; installment/payment logic owns
 *   > payment-method advisory."*
 *
 * So this file **reads** a `PurchaseVerdict` and **reads** a `ScoringResult` and composes what the
 * screen is handed. It does not compute a verdict, it does not rank, it does not re-score, it does
 * not break a tie, and it says nothing about payment method. `ranked[0]` and `ranked[1]` are taken
 * as the engine published them, because *"the sorted array, not this figure, is the authoritative
 * rank."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE USER'S CHOSEN CARD IS NOT AN INPUT TO THE RANKING, AND THAT IS THE POINT
 *
 * `CheckInputDraft.cardId` is either a card the user picked or `null`, meaning *let the app choose*
 * — the **המליצי בשבילי** button. Either way the recommendation is the engine's best available
 * card: a ranking that changed with the user's selection would be **a second ranking path**, which
 * is precisely A1's declared negative control. The chosen card decides which card the impact strip
 * is computed against; it decides nothing about who is best.
 *
 * The tests the ruling requires distinguish the two cases and assert exactly that invariant.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A DON'T-BUY IS NOT OVERRULED BY A CARD CHIP
 *
 *   > *"For a DON'T-BUY result, do not allow the card recommendation to visually override the
 *   > purchase decision. If a card recommendation is shown, it must be explicitly subordinate,
 *   > equivalent in meaning to: If you proceed anyway, this is the lowest-cost/best available
 *   > card."*
 *
 * WHICH VERDICTS SUBORDINATE IS DECIDED HERE, not on the screen. A surface that inspected
 * `result.verdict` to decide how loudly to render a recommendation would be holding a piece of
 * recommendation logic, which criterion B1 forbids — and it would be a second place the rule lives,
 * so the two could disagree. The screen receives `emphasis` and renders it.
 *
 * Only `dont_buy_now` subordinates. `wait_until_billing_passes` says *buy after the billing event*,
 * which the recommendation does not contradict, and the ruling names DON'T-BUY specifically.
 */
import type { ProvenancedNumber } from '../engines/provenance';
import type { ReasonTrace } from '../engines/reasonTrace';
import type { ScoringResult } from '../engines/scoring';
import type { PurchaseVerdict } from '../engines/verdict';
import type { EngineCard } from '../types/card.types';

/**
 * How loudly the recommendation may be rendered.
 *
 * `subordinate` is not a styling hint the screen may ignore — it is the difference between the
 * product saying "buy this card" and the product saying "do not buy this, and if you do anyway,
 * this one costs least".
 */
export type RecommendationEmphasis = 'primary' | 'subordinate';

export interface VerdictRecommendation {
  readonly cardId: string;
  readonly displayName: string;
  /** The engine's relative 0–100 score, unchanged. */
  readonly matchScore: ProvenancedNumber;
  readonly emphasis: RecommendationEmphasis;
  /** The scoring engine's own account of why this card ranked where it did. Never re-worded here. */
  readonly reasons: ReasonTrace;
}

export interface VerdictRunnerUp {
  readonly cardId: string;
  readonly displayName: string;
  /** Omitted when the engine suppressed deltas — an absent claim is honest, an invented one is not. */
  readonly deltaFromBestIls?: ProvenancedNumber;
}

export interface ComposedRecommendation {
  readonly recommendation?: VerdictRecommendation;
  readonly runnerUp?: VerdictRunnerUp;
}

/**
 * Compose what the Verdict screen is handed, from one scoring result and one verdict.
 *
 * Returns an EMPTY object rather than a placeholder when the engine ranked nothing — no cards, no
 * resolvable costs, or every card unavailable. The screen's own comment already says an absent
 * recommendation means the block is omitted rather than invented, and that stays true: what changes
 * is that the absence is now the engine's answer instead of the loop's silence.
 */
export const composeRecommendation = (
  scoring: ScoringResult | null,
  cards: readonly EngineCard[],
  verdict: PurchaseVerdict,
): ComposedRecommendation => {
  const best = scoring?.ranked[0];
  if (best === undefined) return {};

  const nameOf = (cardId: string): string =>
    cards.find((c) => c.cardId === cardId)?.displayName ?? cardId;

  const recommendation: VerdictRecommendation = {
    cardId: best.cardId,
    displayName: nameOf(best.cardId),
    matchScore: best.score,
    emphasis: verdict === 'dont_buy_now' ? 'subordinate' : 'primary',
    reasons: best.trace,
  };

  const second = scoring?.ranked[1];
  if (second === undefined) return { recommendation };

  return {
    recommendation,
    runnerUp: {
      cardId: second.cardId,
      displayName: nameOf(second.cardId),
      ...(second.deltaFromBestIls !== undefined
        ? { deltaFromBestIls: second.deltaFromBestIls }
        : {}),
    },
  };
};
