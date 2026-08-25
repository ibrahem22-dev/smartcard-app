import { PROVENANCE_CHIPS } from '../../authority/provenanceChip';
import {
  evaluateRiskPlanning,
  type PlanningBilling,
  type RiskPlanningInput,
} from '../risk';

const amount = (value: number, provenance: 'USER' | 'VERIFIED' | 'ESTIMATE' = 'USER') => ({
  value,
  provenance,
});

const billing = (
  billingId: string,
  date: string,
  value: number,
  obligationsEnding = 0,
): PlanningBilling => ({
  billingId,
  date,
  amountIls: amount(value),
  monthlyObligationsEndingIls: amount(obligationsEnding),
});

const input = (overrides: Partial<RiskPlanningInput> = {}): RiskPlanningInput => ({
  asOfDate: '2026-08-25',
  throughDate: '2026-08-28',
  openingBalanceIls: amount(5_000),
  dangerThresholdIls: amount(500),
  monthlyIncomeIls: amount(10_000),
  currentMonthlyObligationsIls: amount(2_000),
  prospectiveMonthlyObligationIls: amount(1_000),
  safeLoadRatio: amount(0.35),
  salaries: [],
  billings: [],
  commitments: [],
  ...overrides,
});

describe('the risk / planning engine (N5)', () => {
  it('groups same-date billing events into a deterministic billing cluster', () => {
    const result = evaluateRiskPlanning(input({
      billings: [
        billing('card-b', '2026-08-26', 700),
        billing('card-a', '2026-08-26', 500),
        billing('card-c', '2026-08-27', 300),
      ],
    }));
    expect(result.billingClusters).toEqual([{
      date: '2026-08-26',
      billingIds: ['card-a', 'card-b'],
      totalBillingIls: { value: 1_200, provenance: 'ESTIMATE' },
    }]);
    expect(result.days.find((day) => day.date === '2026-08-26')).toMatchObject({
      billingOutflowIls: { value: 1_200 },
      billingCluster: true,
      riskLevel: 'caution',
    });
  });

  it('applies salary on its stated date and reports pressure through the next salary', () => {
    const result = evaluateRiskPlanning(input({
      openingBalanceIls: amount(1_000),
      salaries: [{ salaryId: 'salary', date: '2026-08-26', amountIls: amount(2_000) }],
      billings: [billing('card-a', '2026-08-25', 800)],
      commitments: [{
        commitmentId: 'rent',
        date: '2026-08-26',
        amountIls: amount(100),
      }],
    }));
    expect(result.days.map((day) => day.projectedBalanceIls?.value)).toEqual([
      200, 2_100, 2_100, 2_100,
    ]);
    expect(result.pressure).toMatchObject({
      nextSalaryDate: '2026-08-26',
      outflowsThroughNextSalaryIls: { value: 900 },
      balanceBeforeNextSalaryIls: { value: 100 },
    });
  });

  it('assigns per-day risk from the projected balance, danger floor and clustering', () => {
    const result = evaluateRiskPlanning(input({
      openingBalanceIls: amount(1_000),
      billings: [
        billing('a', '2026-08-25', 300),
        billing('b', '2026-08-25', 100),
        billing('c', '2026-08-26', 200),
        billing('d', '2026-08-27', 500),
      ],
    }));
    expect(result.days.map((day) => day.riskLevel)).toEqual([
      'caution', 'high', 'critical', 'critical',
    ]);
    expect(result.pressure.lowestProjectedBalanceIls?.value).toBe(-100);
    expect(result.pressure.lowestBalanceDate).toBe('2026-08-27');
  });

  it('returns unknown daily risk instead of inventing an omitted optional balance', () => {
    const result = evaluateRiskPlanning(input({
      openingBalanceIls: undefined,
      billings: [billing('a', '2026-08-25', 4_000), billing('b', '2026-08-25', 4_000)],
    }));
    expect(result.days.every((day) => day.riskLevel === 'unknown')).toBe(true);
    expect(result.days.every((day) => day.projectedBalanceIls === undefined)).toBe(true);
    expect(result.pressure.lowestProjectedBalanceIls).toBeUndefined();
    expect(result.billingClusters).toHaveLength(1);
  });

  it('returns wait until billing only when ending obligations make projected load safe', () => {
    const result = evaluateRiskPlanning(input({
      currentMonthlyObligationsIls: amount(3_000),
      prospectiveMonthlyObligationIls: amount(2_000),
      billings: [
        billing('first', '2026-08-26', 600, 1_000),
        billing('second', '2026-08-27', 500, 600),
      ],
    }));
    expect(result.waitUntilBilling).toEqual({
      decision: 'WAIT_UNTIL_BILLING',
      billingDate: '2026-08-27',
      loadRatioBeforeBilling: { value: 0.4, provenance: 'ESTIMATE' },
      loadRatioAfterBilling: { value: 0.34, provenance: 'ESTIMATE' },
    });
  });

  it('distinguishes no wait needed from billing that cannot make load safe', () => {
    const noWait = evaluateRiskPlanning(input());
    const cannotHelp = evaluateRiskPlanning(input({
      currentMonthlyObligationsIls: amount(4_000),
      prospectiveMonthlyObligationIls: amount(1_000),
      billings: [billing('card', '2026-08-26', 500, 500)],
    }));
    expect(noWait.waitUntilBilling).toMatchObject({
      decision: 'NO_WAIT_NEEDED',
      loadRatioNow: { value: 0.3 },
    });
    expect(cannotHelp.waitUntilBilling).toMatchObject({
      decision: 'BILLING_DOES_NOT_MAKE_SAFE',
      loadRatioNow: { value: 0.5 },
      lowestPostBillingLoadRatio: { value: 0.45 },
    });
  });

  it('treats an entered zero balance as data and supports leap-day UTC projections', () => {
    const result = evaluateRiskPlanning(input({
      asOfDate: '2028-02-28',
      throughDate: '2028-03-01',
      openingBalanceIls: amount(0),
      salaries: [{ salaryId: 'salary', date: '2028-02-29', amountIls: amount(1_000) }],
    }));
    expect(result.days.map((day) => day.date)).toEqual([
      '2028-02-28', '2028-02-29', '2028-03-01',
    ]);
    expect(result.days.map((day) => day.riskLevel)).toEqual(['high', 'safe', 'safe']);
  });

  it('projects an entered negative balance as critical rather than rejecting overdraft', () => {
    const result = evaluateRiskPlanning(input({ openingBalanceIls: amount(-250) }));
    expect(result.days[0]).toMatchObject({
      projectedBalanceIls: { value: -250, provenance: 'ESTIMATE' },
      riskLevel: 'critical',
    });
    expect(result.pressure.lowestProjectedBalanceIls?.value).toBe(-250);
  });

  it('every numeric output carries canonical provenance and the result carries a reason trace', () => {
    const result = evaluateRiskPlanning(input({
      salaries: [{ salaryId: 'salary', date: '2026-08-28', amountIls: amount(10_000) }],
      billings: [billing('a', '2026-08-26', 500), billing('b', '2026-08-26', 250)],
    }));
    const numbers = [
      ...result.days.flatMap((day) => [
        day.salaryInflowIls,
        day.billingOutflowIls,
        day.commitmentOutflowIls,
        day.totalOutflowIls,
        ...(day.projectedBalanceIls === undefined ? [] : [day.projectedBalanceIls]),
      ]),
      ...result.billingClusters.map((cluster) => cluster.totalBillingIls),
      result.pressure.totalSalaryInflowsIls,
      result.pressure.totalBillingOutflowsIls,
      result.pressure.totalCommitmentOutflowsIls,
      result.pressure.totalOutflowsIls,
      result.pressure.outflowsThroughNextSalaryIls,
    ];
    for (const number of numbers) expect(PROVENANCE_CHIPS).toContain(number.provenance);
    expect(result.trace.engine).toBe('risk');
    expect(result.trace.steps).toHaveLength(3);
  });

  it('refuses invalid ranges, dates, duplicates, invalid amounts, UNKNOWN values and zero income', () => {
    expect(() => evaluateRiskPlanning(input({ throughDate: '2026-02-30' }))).toThrow(/real UTC/);
    expect(() => evaluateRiskPlanning(input({ throughDate: '2026-08-24' }))).toThrow(/1 to 366/);
    expect(() => evaluateRiskPlanning(input({
      salaries: [{ salaryId: 'late', date: '2026-08-29', amountIls: amount(1) }],
    }))).toThrow(/outside the projection range/);
    expect(() => evaluateRiskPlanning(input({
      billings: [billing('same', '2026-08-26', 1), billing('same', '2026-08-27', 1)],
    }))).toThrow(/duplicate billing id/);
    expect(() => evaluateRiskPlanning(input({ openingBalanceIls: amount(Number.NaN) }))).toThrow(/non-finite/);
    expect(() => evaluateRiskPlanning(input({ dangerThresholdIls: amount(-1) }))).toThrow(/negative/);
    expect(() => evaluateRiskPlanning(input({
      dangerThresholdIls: { value: 100, provenance: 'UNKNOWN' },
    }))).toThrow(/UNKNOWN/);
    expect(() => evaluateRiskPlanning(input({ monthlyIncomeIls: amount(0) }))).toThrow(/zero income/);
    expect(() => evaluateRiskPlanning(input({ safeLoadRatio: amount(1.01) }))).toThrow(/0 through 1/);
  });
});
