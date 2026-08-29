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
  NO_POPULATION,
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
    if (a.painted === NO_POPULATION) continue;
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


/**
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE COMPARISON THIS PROPERTY MAKES, CORRECTED 2026-08-29 UNDER OWNER RULING OQ-P5-002
 *
 * It demanded every surface paint the engine's ENTIRE ranking. No surface does, and none should:
 * `bestForChipsFor` returns a chip only for `ranked[0]`, so a Best-For badge marks the best card
 * and not every card — painting "lowest cost" on all three would be false. The Verdict names two,
 * its recommendation and its runner-up. So the property was comparing [winner] against
 * [winner, second, third] and calling a correct surface wrong: the A4 mistake (D-035) one file over.
 *
 * The criterion never asked for that. Roadmap §10's P5 DoD is *"Best-For chips provably match what
 * Check would recommend in the same context"*, and spec §10 is *"they always match what Check would
 * recommend for that context"*. The claim is that the surfaces cannot DISAGREE about the ranking.
 *
 * So each surface's painted sequence must be a PREFIX of the engine's ranking — same cards, same
 * order, from the top, nothing the engine did not rank — checked against `scoring.ranked` rather
 * than against another surface, so two surfaces cannot be wrong together.
 *
 * IT IS NOT WEAKER, because three clauses are added that the old shape never reached:
 *   · every participant must name the SAME winner, which is the criterion's actual sentence;
 *   · Check must name `ranked[1]` as its runner-up, so the ORDER is genuinely exercised by at
 *     least one participant and a surface that only ever knew the winner cannot satisfy it;
 *   · a surface may paint no card the engine reported as unavailable or unpriced.
 */
const prefixProblems = (
  ranking: readonly string[],
  actuals: readonly { readonly who: string; readonly painted: PaintedRanking }[],
  where: string,
): readonly string[] => {
  const problems: string[] = [];
  for (const a of actuals) {
    if (a.painted === NO_POPULATION) continue;
    if (a.painted === NOT_BUILT) { problems.push(`${where}: ${a.who} painted nothing`); continue; }
    if (a.painted.length === 0) { problems.push(`${where}: ${a.who} painted an empty sequence over a non-empty ranking`); continue; }
    const head = ranking.slice(0, a.painted.length);
    if (a.painted.join('>') !== head.join('>')) {
      problems.push(`${where}: ${a.who} painted [${a.painted.join(', ')}], which is not the engine's ranking [${ranking.join(', ')}] read from the top`);
    }
  }
  return problems;
};

/** Which participants were compared at least once, so none can be silently absent. */
const exercised = new Set<string>();

describe('A1 — one scoring', () => {
  it('every participant the criterion names has a reader', () => {
    const missing = REQUIRED_PARTICIPANTS['one-scoring'].filter((p) => {
      /* PRICED. A context that prices nothing ranks nothing, so asking a reader for a ranking
         there is asking it to invent one, and every reader would report NOT_BUILT for being
         correct. */
      const ctx = priced(derivedContexts()[0]?.context as SurfaceContext);
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

      const participants: readonly { readonly who: string; readonly painted: PaintedRanking }[] = [
        { who: "Wallet's Best-For chips", painted: wallet },
        { who: "Card DNA §C's chips", painted: cardDna },
        { who: 'the recommendation Check would produce', painted: verdict },
      ];
      problems.push(...prefixProblems(ranking, participants, label));

      /* THE CRITERION'S OWN SENTENCE: the chips match what Check would recommend. */
      const best = ranking[0];
      for (const a of participants) {
        if (a.painted === NOT_BUILT || a.painted === NO_POPULATION) continue;
        if (a.painted[0] !== best) {
          problems.push(`${label}: ${a.who} names ${String(a.painted[0])} as best, the scoring engine ranks ${String(best)} first`);
        }
        exercised.add(a.who);
      }

      /* AND THE ORDER, not just the winner. Check names the runner-up, so a surface set that only
         ever agreed on first place cannot satisfy this clause. */
      if (ranking.length > 1 && verdict !== NO_POPULATION) {
        if (verdict === NOT_BUILT) {
          problems.push(`${label}: the engine ranked ${ranking.length} cards and Check named no runner-up, so nothing here tests the ORDER`);
        } else if (verdict.length < 2) {
          problems.push(`${label}: the engine ranked ${ranking.length} cards and Check named no runner-up, so nothing here tests the ORDER`);
        } else if (verdict[1] !== ranking[1]) {
          problems.push(`${label}: Check's runner-up is ${String(verdict[1])}, the scoring engine ranks ${String(ranking[1])} second`);
        }
      }

      /* No surface may name a card the engine refused to rank. */
      const unrankable = new Set([...engine.scoring.unknownCostCards, ...engine.scoring.unavailableCards]);
      for (const a of participants) {
        if (a.painted === NOT_BUILT || a.painted === NO_POPULATION) continue;
        const bad = a.painted.filter((id) => unrankable.has(id));
        if (bad.length > 0) {
          problems.push(`${label}: ${a.who} painted [${bad.join(', ')}], which the engine reported as unavailable or unpriced`);
        }
      }
      checked += 1;
    }

    expect(checked).toBeGreaterThan(0);
    expect(problems).toEqual([]);
    /* All three participants were actually compared. A reader that went silent everywhere would
       otherwise leave this green over the two surfaces that remained. */
    expect([...exercised].sort()).toEqual([
      "Card DNA §C's chips",
      "Wallet's Best-For chips",
      'the recommendation Check would produce',
    ]);
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
      if (!Array.isArray(wallet) && !Array.isArray(cardDna)) {
        problems.push(`${label}: neither Wallet nor Card DNA §C paints chips yet, so "${unknown.length} unpriced card(s) are not shown as winners" is compared with nothing`);
        continue;
      }
      problems.push(...assertAllEqual([], [
        { who: "Wallet's chips over unpriced cards", painted: Array.isArray(wallet) ? wallet.filter((id) => unknown.includes(id)) : wallet },
        { who: "Card DNA §C's chips over unpriced cards", painted: Array.isArray(cardDna) ? cardDna.filter((id) => unknown.includes(id)) : cardDna },
      ], label));
    }
    expect(problems).toEqual([]);
  });
});
