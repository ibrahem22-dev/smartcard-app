/**
 * THE CANONICAL SCORING DERIVATION — one home for "which of this user's cards is best, and why".
 *
 * Written under Owner ruling **OQ-P5-002** (answered 2026-08-29): *"AUTHORISE REPAIR NOW — option 1.
 * A1 is NOT amended and NOT deferred … The implementation belongs at the canonical authority/engine
 * composition boundary, not in the presentation surface. The Verdict must receive the
 * recommendation, runner-up and reason trace from the same canonical scoring derivation used by the
 * other product surfaces."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT WAS WRONG
 *
 * `CheckVerdictScreen` accepts a `recommendation` prop, renders it correctly, and is tested doing
 * so — and no production path supplied one. `checkLoop.ts` never mentioned `recommendation`, never
 * called `scoreCards`, and never produced a runner-up; grepping the tree, the only callers that
 * passed a recommendation were test files. Meanwhile `CheckInputScreen` renders a button labelled
 * **המליצי בשבילי** — *Recommend for me* — which sets the chosen card to `null`, meaning *let the
 * app choose*, and led to a verdict with no recommendation block at all.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS RATHER THAN A `scoreCards` CALL INSIDE THE CHECK LOOP
 *
 * The assembly from vault cards onto `ScoringCard[]` already existed, privately, as
 * `scoringCardsFrom` inside `src/surfaces/surfaceEngines.ts`. Calling `scoreCards` a second time
 * from the Check lane with its own input assembly would have produced **a second ranking path** —
 * and A1's declared negative control is, in as many words, *"derive a Best-For chip from a second
 * ranking path and watch the property fail."* The defect this repair exists to fix would have been
 * re-created by the repair.
 *
 * So the assembly moved here and `surfaceEngines.ts` imports it. It is the same shape, and the same
 * reasoning, as `commitmentInput.ts` under OQ-P5-001 a few hours earlier.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS FILE MAPS AND CALLS ONE ENGINE. IT DOES NOT DECIDE.
 *
 * No ranking is computed here, no score is adjusted, no tie is broken. `scoreCards` owns all of
 * that and its result is returned unchanged.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AN ABSENT COST IS NOT A ZERO, AND NOTHING SUPPLIES COSTS YET.
 *
 * `ScoringCard.costIls` is optional by contract: absent means the cost could not be resolved, and
 * the engine reports that card in `unknownCostCards` rather than ranking it. **No production path
 * populates `scoringCosts`** — the FX/cost lane that would is not built — so in the shipped app the
 * ranking is honestly empty, Wallet's Best-For chips are empty, Card DNA §C shows its empty state,
 * and the Verdict now correctly shows no recommendation for the same reason rather than for a
 * different one. That agreement is what A1 measures; supplying a fabricated cost here to make a
 * chip appear would be the `?? 0` defect wearing a new costume.
 */
import { scoreCards, type ScoringCard, type ScoringResult } from '../engines/scoring';
import { provenanced } from '../engines/provenance';
import type { EngineCard } from '../types/card.types';

/** The vault facts a ranking is computed from. */
export interface ScoringSource {
  readonly cards: readonly EngineCard[];
  /**
   * Per-card cost in shekels, keyed by cardId, produced by the FX/cost lane. Omitted or missing for
   * a card means the cost is UNKNOWN, and the engine reports it rather than ranking it.
   */
  readonly scoringCosts?: Readonly<Record<string, number>>;
}

/**
 * THE MAPPER. Moved verbatim from `surfaceEngines.scoringCardsFrom` — the Wallet chips and Card DNA
 * §C must not move by one position, and A1 is the property that would catch it if they did.
 */
export const scoringCardsFromVault = (src: ScoringSource): readonly ScoringCard[] =>
  src.cards.map((c): ScoringCard => {
    const cost = src.scoringCosts?.[c.cardId];
    return {
      cardId: c.cardId,
      available: c.isActive,
      /* Absent when the context prices nothing yet. The engine then reports the card in
         unknownCostCards instead of ranking it, which is the honest lane and not a zero. */
      ...(typeof cost === 'number' && Number.isFinite(cost) ? { costIls: provenanced(cost, 'ESTIMATE') } : {}),
    };
  });

/**
 * THE ONE SCORING CALL. `null` when the vault holds no card — a ranking over zero cards is a
 * vacuous pass, not a result, and every consumer must be able to tell those apart.
 */
export const scoreFromVault = (src: ScoringSource): ScoringResult | null =>
  src.cards.length === 0 ? null : scoreCards({ cards: scoringCardsFromVault(src) });
