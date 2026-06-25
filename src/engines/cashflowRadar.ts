import type {
  DayBalance,
  MonthInput,
  Obligation,
} from '../types/cashflow.types';

const PROJECTION_DAYS = 30;
const CHARGE_RETURN_WINDOW_DAYS = 7;

function isFiniteAmount(value: number): boolean {
  return Number.isFinite(value);
}

function isValidDayOfMonth(dayOfMonth: number): boolean {
  return (
    Number.isInteger(dayOfMonth) &&
    dayOfMonth >= 1 &&
    dayOfMonth <= 31
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getProjectionDays(month: MonthInput): number {
  return Math.max(PROJECTION_DAYS, getDaysInMonth(month.year, month.month));
}

function getProjectedDate(month: MonthInput, offsetDays: number): Date {
  return new Date(Date.UTC(month.year, month.month - 1, 1 + offsetDays));
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getEffectiveDayOfMonth(
  obligation: Obligation,
  year: number,
  month: number,
): number {
  return Math.min(obligation.dayOfMonth, getDaysInMonth(year, month));
}

function isObligationDueOnDate(obligation: Obligation, date: Date): boolean {
  if (!isValidDayOfMonth(obligation.dayOfMonth) || !isFiniteAmount(obligation.amount)) {
    return false;
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const effectiveDay = getEffectiveDayOfMonth(obligation, year, month);

  return date.getUTCDate() === effectiveDay;
}

function getDailyOutflow(
  obligations: readonly Obligation[],
  date: Date,
): number {
  return obligations.reduce((sum: number, obligation: Obligation): number => {
    if (!isObligationDueOnDate(obligation, date) || obligation.amount <= 0) {
      return sum;
    }

    return sum + obligation.amount;
  }, 0);
}

function getDailyInflow(month: MonthInput, date: Date): number {
  if (
    !isValidDayOfMonth(month.incomeDayOfMonth) ||
    !isFiniteAmount(month.monthlyIncome) ||
    month.monthlyIncome <= 0
  ) {
    return 0;
  }

  const year = date.getUTCFullYear();
  const calendarMonth = date.getUTCMonth() + 1;
  const incomeDay = Math.min(
    month.incomeDayOfMonth,
    getDaysInMonth(year, calendarMonth),
  );

  return date.getUTCDate() === incomeDay ? month.monthlyIncome : 0;
}

function getDueDateForObligation(month: MonthInput, obligation: Obligation): Date {
  const firstCandidateDay = getEffectiveDayOfMonth(
    obligation,
    month.year,
    month.month,
  );
  const firstCandidate = new Date(
    Date.UTC(month.year, month.month - 1, firstCandidateDay),
  );
  const windowStart = getProjectedDate(month, 0);

  if (firstCandidate.getTime() >= windowStart.getTime()) {
    return firstCandidate;
  }

  const nextMonthDate = new Date(Date.UTC(month.year, month.month, 1));
  const nextYear = nextMonthDate.getUTCFullYear();
  const nextMonth = nextMonthDate.getUTCMonth() + 1;
  const nextCandidateDay = getEffectiveDayOfMonth(
    obligation,
    nextYear,
    nextMonth,
  );

  return new Date(Date.UTC(nextYear, nextMonth - 1, nextCandidateDay));
}

function hasChargeReturnRiskWithinSevenDays(month: MonthInput): boolean {
  const projection = getDailyProjection(month);

  return projection
    .slice(0, CHARGE_RETURN_WINDOW_DAYS)
    .some((day: DayBalance): boolean => day.projectedBalance < 0);
}

export function getDailyProjection(month: MonthInput): readonly DayBalance[] {
  let projectedBalance = isFiniteAmount(month.openingBalance)
    ? month.openingBalance
    : 0;

  return Array.from(
    { length: getProjectionDays(month) },
    (_value: unknown, index: number): DayBalance => {
      const date = getProjectedDate(month, index);
      const inflow = getDailyInflow(month, date);
      const outflow = getDailyOutflow(month.obligations, date);

      projectedBalance += inflow - outflow;

      return {
        date: formatIsoDate(date),
        dayOfMonth: date.getUTCDate(),
        projectedBalance,
        outflow,
        inflow,
        isOverdraft: projectedBalance < 0,
        belowDanger: projectedBalance < month.dangerThreshold,
      };
    },
  );
}

export function detectMinus(projection: readonly DayBalance[]): boolean {
  return projection.some((day: DayBalance): boolean => day.projectedBalance < 0);
}

export function getUpcomingCharges(month: MonthInput): readonly Obligation[] {
  const windowEnd = getProjectedDate(month, getProjectionDays(month));

  return month.obligations
    .filter((obligation: Obligation): boolean => {
      if (
        obligation.amount <= 0 ||
        !isFiniteAmount(obligation.amount) ||
        !isValidDayOfMonth(obligation.dayOfMonth)
      ) {
        return false;
      }

      return getDueDateForObligation(month, obligation).getTime() < windowEnd.getTime();
    })
    .slice()
    .sort((left: Obligation, right: Obligation): number => {
      const leftTime = getDueDateForObligation(month, left).getTime();
      const rightTime = getDueDateForObligation(month, right).getTime();

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.obligationId.localeCompare(right.obligationId);
    });
}

export function getSafeSpendingLimit(month: MonthInput): number {
  if (!isFiniteAmount(month.openingBalance) || month.openingBalance < 0) {
    return 0;
  }

  if (!isFiniteAmount(month.monthlyIncome) || month.monthlyIncome <= 0) {
    return 0;
  }

  const projection = getDailyProjection(month);

  if (detectMinus(projection) || hasChargeReturnRiskWithinSevenDays(month)) {
    return 0;
  }

  const lowestProjectedBalance = projection.reduce(
    (lowest: number, day: DayBalance): number =>
      Math.min(lowest, day.projectedBalance),
    month.openingBalance,
  );
  const safeLimit = lowestProjectedBalance - Math.max(0, month.dangerThreshold);

  return Math.max(0, Math.round(safeLimit * 100) / 100);
}
