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

/**
 * The seven dates Home's strip claims, derived from the context rather than assumed.
 *
 * H4 fixes the span at seven days from the as-of date. This is the only place A3 needs to know
 * that, and it is derived here rather than hardcoded so a change to H4's span moves the property
 * with it instead of silently narrowing what gets compared.
 */
function homeWindowDates(ctx: SurfaceContext): readonly string[] {
  const start = new Date(`${ctx.asOfDate}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_unused, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
describe('A3 — one risk', () => {
  it('every participant the criterion names has a reader', () => {
    /*
     * ASK EACH READER ABOUT A DAY IT SHOULD ACTUALLY HAVE.
     *
     * This asked with an EMPTY date string, and every correctly-built reader answers NOT_BUILT to
     * that — there is no day called "". So the check conflated "this participant has no reader"
     * with "this reader has no level for a date that does not exist", and it stayed red after both
     * readers were built. A readiness check that cannot distinguish an unbuilt surface from a
     * working one is not measuring readiness.
     *
     * It now asks about the first day of Home's own window, which both surfaces cover, so a
     * NOT_BUILT means what the message says it means.
     */
    const missing = REQUIRED_PARTICIPANTS['one-risk'].filter((p) => {
      const ctx = derivedContexts()[0]?.context as SurfaceContext;
      const day = homeWindowDates(ctx)[0] ?? ctx.asOfDate;
      if (p.id === 'home-risk-strip') return readHomeRiskStripDay(ctx, day) === NOT_BUILT;
      if (p.id === 'calendar-risk-dots') return readCalendarRiskDotDay(ctx, day) === NOT_BUILT;
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

      /*
       * THE INTERSECTION, WHICH IS WHAT THIS FILE'S OWN HEADER ALREADY SAID.
       *
       * The header, written in PHASE-1, says the comparison is over "the intersection of the two
       * surfaces' dates". The loop iterated every day the engine produced and reported Home as
       * painting nothing for days 8 onward — which is not a disagreement. H4 defines Home's strip
       * as SEVEN DAYS; the calendar shows a month. Requiring Home to paint the month would put A3
       * in direct contradiction with H4, and the criterion says "over the same window" precisely
       * because the two windows are not the same size.
       *
       * The prose and the code disagreed. That is this campaign's signature defect, arriving in
       * the instrument built to catch it.
       *
       * WHAT IS STILL A FAILURE, so the fix does not soften the property:
       *   · inside Home's own window, Home not painting is a failure — it is claiming that span;
       *   · inside Home's window, the two disagreeing is a failure, which is A3 itself;
       *   · on ANY day the engine levelled, the calendar not painting is a failure — the calendar
       *     covers the whole month and has no excuse;
       *   · a context where the windows never overlap is a failure, because a property that
       *     compared nothing would pass silently (§2 rule 5).
       */
      const homeWindow = new Set(homeWindowDates(context));
      let overlapped = 0;

      for (const day of engine.risk.days) {
        const calendar = readCalendarRiskDotDay(context, day.date);
        if (calendar === NOT_BUILT) {
          problems.push(`${label} ${day.date}: the calendar painted nothing, and it covers the whole month`);
          continue;
        }

        if (!homeWindow.has(day.date)) {
          /* Outside Home's seven days. Home makes no claim here, and silence is not disagreement. */
          problems.push(...assertAllEqual(day.riskLevel, [
            { who: "Plan Calendar's risk dot", painted: calendar },
          ], `${label} ${day.date}`));
          continue;
        }

        overlapped += 1;
        const home = readHomeRiskStripDay(context, day.date);
        problems.push(...assertAllEqual(day.riskLevel, [
          { who: "Home's 7-day strip", painted: home },
          { who: "Plan Calendar's risk dot", painted: calendar },
        ], `${label} ${day.date}`));
      }

      if (overlapped === 0) {
        problems.push(`${label}: the two surfaces' windows did not overlap on a single day the engine levelled — a property that compares nothing passes silently`);
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
