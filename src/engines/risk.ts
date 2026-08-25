/**
 * THE RISK / PLANNING ENGINE — criterion N5, product spec §20.6.
 *
 * One deterministic UTC-date projection accounts for the four N5 outputs:
 *   1. billing events on the same date are exposed as a cluster;
 *   2. salary is applied on its stated date, never guessed from a day-of-month;
 *   3. every calendar day receives an honest risk level and pressure figures;
 *   4. "wait until billing" is returned only when obligations ending at a named billing event
 *      move the same projected monthly load from above to at/below the supplied safe threshold.
 *
 * `openingBalanceIls` is optional by product design. Without it, cashflow amounts and clusters remain
 * useful, but the engine returns `unknown` daily risk instead of inventing a balance. Persistence,
 * locale rendering and calendar UI are outside this module.
 */
import { provenanced, type ProvenancedNumber } from './provenance';
import { step, trace, type ReasonTrace } from './reasonTrace';

export type PlanningRiskLevel = 'safe' | 'caution' | 'high' | 'critical' | 'unknown';

export interface PlanningSalary {
  readonly salaryId: string;
  readonly date: string;
  readonly amountIls: ProvenancedNumber;
}

export interface PlanningBilling {
  readonly billingId: string;
  readonly date: string;
  /** Statement amount leaving the bank account on this date. */
  readonly amountIls: ProvenancedNumber;
  /** Monthly obligations whose final charge occurs at this billing event. Zero is valid. */
  readonly monthlyObligationsEndingIls: ProvenancedNumber;
}

export interface PlanningCommitment {
  readonly commitmentId: string;
  readonly date: string;
  readonly amountIls: ProvenancedNumber;
}

export interface RiskPlanningInput {
  /** Inclusive UTC calendar range, both strict yyyy-mm-dd. */
  readonly asOfDate: string;
  readonly throughDate: string;
  /** Omission is materially different from an entered zero balance. */
  readonly openingBalanceIls?: ProvenancedNumber | undefined;
  readonly dangerThresholdIls: ProvenancedNumber;
  readonly monthlyIncomeIls: ProvenancedNumber;
  readonly currentMonthlyObligationsIls: ProvenancedNumber;
  readonly prospectiveMonthlyObligationIls: ProvenancedNumber;
  readonly safeLoadRatio: ProvenancedNumber;
  readonly salaries: readonly PlanningSalary[];
  readonly billings: readonly PlanningBilling[];
  readonly commitments: readonly PlanningCommitment[];
}

export interface BillingCluster {
  readonly date: string;
  readonly billingIds: readonly string[];
  readonly totalBillingIls: ProvenancedNumber;
}

export interface PlanningDay {
  readonly date: string;
  readonly salaryInflowIls: ProvenancedNumber;
  readonly billingOutflowIls: ProvenancedNumber;
  readonly commitmentOutflowIls: ProvenancedNumber;
  readonly totalOutflowIls: ProvenancedNumber;
  readonly projectedBalanceIls?: ProvenancedNumber;
  readonly riskLevel: PlanningRiskLevel;
  readonly billingCluster: boolean;
}

export interface PressureSummary {
  readonly totalSalaryInflowsIls: ProvenancedNumber;
  readonly totalBillingOutflowsIls: ProvenancedNumber;
  readonly totalCommitmentOutflowsIls: ProvenancedNumber;
  readonly totalOutflowsIls: ProvenancedNumber;
  readonly nextSalaryDate?: string;
  /** Includes outflows on the salary date: same-day ordering is not known, so this is conservative. */
  readonly outflowsThroughNextSalaryIls: ProvenancedNumber;
  readonly balanceBeforeNextSalaryIls?: ProvenancedNumber;
  readonly lowestProjectedBalanceIls?: ProvenancedNumber;
  readonly lowestBalanceDate?: string;
}

export type WaitUntilBillingDetermination =
  | {
      readonly decision: 'WAIT_UNTIL_BILLING';
      readonly billingDate: string;
      readonly loadRatioBeforeBilling: ProvenancedNumber;
      readonly loadRatioAfterBilling: ProvenancedNumber;
    }
  | {
      readonly decision: 'NO_WAIT_NEEDED';
      readonly loadRatioNow: ProvenancedNumber;
    }
  | {
      readonly decision: 'BILLING_DOES_NOT_MAKE_SAFE';
      readonly loadRatioNow: ProvenancedNumber;
      readonly lowestPostBillingLoadRatio: ProvenancedNumber;
    };

export interface RiskPlanningResult {
  readonly days: readonly PlanningDay[];
  readonly billingClusters: readonly BillingCluster[];
  readonly pressure: PressureSummary;
  readonly waitUntilBilling: WaitUntilBillingDetermination;
  readonly trace: ReasonTrace;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Operational input bound: a planning projection is at most one leap year, not an unbounded array. */
const MAX_PROJECTION_DAYS = 366;

function assertUsableNonNegative(label: string, number: ProvenancedNumber): void {
  if (!Number.isFinite(number.value) || number.value < 0) {
    throw new Error(label + ': refusing a negative or non-finite monetary input');
  }
  if (number.provenance === 'UNKNOWN') {
    throw new Error(label + ': UNKNOWN cannot accompany a calculable number');
  }
}

function assertUsableFinite(label: string, number: ProvenancedNumber): void {
  if (!Number.isFinite(number.value)) {
    throw new Error(label + ': refusing a non-finite monetary input');
  }
  if (number.provenance === 'UNKNOWN') {
    throw new Error(label + ': UNKNOWN cannot accompany a calculable number');
  }
}

function assertId(label: string, id: string): void {
  if (!id.trim()) throw new Error(label + ': expected a non-empty id');
}

function parseDate(label: string, value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(label + ': expected a strict yyyy-mm-dd date');
  }
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(label + ': expected a real UTC calendar date');
  }
  return date;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sumAmounts<T>(items: readonly T[], amountOf: (item: T) => number): number {
  return items.reduce((sum, item) => sum + amountOf(item), 0);
}

/** Project billing pressure and salary timing without mutating the caller's vault data. */
export function evaluateRiskPlanning(input: RiskPlanningInput): RiskPlanningResult {
  const start = parseDate('asOfDate', input.asOfDate);
  const end = parseDate('throughDate', input.throughDate);
  const projectionDays = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (projectionDays <= 0 || projectionDays > MAX_PROJECTION_DAYS) {
    throw new Error('date range: expected an inclusive projection of 1 to 366 days');
  }

  if (input.openingBalanceIls !== undefined) {
    // A negative entered balance is a real Israeli overdraft state (מינוס), not invalid data.
    assertUsableFinite('openingBalanceIls', input.openingBalanceIls);
  }
  assertUsableNonNegative('dangerThresholdIls', input.dangerThresholdIls);
  assertUsableNonNegative('monthlyIncomeIls', input.monthlyIncomeIls);
  if (input.monthlyIncomeIls.value === 0) {
    throw new Error('monthlyIncomeIls: zero income cannot produce a load ratio');
  }
  assertUsableNonNegative('currentMonthlyObligationsIls', input.currentMonthlyObligationsIls);
  assertUsableNonNegative(
    'prospectiveMonthlyObligationIls',
    input.prospectiveMonthlyObligationIls,
  );
  assertUsableNonNegative('safeLoadRatio', input.safeLoadRatio);
  if (input.safeLoadRatio.value > 1) {
    throw new Error('safeLoadRatio: expected a ratio from 0 through 1');
  }

  const inRange = (label: string, value: string): void => {
    const date = parseDate(label, value);
    if (date.getTime() < start.getTime() || date.getTime() > end.getTime()) {
      throw new Error(label + ': event falls outside the projection range');
    }
  };
  const seenIds = new Set<string>();
  const validateUniqueId = (kind: string, id: string): void => {
    assertId(kind + ' id', id);
    const scopedId = kind + ':' + id;
    if (seenIds.has(scopedId)) throw new Error(id + ': duplicate ' + kind + ' id');
    seenIds.add(scopedId);
  };

  for (const salary of input.salaries) {
    validateUniqueId('salary', salary.salaryId);
    inRange(salary.salaryId + ' date', salary.date);
    assertUsableNonNegative(salary.salaryId + ' amountIls', salary.amountIls);
  }
  for (const billing of input.billings) {
    validateUniqueId('billing', billing.billingId);
    inRange(billing.billingId + ' date', billing.date);
    assertUsableNonNegative(billing.billingId + ' amountIls', billing.amountIls);
    assertUsableNonNegative(
      billing.billingId + ' monthlyObligationsEndingIls',
      billing.monthlyObligationsEndingIls,
    );
  }
  for (const commitment of input.commitments) {
    validateUniqueId('commitment', commitment.commitmentId);
    inRange(commitment.commitmentId + ' date', commitment.date);
    assertUsableNonNegative(commitment.commitmentId + ' amountIls', commitment.amountIls);
  }

  const salariesByDate = new Map<string, PlanningSalary[]>();
  const billingsByDate = new Map<string, PlanningBilling[]>();
  const commitmentsByDate = new Map<string, PlanningCommitment[]>();
  const indexByDate = <T extends { readonly date: string }>(
    items: readonly T[],
    index: Map<string, T[]>,
  ): void => {
    for (const item of items) index.set(item.date, [...(index.get(item.date) ?? []), item]);
  };
  indexByDate(input.salaries, salariesByDate);
  indexByDate(input.billings, billingsByDate);
  indexByDate(input.commitments, commitmentsByDate);

  const billingClusters: BillingCluster[] = [...billingsByDate.entries()]
    .filter(([, billings]) => billings.length > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, billings]) => ({
      date,
      billingIds: billings.map((billing) => billing.billingId).sort(),
      totalBillingIls: provenanced(
        sumAmounts(billings, (billing) => billing.amountIls.value),
        'ESTIMATE',
      ),
    }));
  const clusterDates = new Set(billingClusters.map((cluster) => cluster.date));

  let projectedBalance = input.openingBalanceIls?.value;
  const days: PlanningDay[] = [];
  for (let offset = 0; offset < projectionDays; offset += 1) {
    const date = dateKey(new Date(start.getTime() + offset * DAY_MS));
    const salaries = salariesByDate.get(date) ?? [];
    const billings = billingsByDate.get(date) ?? [];
    const commitments = commitmentsByDate.get(date) ?? [];
    const salaryInflow = sumAmounts(salaries, (salary) => salary.amountIls.value);
    const billingOutflow = sumAmounts(billings, (billing) => billing.amountIls.value);
    const commitmentOutflow = sumAmounts(
      commitments,
      (commitment) => commitment.amountIls.value,
    );
    const totalOutflow = billingOutflow + commitmentOutflow;
    if (projectedBalance !== undefined) projectedBalance += salaryInflow - totalOutflow;

    let riskLevel: PlanningRiskLevel;
    if (projectedBalance === undefined) riskLevel = 'unknown';
    else if (projectedBalance < 0) riskLevel = 'critical';
    else if (projectedBalance < input.dangerThresholdIls.value) riskLevel = 'high';
    else if (clusterDates.has(date)) riskLevel = 'caution';
    else riskLevel = 'safe';

    days.push({
      date,
      salaryInflowIls: provenanced(salaryInflow, 'ESTIMATE'),
      billingOutflowIls: provenanced(billingOutflow, 'ESTIMATE'),
      commitmentOutflowIls: provenanced(commitmentOutflow, 'ESTIMATE'),
      totalOutflowIls: provenanced(totalOutflow, 'ESTIMATE'),
      ...(projectedBalance === undefined
        ? {}
        : { projectedBalanceIls: provenanced(projectedBalance, 'ESTIMATE') }),
      riskLevel,
      billingCluster: clusterDates.has(date),
    });
  }

  const sortedSalaryDates = [...salariesByDate.keys()].sort();
  const nextSalaryDate = sortedSalaryDates[0];
  const outflowsThroughNextSalary = nextSalaryDate === undefined
    ? 0
    : days
      .filter((day) => day.date <= nextSalaryDate)
      .reduce((sum, day) => sum + day.totalOutflowIls.value, 0);
  const balanceBeforeNextSalary = nextSalaryDate === undefined || input.openingBalanceIls === undefined
    ? undefined
    : input.openingBalanceIls.value - outflowsThroughNextSalary;
  const daysWithBalance = days.filter(
    (day): day is PlanningDay & { readonly projectedBalanceIls: ProvenancedNumber } =>
      day.projectedBalanceIls !== undefined,
  );
  const lowestDay = daysWithBalance.reduce<
    (PlanningDay & { readonly projectedBalanceIls: ProvenancedNumber }) | undefined
  >((lowest, day) => (
    lowest === undefined || day.projectedBalanceIls.value < lowest.projectedBalanceIls.value
      ? day
      : lowest
  ), undefined);

  const totalSalaryInflows = sumAmounts(input.salaries, (salary) => salary.amountIls.value);
  const totalBillingOutflows = sumAmounts(input.billings, (billing) => billing.amountIls.value);
  const totalCommitmentOutflows = sumAmounts(
    input.commitments,
    (commitment) => commitment.amountIls.value,
  );
  const pressure: PressureSummary = {
    totalSalaryInflowsIls: provenanced(totalSalaryInflows, 'ESTIMATE'),
    totalBillingOutflowsIls: provenanced(totalBillingOutflows, 'ESTIMATE'),
    totalCommitmentOutflowsIls: provenanced(totalCommitmentOutflows, 'ESTIMATE'),
    totalOutflowsIls: provenanced(totalBillingOutflows + totalCommitmentOutflows, 'ESTIMATE'),
    ...(nextSalaryDate === undefined ? {} : { nextSalaryDate }),
    outflowsThroughNextSalaryIls: provenanced(outflowsThroughNextSalary, 'ESTIMATE'),
    ...(balanceBeforeNextSalary === undefined
      ? {}
      : { balanceBeforeNextSalaryIls: provenanced(balanceBeforeNextSalary, 'ESTIMATE') }),
    ...(lowestDay === undefined
      ? {}
      : {
          lowestProjectedBalanceIls: lowestDay.projectedBalanceIls,
          lowestBalanceDate: lowestDay.date,
        }),
  };

  const loadNow = (
    input.currentMonthlyObligationsIls.value + input.prospectiveMonthlyObligationIls.value
  ) / input.monthlyIncomeIls.value;
  const loadRatioNow = provenanced(loadNow, 'ESTIMATE');
  let waitUntilBilling: WaitUntilBillingDetermination;
  if (loadNow <= input.safeLoadRatio.value) {
    waitUntilBilling = { decision: 'NO_WAIT_NEEDED', loadRatioNow };
  } else {
    const billings = [...input.billings].sort((left, right) => (
      left.date.localeCompare(right.date) || left.billingId.localeCompare(right.billingId)
    ));
    let remainingMonthly = input.currentMonthlyObligationsIls.value
      + input.prospectiveMonthlyObligationIls.value;
    let lowestRatio = loadNow;
    let wait: Extract<WaitUntilBillingDetermination, { decision: 'WAIT_UNTIL_BILLING' }>
      | undefined;
    let index = 0;
    while (index < billings.length) {
      const billingDate = billings[index]!.date;
      let ending = 0;
      while (index < billings.length && billings[index]!.date === billingDate) {
        ending += billings[index]!.monthlyObligationsEndingIls.value;
        index += 1;
      }
      const ratioBefore = remainingMonthly / input.monthlyIncomeIls.value;
      remainingMonthly = Math.max(0, remainingMonthly - ending);
      const ratioAfter = remainingMonthly / input.monthlyIncomeIls.value;
      lowestRatio = Math.min(lowestRatio, ratioAfter);
      if (wait === undefined && ratioAfter <= input.safeLoadRatio.value) {
        wait = {
          decision: 'WAIT_UNTIL_BILLING',
          billingDate,
          loadRatioBeforeBilling: provenanced(ratioBefore, 'ESTIMATE'),
          loadRatioAfterBilling: provenanced(ratioAfter, 'ESTIMATE'),
        };
      }
    }
    waitUntilBilling = wait ?? {
      decision: 'BILLING_DOES_NOT_MAKE_SAFE',
      loadRatioNow,
      lowestPostBillingLoadRatio: provenanced(lowestRatio, 'ESTIMATE'),
    };
  }

  return {
    days,
    billingClusters,
    pressure,
    waitUntilBilling,
    trace: trace('risk', [
      step(
        'product spec §20.6 billing clustering',
        'grouped billing events by their exact UTC date and summed each same-date cluster',
        ['billings'],
      ),
      step(
        'product spec §20.6 salary timing and per-day risk',
        'applied dated salary inflows and known outflows to each day; omitted balance-derived '
          + 'risk when the optional opening balance was absent',
        ['openingBalanceIls', 'dangerThresholdIls', 'salaries', 'billings', 'commitments'],
      ),
      step(
        'product spec §20.6 wait-until-billing',
        'tested chronologically whether monthly obligations ending on a billing date move the '
          + 'projected load to or below the supplied safe ratio',
        [
          'currentMonthlyObligationsIls',
          'prospectiveMonthlyObligationIls',
          'monthlyIncomeIls',
          'safeLoadRatio',
        ],
      ),
    ]),
  };
}
