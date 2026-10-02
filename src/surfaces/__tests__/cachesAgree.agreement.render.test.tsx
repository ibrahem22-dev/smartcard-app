/**
 * CRITERION A5 — THE DERIVED CACHES AGREE WITH THE ENGINE.
 *
 *   > **A5.** *"Every derived cache value equals a fresh engine call for the same inputs, and a
 *   > cache that cannot be shown current is invalidated rather than rendered."*
 *
 * Spec §21C names them for the first time as real application-generated data — *"derived caches
 * (best-for, load %, calendar risk, savings totals)"* — and **P5 is the phase that creates them**.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE WAY THIS PROPERTY IS MOST OFTEN WRITTEN WRONG
 *
 * `P5_VALIDATION_PLAN.md` §3.2: *"testing that the cache WAS WRITTEN, rather than that it still
 * agrees."* A cache is a copy, and a copy is a second home for a fact; P1 and P2 between them found
 * eleven instances of a fact with two homes drifting. So this property does not ask whether a cache
 * exists — it takes every cached value, calls the engine again for the same inputs, and compares.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * IT IS A CROSS-SURFACE CLAIM, BECAUSE THE CACHES BELONG TO DIFFERENT SURFACES
 *
 * Best-for is Wallet's, load-% is Home's, calendar risk is Plan Calendar's. A cache that has
 * drifted is **one surface showing a number the other two and the engine do not** — which is why
 * all three are compared to one engine result in one assertion rather than each to its own.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * RED AT PHASE-1 BECAUSE THERE IS NOTHING TO COMPARE, AND THAT IS A FAILURE AND NOT A PASS
 *
 * No cache exists until PHASE-7. A property that passed over zero caches would be the vacuous pass
 * contract §2 rule 5 refuses — *"a check over zero items fails"* — and it would go on passing on
 * the day a cache landed without a reader here. So the absence is asserted as a failure, naming it.
 */
import { derivedContexts } from './derivedPopulation';
import { evaluateSurfaceEngines } from '../surfaceEngines';
import { REQUIRED_PARTICIPANTS, notBuiltYet } from './agreementParticipants';
import { NOT_BUILT, readDerivedCaches, type CachedValue } from './agreementReaders';
import type { SurfaceContext } from '../surfaceContext';

/** Every cache compared to the engine's own value AND to each other, in ONE call. */
const assertAllEqual = (
  actuals: readonly { readonly who: string; readonly cached: CachedValue | null; readonly fresh: number | null }[],
  where: string,
): readonly string[] => {
  const problems: string[] = [];
  for (const a of actuals) {
    /*
     * THE ENGINE HAVING NO VALUE IS NOT A DEFECT — IT IS THE CASE A5 IS ABOUT.
     *
     * This required every cache to be present for every derived context, and the population
     * deliberately contains contexts the engine cannot value: no income captured, no cards in the
     * vault. In those, a missing cache failed as "compared with nothing" and a present cache failed
     * as "cannot be shown current". Both branches failed. It was a red no honest implementation
     * could clear — the fifth instance of that pattern in this campaign, and the first inside an
     * agreement property.
     *
     * A5's own wording resolves it: a cache that cannot be shown current is INVALIDATED rather than
     * rendered. So where the engine has no value, the correct cache state is ABSENT, and this now
     * requires that instead of forbidding it — which also means the invalidation path is tested
     * rather than merely described.
     */
    if (a.fresh === null) {
      if (a.cached !== null) {
        problems.push(`${where}: ${a.who} holds ${a.cached.value} while the engine has no value for it — a cache that cannot be shown current must be invalidated rather than rendered`);
      }
      continue;
    }
    if (a.cached === null) {
      problems.push(`${where}: ${a.who} is absent while the engine HAS a value for it — that is a cache that quietly stopped caching, not an invalidation`);
      continue;
    }
    if (a.fresh !== a.cached.value) {
      problems.push(`${where}: ${a.who} holds ${a.cached.value}, a fresh engine call says ${a.fresh}`);
    }
  }
  return problems;
};

/** A real derived context — a reader implemented later must never be handed an empty object. */
const realContext = (): SurfaceContext => derivedContexts()[0]?.context as SurfaceContext;

describe('A5 — every derived cache equals a fresh engine call', () => {
  it('every cache the criterion names has a reader', () => {
    const missing = REQUIRED_PARTICIPANTS['caches-agree'].filter(
      () => readDerivedCaches(realContext()) === NOT_BUILT,
    );
    expect(missing.map((p) => notBuiltYet('caches-agree', p))).toEqual([]);
  });

  it('each cached value equals what the engine says now, for the same inputs, and no cache is empty', () => {
    const problems: string[] = [];
    let compared = 0;

    for (const { label, context } of derivedContexts()) {
      const cached = readDerivedCaches(context);
      if (cached === NOT_BUILT) {
        problems.push(`${label}: no derived cache is readable yet — spec §21C's best-for, load %, calendar risk and savings totals are created in PHASE-7, and a property that passed over zero caches would be the vacuous pass §2 rule 5 refuses`);
        continue;
      }

      /* ONE fresh call per context. Every cached value is compared to a FIELD of it — never to the
         value that was cached, which is the same number by construction. */
      const engine = evaluateSurfaceEngines(context);
      const homeCache = cached.find((c) => c.cache === 'load-ratio') ?? null;
      const calendarCache = cached.find((c) => c.cache === 'calendar-risk') ?? null;
      const walletCache = cached.find((c) => c.cache === 'best-for') ?? null;

      const calendarDay = calendarCache === null
        ? undefined
        : engine.risk?.days.find((d) => d.date === calendarCache.key);
      const walletRank = walletCache === null
        ? -1
        : (engine.scoring?.ranked.findIndex((c) => c.cardId === walletCache.key) ?? -1);

      problems.push(...assertAllEqual([
        { who: "Home's load-% cache", cached: homeCache, fresh: engine.load?.current.ratioOfIncome.value ?? null },
        { who: "Plan Calendar's risk cache", cached: calendarCache, fresh: calendarDay === undefined ? null : Number(calendarDay.riskLevel === 'safe') },
        { who: "Wallet's best-for cache", cached: walletCache, fresh: walletRank < 0 ? null : walletRank },
      ], label));
      compared += cached.length;
    }

    expect(problems).toEqual([]);
    expect(compared).toBeGreaterThan(0);
  });
});
