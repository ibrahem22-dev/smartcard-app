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

/**
 * WHY THERE IS NO RECOMMENDATION — the four different nothings, kept apart.
 *
 * Until this existed the Verdict simply omitted the block, and the four sentences below all
 * rendered as the same silence. They are not the same statement and only one of them is about the
 * user's wallet being short of something:
 *
 *   · `NO_CARDS`        — the vault holds no card, so there is nothing to rank;
 *   · `NO_AVAILABLE_CARD` — every card the user holds is inactive;
 *   · `NOT_PRICEABLE`   — the cards are ranked on cost and this purchase costs the same on all of
 *                          them. A true, useful sentence, and NOT a failure;
 *   · `COST_UNKNOWN`    — the engine could not resolve a cost for the available cards and reported
 *                          them in `unknownCostCards` rather than pricing them at zero.
 *
 * The screen renders the difference. Collapsing them would eventually let the app say "we could
 * not work it out" about a purchase where the honest answer is "it makes no difference".
 */
export type RecommendationAbsence =
  | 'NO_CARDS'
  | 'NO_AVAILABLE_CARD'
  | 'NOT_PRICEABLE'
  | 'COST_UNKNOWN';

/**
 * WHAT PRICED THE RANKING.
 *
 * Carried so the surface can say what the recommendation is ABOUT rather than presenting a bare
 * winner. `installment-interest` means "cheapest for this installment plan", which is a narrower
 * and more truthful claim than "best card".
 */
export type RecommendationBasis = 'installment-interest' | 'supplied-cost';

export interface ComposedRecommendation {
  readonly recommendation?: VerdictRecommendation;
  readonly runnerUp?: VerdictRunnerUp;
  /** Present exactly when `recommendation` is absent, and it says which kind of absent. */
  readonly absence?: RecommendationAbsence;
  /** Present exactly when `recommendation` is present. */
  readonly basis?: RecommendationBasis;
}

/**
 * Compose what the Verdict screen is handed, from one scoring result and one verdict.
 *
 * Returns NO RECOMMENDATION — and the reason for it — rather than a placeholder when the engine
 * ranked nothing: no cards, every card unavailable, nothing priceable, or costs it could not
 * resolve. The screen's own comment already says an absent recommendation means the block is
 * omitted rather than invented, and that stays true. What changed is that the absence is now the
 * engine's answer instead of the loop's silence, and that it is SAID rather than left as a gap.
 */
export const composeRecommendation = (
  scoring: ScoringResult | null,
  cards: readonly EngineCard[],
  verdict: PurchaseVerdict,
  basis?: RecommendationBasis,
): ComposedRecommendation => {
  const best = scoring?.ranked[0];
  if (best === undefined) return { absence: absenceFrom(scoring, cards, basis) };

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
  const priced: RecommendationBasis = basis ?? 'supplied-cost';
  if (second === undefined) return { recommendation, basis: priced };

  return {
    recommendation,
    basis: priced,
    runnerUp: {
      cardId: second.cardId,
      displayName: nameOf(second.cardId),
      ...(second.deltaFromBestIls !== undefined
        ? { deltaFromBestIls: second.deltaFromBestIls }
        : {}),
    },
  };
};

/**
 * WHICH NOTHING THIS IS, READ OFF THE ENGINE'S OWN REPORT — never guessed from the empty ranking.
 *
 * `scoreCards` already publishes `unavailableCards` and `unknownCostCards`, so the reason an empty
 * ranking is empty is a fact the engine stated rather than an inference this file makes. The order
 * matters: an unpriced available card is a more specific statement than "nothing is priceable",
 * and reporting the general case over the specific one would lose the reason.
 */
const absenceFrom = (
  scoring: ScoringResult | null,
  cards: readonly EngineCard[],
  basis: RecommendationBasis | undefined,
): RecommendationAbsence => {
  if (cards.length === 0 || scoring === null) return 'NO_CARDS';
  if (scoring.unavailableCards.length === cards.length) return 'NO_AVAILABLE_CARD';
  /* AN ABSENT BASIS IS NOT AN UNRESOLVED COST. When no lane priced this purchase, every available
     card reaches the engine unpriced and lands in `unknownCostCards` — which would read as "we
     could not work out what your cards cost" when the truth is that this purchase costs the same
     on all of them. The caller says whether it attempted a price; only then is an unpriced card a
     resolution failure. */
  if (basis === undefined) return 'NOT_PRICEABLE';
  return scoring.unknownCostCards.length > 0 ? 'COST_UNKNOWN' : 'NOT_PRICEABLE';
};
