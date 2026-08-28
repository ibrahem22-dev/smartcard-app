/**
 * CRITERION A2 — ONE LOAD.
 *
 *   > **A2.** *"Home's load bar, Plan Commitments' sticky summary, Card DNA §D's utilization and
 *   > the Verdict's impact strip are four renders of one load-engine result for the same inputs,
 *   > measured in one run."*
 *
 * Same shape as A4: one `evaluateSurfaceEngines` call per context, every participant's PAINTED
 * value compared to the engine's own field and to each other in one assertion, over the derived
 * population, with no expected number anywhere in the file.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE BOUNDARY IS THE POINT, AND THE BAND IS HALF OF IT
 *
 * `P5_VALIDATION_PLAN.md` §3.2 names the way this property is most often written wrong:
 * *"comparing the ratio but not the **band** — the boundary is where they disagree, and `>=` versus
 * `>` at exactly 35% is the canonical defect."* So both are compared, and the population lands
 * exactly on 25%, 35% and 50% rather than near them.
 *
 * RED AT PHASE-1, for two separate reasons, and it says which. Three participants are built in
 * PHASE-3, PHASE-5 and PHASE-7. The fourth — the Verdict's Financial Impact panel — is built, and
 * it disagrees for a reason that is **P4's and not P5's**: `src/check/incomeAnchor.ts` returns
 * `commitments: []` unconditionally, so the Check loop evaluates every purchase as if the user had
 * no existing obligations. That is raised as Owner question `OQ-P5-001`; it is not repaired here.
 */
import { derivedContexts } from './derivedPopulation';
import { evaluateSurfaceEngines } from '../surfaceEngines';
import { REQUIRED_PARTICIPANTS, notBuiltYet } from './agreementParticipants';
import {
  NOT_BUILT,
  readCardDnaBand,
  readCardDnaUtilizationRatio,
  readCommitmentsBand,
  readHomeLoadBand,
  readCommitmentsSummaryRatio,
  readHomeLoadBar,
  readVerdictLoadRatio,
  type PaintedBand,
  type PaintedNumber,
} from './agreementReaders';
import type { SurfaceContext } from '../surfaceContext';
import { provenanced } from '../../engines/provenance';

const assertAllEqual = (
  expected: number,
  actuals: readonly { readonly who: string; readonly painted: PaintedNumber }[],
  where: string,
): readonly string[] => {
  const problems: string[] = [];
  for (const a of actuals) {
    if (a.painted === NOT_BUILT) { problems.push(`${where}: ${a.who} painted nothing`); continue; }
    if (a.painted !== expected) problems.push(`${where}: ${a.who} painted ${a.painted}, the load engine says ${expected}`);
  }
  return problems;
};

/** The band comparison, same shape: every surface against the engine's band and each other. */
const assertBandsEqual = (
  expected: string,
  actuals: readonly { readonly who: string; readonly painted: PaintedBand }[],
  where: string,
): readonly string[] => {
  const problems: string[] = [];
  for (const a of actuals) {
    if (a.painted === NOT_BUILT) { problems.push(`${where}: ${a.who} paints no band yet`); continue; }
    if (a.painted !== expected) problems.push(`${where}: ${a.who} painted band "${a.painted}", the load engine says "${expected}"`);
  }
  return problems;
};

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

describe('A2 — one load', () => {
  it('every participant the criterion names has a reader', () => {
    const missing = REQUIRED_PARTICIPANTS['one-load'].filter((p) => {
      const ctx = derivedContexts()[0]?.context as SurfaceContext;
      if (p.id === 'home-load-bar') return readHomeLoadBar(ctx) === NOT_BUILT;
      if (p.id === 'commitments-summary') return readCommitmentsSummaryRatio(ctx) === NOT_BUILT;
      if (p.id === 'card-dna-utilization') return readCardDnaUtilizationRatio(ctx) === NOT_BUILT;
      return false;
    });
    expect(missing.map((p) => notBuiltYet('one-load', p))).toEqual([]);
  });

  it('Home, Plan Commitments, Card DNA and the Verdict render one load ratio over the derived population', () => {
    const problems: string[] = [];
    let checked = 0;

    for (const { label, context } of derivedContexts()) {
      const ctx = withProspective(context, 1_200);
      const engine = evaluateSurfaceEngines(ctx);
      if (engine.load === null) continue;

      const home = readHomeLoadBar(ctx);
      const commitments = readCommitmentsSummaryRatio(ctx);
      const cardDna = readCardDnaUtilizationRatio(ctx);
      const verdict = readVerdictLoadRatio(ctx);

      problems.push(...assertAllEqual(engine.load.current.ratioOfIncome.value, [
        { who: "Home's load bar", painted: home },
        { who: "Plan Commitments' summary", painted: commitments },
        { who: "Card DNA §D's utilization", painted: cardDna },
      ], label));
      problems.push(...assertAllEqual(engine.load.projected.ratioOfIncome.value, [
        { who: "the Verdict's Financial Impact panel", painted: verdict },
      ], label));
      checked += 1;
    }

    expect(checked).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it('the BAND agrees too, which is where a >= and a > disagree and the ratio does not', () => {
    const problems: string[] = [];
    let checked = 0;

    for (const { label, context } of derivedContexts()) {
      const engine = evaluateSurfaceEngines(context);
      if (engine.load === null) continue;

      /* The band, from the same ONE result the ratio came from. A surface that classified the
         ratio itself would be holding recommendation logic, which B1 forbids at build time and
         this property is the runtime half of. */
      const home = readHomeLoadBand(context);
      const commitments = readCommitmentsBand(context);
      const cardDna = readCardDnaBand(context);

      problems.push(...assertBandsEqual(engine.load.current.band, [
        { who: "Home's load bar", painted: home },
        { who: "Plan Commitments' summary", painted: commitments },
        { who: "Card DNA §D's utilization", painted: cardDna },
      ], label));
      checked += 1;
    }

    expect(checked).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});
