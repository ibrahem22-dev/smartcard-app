/**
 * CRITERION A1 — ONE SCORING.
 *
 *   > **A1.** *"Wallet's Best-For chips, Card DNA §C's chips and the recommendation Check would
 *   > produce for the same context are the same scoring call, measured in one run over generated
 *   > contexts."*
 *
 * Roadmap §10's P5 DoD says it in as many words: *"Best-For chips provably match what Check would
 * recommend in the same context."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE RANKING, NOT THE LABELS — the way this property is most often written wrong
 *
 * `P5_VALIDATION_PLAN.md` §3.2: *"comparing chip LABELS rather than the ranking that produced them
 * — two surfaces can print the same words from different orderings."* Two cards whose chips both
 * read "Lowest EUR cost" are not evidence of one ranking; they are evidence of one vocabulary. So
 * this property compares the ORDER of card ids each surface painted, against
 * `scoring.ranked.map(c => c.cardId)`, which is the engine's own authoritative sequence — *"the
 * sorted array, not this figure, is the authoritative rank."*
 *
 * RED AT PHASE-1. Card DNA §C arrives in PHASE-3 and Wallet's chips in PHASE-4. The Check-side
 * participant needs a scoring context that prices something, which `SurfaceContext.scoringCosts`
 * carries and nothing supplies until PHASE-4 either — so the engine honestly reports every card in
 * `unknownCostCards` and ranks none, and this property fails naming all three rather than agreeing
 * over an empty ranking.
 */
import { derivedContexts } from './derivedPopulation';
import { evaluateSurfaceEngines } from '../surfaceEngines';
import { REQUIRED_PARTICIPANTS, notBuiltYet } from './agreementParticipants';
import {
  NOT_BUILT,
  readCardDnaWhenBestChips,
  readCheckRecommendation,
  readWalletBestForChips,
  type PaintedRanking,
} from './agreementReaders';
import type { SurfaceContext } from '../surfaceContext';

const assertAllEqual = (
  expected: readonly string[],
  actuals: readonly { readonly who: string; readonly painted: PaintedRanking }[],
  where: string,
): readonly string[] => {
  const problems: string[] = [];
  for (const a of actuals) {
    if (a.painted === NOT_BUILT) { problems.push(`${where}: ${a.who} painted nothing`); continue; }
    if (a.painted.join('>') !== expected.join('>')) {
      problems.push(`${where}: ${a.who} painted [${a.painted.join(', ')}], the scoring engine ranked [${expected.join(', ')}]`);
    }
  }
  return problems;
};

/** A context that prices something, so there is a ranking to agree about at all. */
const priced = (ctx: SurfaceContext): SurfaceContext => {
  const costs: Record<string, number> = {};
  ctx.cards.forEach((c, i) => { costs[c.cardId] = (i + 1) * 11; });
  return { ...ctx, scoringCosts: costs };
};

describe('A1 — one scoring', () => {
  it('every participant the criterion names has a reader', () => {
    const missing = REQUIRED_PARTICIPANTS['one-scoring'].filter((p) => {
      const ctx = derivedContexts()[0]?.context as SurfaceContext;
      if (p.id === 'wallet-best-for-chips') return readWalletBestForChips(ctx) === NOT_BUILT;
      if (p.id === 'card-dna-when-best') return readCardDnaWhenBestChips(ctx) === NOT_BUILT;
      if (p.id === 'check-recommendation') return readCheckRecommendation(ctx) === NOT_BUILT;
      return false;
    });
    expect(missing.map((p) => notBuiltYet('one-scoring', p))).toEqual([]);
  });

  it('Wallet, Card DNA §C and Check paint one ranking, in the engine’s order, over the derived population', () => {
    const problems: string[] = [];
    let checked = 0;

    for (const { label, context } of derivedContexts()) {
      const ctx = priced(context);
      const engine = evaluateSurfaceEngines(ctx);
      if (engine.scoring === null) continue;
      if (engine.scoring.ranked.length === 0) continue; /* nothing priced; not a case for this claim */

      const ranking = engine.scoring.ranked.map((c) => c.cardId);
      const wallet = readWalletBestForChips(ctx);
      const cardDna = readCardDnaWhenBestChips(ctx);
      const verdict = readCheckRecommendation(ctx);

      problems.push(...assertAllEqual(ranking, [
        { who: "Wallet's Best-For chips", painted: wallet },
        { who: "Card DNA §C's chips", painted: cardDna },
        { who: "the recommendation Check would produce", painted: verdict },
      ], label));
      checked += 1;
    }

    expect(checked).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it('a card the engine could not price is never painted as a winner', () => {
    /* `unknownCostCards` is the engine's honesty lane — *"an absent cost is never a zero and never
       a ranking position"*. A surface that showed one as best would be inventing a recommendation,
       which is the direction B1 forbids and this property is the runtime half of. */
    const problems: string[] = [];
    for (const { label, context } of derivedContexts()) {
      const engine = evaluateSurfaceEngines(context);
      if (engine.scoring === null) continue;
      const unknown = engine.scoring.unknownCostCards;
      if (unknown.length === 0) continue;
      const wallet = readWalletBestForChips(context);
      const cardDna = readCardDnaWhenBestChips(context);
      if (wallet === NOT_BUILT && cardDna === NOT_BUILT) {
        problems.push(`${label}: neither Wallet nor Card DNA §C paints chips yet, so "${unknown.length} unpriced card(s) are not shown as winners" is compared with nothing`);
        continue;
      }
      problems.push(...assertAllEqual([], [
        { who: "Wallet's chips over unpriced cards", painted: wallet === NOT_BUILT ? NOT_BUILT : wallet.filter((id) => unknown.includes(id)) },
        { who: "Card DNA §C's chips over unpriced cards", painted: cardDna === NOT_BUILT ? NOT_BUILT : cardDna.filter((id) => unknown.includes(id)) },
      ], label));
    }
    expect(problems).toEqual([]);
  });
});
