/**
 * THE COMMAND CENTER BUDGET — what it counts, and what it refuses to call spending.
 */
import { evaluateFinancialLoad, type FinancialLoadResult } from '../../../engines/load';
import { provenanced } from '../../../engines/provenance';
import type { LoggedPurchase } from '../../../types/activity.types';
import { budgetProgress } from '../budgetProgress';

const MONTH = '2026-09';

const purchase = (amountIls: number, loggedAt: string): LoggedPurchase => ({
  activityId: 'a' + loggedAt + String(amountIls),
  amountIls,
  loggedAt,
});

/** The load engine's own result, so the obligation half of the sum is never a second number. */
const loadWith = (monthly: number): FinancialLoadResult =>
  evaluateFinancialLoad({
    monthlyIncomeIls: provenanced(20_000, 'USER'),
    commitments: monthly === 0
      ? []
      : [{ commitmentId: 'c1', monthlyAmountIls: provenanced(monthly, 'USER') }],
    cards: [],
  });

describe('budget progress', () => {
  it('reports no target when the user has not set one', () => {
    const reading = budgetProgress({
      targetIls: undefined, load: loadWith(3_000), purchases: [], monthIso: MONTH,
    });
    expect(reading.band).toBe('no-target');
    expect(reading.ratioOfTarget).toBeUndefined();
    /* It still says what it CAN see, so the surface can explain what a target would measure. */
    expect(reading.monthlyObligationsIls).toBe(3_000);
  });

  it('reports no target for a zero or negative figure rather than dividing by it', () => {
    for (const bad of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const reading = budgetProgress({
        targetIls: bad, load: loadWith(1_000), purchases: [], monthIso: MONTH,
      });
      expect(reading.band).toBe('no-target');
      expect(reading.ratioOfTarget).toBeUndefined();
    }
  });

  it('adds the load engine’s obligations to the purchases logged THIS month', () => {
    const reading = budgetProgress({
      targetIls: 10_000,
      load: loadWith(4_000),
      purchases: [
        purchase(600, '2026-09-02T10:00:00Z'),
        purchase(400, '2026-09-30T23:59:00Z'),
        purchase(9_999, '2026-08-31T23:59:00Z'),
        purchase(8_888, '2026-10-01T00:00:00Z'),
      ],
      monthIso: MONTH,
    });
    expect(reading.monthlyObligationsIls).toBe(4_000);
    expect(reading.loggedPurchasesIls).toBe(1_000);
    expect(reading.seenOutflowIls).toBe(5_000);
    expect(reading.ratioOfTarget).toBeCloseTo(0.5, 6);
    expect(reading.band).toBe('on-track');
  });

  it('bands on-track, approaching and over from the ratio', () => {
    const at = (seen: number): string =>
      budgetProgress({
        targetIls: 10_000,
        load: loadWith(seen),
        purchases: [],
        monthIso: MONTH,
      }).band;
    expect(at(1_000)).toBe('on-track');
    expect(at(7_999)).toBe('on-track');
    expect(at(8_000)).toBe('approaching');
    expect(at(10_000)).toBe('approaching');
    expect(at(10_001)).toBe('over');
  });

  it('does not clamp the ratio, so 130% reads as 130%', () => {
    const reading = budgetProgress({
      targetIls: 1_000, load: loadWith(1_300), purchases: [], monthIso: MONTH,
    });
    expect(reading.ratioOfTarget).toBeCloseTo(1.3, 6);
  });

  it('says "no target" rather than "on track" when there is a target and nothing to measure', () => {
    const reading = budgetProgress({
      targetIls: 5_000, load: null, purchases: [], monthIso: MONTH,
    });
    expect(reading.band).toBe('no-target');
    expect(reading.targetIls).toBe(5_000);
    expect(reading.seenOutflowIls).toBeUndefined();
  });

  it('ignores a purchase whose timestamp is not a date', () => {
    const reading = budgetProgress({
      targetIls: 10_000,
      load: loadWith(0),
      purchases: [purchase(500, 'not-a-date'), purchase(500, '2026-09-05T00:00:00Z')],
      monthIso: MONTH,
    });
    expect(reading.loggedPurchasesIls).toBe(500);
  });

  it('counts a non-finite purchase amount as nothing rather than as NaN', () => {
    const reading = budgetProgress({
      targetIls: 10_000,
      load: loadWith(0),
      purchases: [
        { activityId: 'x', amountIls: Number.NaN, loggedAt: '2026-09-05T00:00:00Z' },
        purchase(250, '2026-09-05T00:00:00Z'),
      ],
      monthIso: MONTH,
    });
    expect(reading.loggedPurchasesIls).toBe(250);
    expect(Number.isFinite(reading.seenOutflowIls as number)).toBe(true);
  });
});
