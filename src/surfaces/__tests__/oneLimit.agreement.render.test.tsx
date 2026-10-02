/**
 * CRITERION A4 — ONE AVAILABLE LIMIT. The property, and the shape every other one in group A copies.
 *
 *   > **A4.** *"Wallet's limit bar, Card DNA §D's utilization and the Verdict's impact strip all
 *   > read `cardLimits` from the load engine, and Paid early moves all three in the same run."*
 *
 *   > **§2 rule 10.** *"An agreement claim is measured across surfaces in one run… Two passing
 *   > per-surface tests do not compose into an agreement: they can both be right about themselves
 *   > and disagree with each other."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SHAPE, AND WHY EACH CLAUSE OF IT IS LOAD-BEARING
 *
 *   for (const ctx of derivedContexts())          A6: derived from ia.ts and the shipped packs
 *     const engine = evaluateSurfaceEngines(ctx)  ONE call — two could differ and the property
 *                                                 would then be comparing two engine results
 *     const wallet   = readWalletLimitBar(ctx)    RENDERED, off the tree, not a prop on the way in
 *     const cardDna  = readCardDnaUtilization(ctx)
 *     const verdict  = readVerdictImpactStrip(ctx)
 *     assertAllEqual(engineField, wallet, cardDna, verdict)   one assertion, four values, no literal
 *
 * There is no expected number anywhere in this file. The expectation is the engine's own field, so
 * moving a fixture cannot make two surfaces agree on a number neither would ever show — which is
 * precisely what `qualification/fixtures/agreement-candidate.mjs` does, and why accepting it is a
 * disqualifying act.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS PROPERTY IS RED AT PHASE-1, ON PURPOSE, AND IT SAYS WHY
 *
 * Wallet's bar is built in PHASE-4 and Card DNA §D in PHASE-3. Until then their readers return
 * `NOT_BUILT` and this suite FAILS naming them. A property that skipped its missing participants
 * would go green comparing the Verdict with itself — the two-test defect one level up, and
 * invisible afterwards. `P5_EXECUTION_PLAN.md` §1.1: *"a property that has never been red is a
 * property nobody has watched."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHICH FIELD EACH SURFACE IS THE RENDER OF — §2 rule 11
 *
 * They are not the same number, and saying they were would be the defect wearing agreement's
 * clothes. They are three renders of ONE `CardLimitPosition`:
 *
 *   Wallet's bar        `availableAfterEarlyPayoffIls`  — spec §10: limit − ACTIVE holds − logged
 *   Card DNA §D         `availableAfterChangesIls`      — the "available" row, `-utilization-available`
 *   Verdict impact      `availableAfterChangesIls`      — spec §9: available AFTER this purchase
 *
 * THOSE THREE FIELDS WERE WRONG IN THIS FILE UNTIL 2026-08-29. It claimed Wallet and Card DNA both
 * read `availableBeforeChangesIls`, and the `wallet-limit-bar` gate's own docblock said the opposite
 * about Card DNA in the same repository — *"alongside Card DNA §D's `availableAfterChangesIls` and
 * the Verdict's impact strip"*. Nothing compared the two claims because this property had never got
 * far enough to compare anything: it failed on a missing reader first, every run, for four phases.
 *
 * And with Wallet on `availableBeforeChangesIls` the third clause below was UNSATISFIABLE. That
 * field counts a paid-early hold as active, so the bar moved by 0 where the engine had released
 * 42,000 — while contract §J4 requires the effect to be *"visible in the same run to Wallet's limit
 * bar"*. The engine now publishes `availableAfterEarlyPayoffIls`, which it had always computed and
 * never returned, and W2's sentence — limit minus **active** holds — is satisfied by it exactly.
 *
 * The agreement claim is that all three come from that one position, and that **Paid early moves
 * all three by the engine's own `releasedByEarlyPayoffIls`** — which is the part a per-surface test
 * cannot see, because a surface that released the hold itself would move correctly on its own.
 */
import { derivedContexts } from './derivedPopulation';
import { evaluateSurfaceEngines } from '../surfaceEngines';
import { REQUIRED_PARTICIPANTS, notBuiltYet } from './agreementParticipants';
import {
  NOT_BUILT,
  NO_POPULATION,
  readCardDnaUtilizationLimit,
  readVerdictImpactStrip,
  readWalletLimitBar,
  type PaintedNumber,
} from './agreementReaders';
import type { SurfaceContext } from '../surfaceContext';
import { provenanced } from '../../engines/provenance';

/**
 * Every participant compared to the engine's field AND to each other, in ONE call.
 *
 * The name is one the agreement auditor knows, and it is also the accurate one: all painted values
 * must equal the engine field, so they equal each other. A helper per surface would be the two-test
 * shape with a helper in front of it.
 */
const assertAllEqual = (
  expected: number,
  actuals: readonly { readonly who: string; readonly painted: PaintedNumber }[],
  where: string,
): readonly string[] => {
  const problems: string[] = [];
  for (const a of actuals) {
    /* NO_POPULATION is not a skip and not a failure: it means this context gives this surface
       nothing to render. Every context reaching here has a card (the loop guards on it), so it is
       carried for completeness rather than exercised — see agreementReaders.NO_POPULATION. */
    if (a.painted === NO_POPULATION) continue;
    if (a.painted === NOT_BUILT) { problems.push(`${where}: ${a.who} painted nothing`); continue; }
    if (a.painted !== expected) {
      problems.push(`${where}: ${a.who} painted ${String(a.painted)}, the load engine says ${expected}`);
    }
  }
  return problems;
};

/** A context with a purchase to consider, so the Verdict's after-purchase figure is comparable. */
const withProspective = (ctx: SurfaceContext, amount: number): SurfaceContext => {
  const first = ctx.cards[0];
  if (first === undefined) return ctx;
  return {
    ...ctx,
    prospectiveCommitment: {
      commitmentId: 'this-purchase',
      monthlyAmountIls: provenanced(amount, 'USER'),
      linkedCardId: first.cardId,
      remainingHoldIls: provenanced(amount, 'USER'),
    },
  };
};

/** A real derived context — a reader implemented later must never be handed an empty object. */
const realContext = (): SurfaceContext => derivedContexts()[0]?.context as SurfaceContext;

describe('A4 — one available limit', () => {
  it('every participant the criterion names has a reader', () => {
    const missing = REQUIRED_PARTICIPANTS['one-limit'].filter((p) => {
      if (p.id === 'verdict-impact-strip') return false;
      if (p.id === 'wallet-limit-bar') return readWalletLimitBar(realContext()) === NOT_BUILT;
      if (p.id === 'card-dna-utilization') return readCardDnaUtilizationLimit(realContext()) === NOT_BUILT;
      return true;
    });
    expect(missing.map((p) => notBuiltYet('one-limit', p))).toEqual([]);
  });

  it('Wallet, Card DNA and the Verdict all render one cardLimits position, over the derived population', () => {
    const problems: string[] = [];
    let checked = 0;

    for (const { label, context } of derivedContexts()) {
      const ctx = withProspective(context, 1_200);
      const engine = evaluateSurfaceEngines(ctx);
      if (engine.load === null) continue; /* the absence cases are H1/H3/H4's, not A4's */
      const cardId = ctx.cards[0]?.cardId;
      if (cardId === undefined) continue;
      const position = engine.load.cardLimits.find((p) => p.cardId === cardId);
      if (position === undefined) { problems.push(`${label}: the load engine returned no position for ${cardId}`); continue; }

      const wallet = readWalletLimitBar(ctx);
      const cardDna = readCardDnaUtilizationLimit(ctx);
      const verdict = readVerdictImpactStrip(ctx);

      problems.push(
        ...assertAllEqual(position.availableAfterEarlyPayoffIls.value, [
          { who: "Wallet's limit bar", painted: wallet },
        ], label),
        /* Card DNA's "available" row and the Verdict's strip are the same field: both answer
           "what is left after everything this context knows about", and the context is one. */
        ...assertAllEqual(position.availableAfterChangesIls.value, [
          { who: "Card DNA §D's utilization", painted: cardDna },
          { who: "the Verdict's impact strip", painted: verdict },
        ], label),
      );
      checked += 1;
    }

    expect(checked).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it('Paid early moves Wallet, Card DNA and the Verdict together, by the engine’s own released amount', () => {
    const problems: string[] = [];
    let checked = 0;

    for (const { label, context } of derivedContexts()) {
      if (context.installments.length === 0 || context.cards.length === 0) continue;
      const first = context.installments[0];
      const cardId = context.cards[0]?.cardId;
      if (first === undefined || cardId === undefined) continue;

      const before = withProspective(context, 1_200);
      const after = { ...before, paidEarlyCommitmentIds: [first.installmentId] };
      const engineBefore = evaluateSurfaceEngines(before);
      const engineAfter = evaluateSurfaceEngines(after);
      if (engineBefore.load === null || engineAfter.load === null) continue;

      const positionAfter = engineAfter.load.cardLimits.find((p) => p.cardId === cardId);
      const positionBefore = engineBefore.load.cardLimits.find((p) => p.cardId === cardId);
      if (positionAfter === undefined || positionBefore === undefined) continue;
      /**
       * THE MOVEMENT IS A DELTA, NOT AN ABSOLUTE — corrected 2026-08-29.
       *
       * This read `positionAfter.releasedByEarlyPayoffIls` and called it the expected movement,
       * which is right only when nothing was released BEFORE. One context in the derived population
       * is *"a settled hold the user marked Paid early"* and carries `paidEarlyCommitmentIds`
       * already, so its `before` was not a before: all three surfaces correctly moved by 0 while
       * the property demanded 42,000 and blamed the surfaces. A property whose expectation is wrong
       * for one member of its own population is a property that cannot be satisfied by correct code.
       */
      const released = positionAfter.releasedByEarlyPayoffIls.value
        - positionBefore.releasedByEarlyPayoffIls.value;
      if (released === 0) continue; /* nothing new was released; not a case for this claim */

      const walletBefore = readWalletLimitBar(before);
      const walletAfter = readWalletLimitBar(after);
      const cardDnaBefore = readCardDnaUtilizationLimit(before);
      const cardDnaAfter = readCardDnaUtilizationLimit(after);
      const verdictBefore = readVerdictImpactStrip(before);
      const verdictAfter = readVerdictImpactStrip(after);

      const moved = (who: string, b: PaintedNumber, a: PaintedNumber): void => {
        if (typeof b !== 'number' || typeof a !== 'number') {
          problems.push(`${label}: ${who} painted nothing`);
          return;
        }
        if (a - b !== released) {
          problems.push(`${label}: ${who} moved by ${a - b}, the load engine released ${released}`);
        }
      };
      moved("Wallet's limit bar", walletBefore, walletAfter);
      moved("Card DNA §D's utilization", cardDnaBefore, cardDnaAfter);
      moved("the Verdict's impact strip", verdictBefore, verdictAfter);
      checked += 1;
    }

    expect(checked).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});
