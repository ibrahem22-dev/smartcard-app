/**
 * CRITERION A3 — ONE RISK.
 *
 *   > **A3.** *"Home's 7-day strip and Plan Calendar's risk dots report the same level for the same
 *   > day over the same window, from one risk-engine result."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * KEYED BY DATE, NOT BY POSITION — the way this property is most often written wrong
 *
 * `P5_VALIDATION_PLAN.md` §3.2: *"comparing a window rather than a day; the two surfaces show
 * different spans and the overlap is what must match."* Home shows seven days; the calendar shows a
 * month. Comparing element 0 with element 0 compares "the first day Home shows" with "the first day
 * of the month" and calls them equal on the first of every month. So the comparison here is over
 * the **intersection of the two surfaces' dates**, keyed by the date itself.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * RED AT PHASE-1, AND THE CALENDAR IS THE INTERESTING HALF
 *
 * Home's strip is built in PHASE-7. The Plan Calendar exists today — but it reads
 * `src/engines/cashflowRadar.ts`, a pre-P3 module that is **not one of the five MVP engines**
 * (`src/engines/mvpEngines.ts` names scoring, verdict, fx, load and risk). Spec §20 engine 6
 * produces the per-day risk levels both surfaces consume, and PHASE-6 re-points the calendar at it
 * through the seam. Until then the calendar paints a level this property cannot compare, and it
 * says so rather than comparing two different engines and reporting agreement.
 */
import { derivedContexts } from './derivedPopulation';
import { evaluateSurfaceEngines } from '../surfaceEngines';
import { REQUIRED_PARTICIPANTS, notBuiltYet } from './agreementParticipants';
import {
  NOT_BUILT,
  readCalendarRiskDotDay,
  readHomeRiskStripDay,
  type PaintedLevel,
} from './agreementReaders';
import type { SurfaceContext } from '../surfaceContext';

const assertAllEqual = (
  expected: string,
  actuals: readonly { readonly who: string; readonly painted: PaintedLevel }[],
  where: string,
): readonly string[] => {
  const problems: string[] = [];
  for (const a of actuals) {
    if (a.painted === NOT_BUILT) { problems.push(`${where}: ${a.who} painted nothing`); continue; }
    if (a.painted !== expected) problems.push(`${where}: ${a.who} painted "${a.painted}", the risk engine says "${expected}"`);
  }
  return problems;
};

describe('A3 — one risk', () => {
  it('every participant the criterion names has a reader', () => {
    const missing = REQUIRED_PARTICIPANTS['one-risk'].filter((p) => {
      const ctx = derivedContexts()[0]?.context as SurfaceContext;
      if (p.id === 'home-risk-strip') return readHomeRiskStripDay(ctx, '') === NOT_BUILT;
      if (p.id === 'calendar-risk-dots') return readCalendarRiskDotDay(ctx, '') === NOT_BUILT;
      return false;
    });
    expect(missing.map((p) => notBuiltYet('one-risk', p))).toEqual([]);
  });

  it('Home and the calendar report the same level for the same DAY, keyed by date', () => {
    const problems: string[] = [];
    let checked = 0;

    for (const { label, context } of derivedContexts()) {
      const engine = evaluateSurfaceEngines(context);
      if (engine.risk === null) continue;

      for (const day of engine.risk.days) {
        const home = readHomeRiskStripDay(context, day.date);
        const calendar = readCalendarRiskDotDay(context, day.date);
        /* A day neither surface shows is not a disagreement; a day ONE shows is. */
        if (home === NOT_BUILT && calendar === NOT_BUILT) {
          problems.push(`${label} ${day.date}: neither Home's strip nor the calendar's dots painted a level`);
          continue;
        }
        problems.push(...assertAllEqual(day.riskLevel, [
          { who: "Home's 7-day strip", painted: home },
          { who: "Plan Calendar's risk dot", painted: calendar },
        ], `${label} ${day.date}`));
      }
      checked += 1;
    }

    expect(checked).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it('both surfaces read the SAME risk result, not two evaluations of the same window', () => {
    /* One call per context, and both readers are handed that context. Two calls could differ by a
       default or a clock and the property would then be comparing two engine results, which is a
       different claim from the one A3 makes. */
    const contexts = derivedContexts().map((c) => c.context);
    const problems: string[] = [];
    for (const context of contexts) {
      const engine = evaluateSurfaceEngines(context);
      if (engine.risk === null) continue;
      if (engine.risk.days.length === 0) problems.push('the risk engine returned a window with no days');
      if (engine.context !== context) problems.push('the result does not carry the context it was evaluated from');
    }
    expect(problems).toEqual([]);
  });
});
