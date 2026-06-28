import type {
  ChargeReturnRisk,
  DayBalance,
  MonthInput,
  Obligation,
  RiskScore,
} from '../types/cashflow.types';
import { RiskLevel } from '../types/cashflow.types';
import type { CardInput } from '../types/card.types';
import { isValidMonetaryAmount } from '../utils/monetary';

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

function invalidProjection(month: MonthInput): readonly DayBalance[] {
  return Array.from(
    { length: getProjectionDays(month) },
    (_value: unknown, index: number): DayBalance => {
      const date = getProjectedDate(month, index);

      return {
        date: formatIsoDate(date),
        dayOfMonth: date.getUTCDate(),
        projectedBalance: 0,
        outflow: 0,
        inflow: 0,
        isOverdraft: false,
        belowDanger: month.dangerThreshold > 0,
      };
    },
  );
}

function getEffectiveDayOfMonth(
  obligation: Obligation,
  year: number,
  month: number,
): number {
  return Math.min(obligation.dayOfMonth, getDaysInMonth(year, month));
}

function isObligationDueOnDate(obligation: Obligation, date: Date): boolean {
  if (
    !isValidDayOfMonth(obligation.dayOfMonth) ||
    !isValidMonetaryAmount(obligation.amount)
  ) {
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
    if (!isObligationDueOnDate(obligation, date)) {
      return sum;
    }

    return sum + obligation.amount;
  }, 0);
}

function getLoanOutflow(loanObligations: number, date: Date): number {
  if (
    date.getUTCDate() !== 1 ||
    !isFiniteAmount(loanObligations) ||
    loanObligations < 0
  ) {
    return 0;
  }

  return loanObligations;
}

function getDailyInflow(month: MonthInput, date: Date): number {
  if (
    !isValidDayOfMonth(month.incomeDayOfMonth) ||
    !isValidMonetaryAmount(month.monthlyIncome)
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

function hasChargeReturnRiskWithinSevenDays(
  month: MonthInput,
  loanObligations: number = 0,
): boolean {
  const projection = getDailyProjection(month, loanObligations);

  return projection
    .slice(0, CHARGE_RETURN_WINDOW_DAYS)
    .some((day: DayBalance): boolean => day.projectedBalance < 0);
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 75) {
    return RiskLevel.Critical;
  }

  if (score >= 50) {
    return RiskLevel.Elevated;
  }

  if (score >= 25) {
    return RiskLevel.Caution;
  }

  return RiskLevel.Safe;
}

function noChargeReturnRisk(): ChargeReturnRisk {
  return {
    atRisk: false,
    cardId: null,
    chargeAmount: 0,
    projectedBalanceOnDate: 0,
    shortfall: 0,
    billingDate: '',
    reason: 'לא זוהה סיכון לחזרת חיוב.',
    reasonAr: 'لم يتم رصد خطر رجوع دفعة.',
  };
}

function getObligationsDueBeforeBilling(
  obligations: readonly Obligation[],
  billingDayOfMonth: number,
): number {
  return obligations.reduce((sum: number, obligation: Obligation): number => {
    if (
      !isValidDayOfMonth(obligation.dayOfMonth) ||
      obligation.dayOfMonth >= billingDayOfMonth ||
      !isValidMonetaryAmount(obligation.amount)
    ) {
      return sum;
    }

    return sum + obligation.amount;
  }, 0);
}

function formatBillingDate(billingDayOfMonth: number): string {
  return `day-${billingDayOfMonth.toString().padStart(2, '0')}`;
}

export function getDailyProjection(
  month: MonthInput,
  loanObligations: number = 0,
): readonly DayBalance[] {
  if (
    !isValidMonetaryAmount(month.openingBalance) ||
    !isValidMonetaryAmount(month.monthlyIncome)
  ) {
    return invalidProjection(month);
  }

  let projectedBalance = month.openingBalance;

  return Array.from(
    { length: getProjectionDays(month) },
    (_value: unknown, index: number): DayBalance => {
      const date = getProjectedDate(month, index);
      const inflow = getDailyInflow(month, date);
      const outflow =
        getDailyOutflow(month.obligations, date) +
        getLoanOutflow(loanObligations, date);

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
        !isValidMonetaryAmount(obligation.amount) ||
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

  if (
    !isValidMonetaryAmount(month.openingBalance) ||
    !isValidMonetaryAmount(month.monthlyIncome)
  ) {
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

export function predictChargeReturn(
  cards: readonly CardInput[],
  obligations: readonly Obligation[],
  balance: number,
): ChargeReturnRisk {
  if (!isValidMonetaryAmount(balance)) {
    return noChargeReturnRisk();
  }

  const sortedCards = cards
    .filter((card: CardInput): boolean =>
      isValidDayOfMonth(card.billingCycle.billingDayOfMonth) &&
      isValidMonetaryAmount(card.framework.currentBalance),
    )
    .slice()
    .sort((left: CardInput, right: CardInput): number =>
      left.billingCycle.billingDayOfMonth - right.billingCycle.billingDayOfMonth,
    );

  for (const card of sortedCards) {
    const billingDay = card.billingCycle.billingDayOfMonth;
    const obligationsBeforeBilling = getObligationsDueBeforeBilling(
      obligations,
      billingDay,
    );
    const projectedBalanceOnDate = balance - obligationsBeforeBilling;
    const chargeAmount = card.framework.currentBalance;

    if (projectedBalanceOnDate < chargeAmount) {
      return {
        atRisk: true,
        cardId: card.cardId,
        chargeAmount,
        projectedBalanceOnDate,
        shortfall: chargeAmount - projectedBalanceOnDate,
        billingDate: formatBillingDate(billingDay),
        reason: 'קיים סיכון לחזרת חיוב במועד החיוב של הכרטיס.',
        reasonAr: 'هناك خطر رجوع دفعة في موعد خصم البطاقة.',
      };
    }
  }

  return noChargeReturnRisk();
}

export function calculateMonthlyRisk(
  month: MonthInput,
  loanObligations: number = 0,
): RiskScore {
  const projection = getDailyProjection(month, loanObligations);
  const fallbackDay = projection[0];
  const lowestDay = projection.reduce(
    (lowest: DayBalance | undefined, day: DayBalance): DayBalance =>
      lowest === undefined || day.projectedBalance < lowest.projectedBalance
        ? day
        : lowest,
    fallbackDay,
  );
  const lowestProjectedBalance = lowestDay?.projectedBalance ?? 0;
  const lowestBalanceDate = lowestDay?.date ?? '';
  const daysBelowDanger = projection.filter(
    (day: DayBalance): boolean => day.belowDanger,
  ).length;
  const hasOverdraftRisk = detectMinus(projection);
  const hasChargeReturnRisk = hasChargeReturnRiskWithinSevenDays(
    month,
    loanObligations,
  );

  let score = 0;

  if (hasOverdraftRisk) {
    score += 45;
  }

  if (hasChargeReturnRisk) {
    score += 35;
  }

  if (daysBelowDanger > 0) {
    score += Math.min(20, daysBelowDanger * 2);
  }

  if (lowestProjectedBalance < 0) {
    score += Math.min(20, Math.ceil(Math.abs(lowestProjectedBalance) / 500));
  }

  const normalizedScore = Math.min(100, score);

  if (normalizedScore >= 75) {
    return {
      score: normalizedScore,
      level: getRiskLevel(normalizedScore),
      lowestProjectedBalance,
      lowestBalanceDate,
      hasOverdraftRisk,
      daysBelowDanger,
      reason: 'סיכון תזרימי קריטי החודש.',
      reasonAr: 'خطر نقدي حرج هذا الشهر.',
    };
  }

  if (normalizedScore >= 50) {
    return {
      score: normalizedScore,
      level: getRiskLevel(normalizedScore),
      lowestProjectedBalance,
      lowestBalanceDate,
      hasOverdraftRisk,
      daysBelowDanger,
      reason: 'סיכון תזרימי מוגבר החודש.',
      reasonAr: 'خطر نقدي مرتفع هذا الشهر.',
    };
  }

  if (normalizedScore >= 25) {
    return {
      score: normalizedScore,
      level: getRiskLevel(normalizedScore),
      lowestProjectedBalance,
      lowestBalanceDate,
      hasOverdraftRisk,
      daysBelowDanger,
      reason: 'כדאי לעקוב אחרי התזרים החודשי.',
      reasonAr: 'من الأفضل متابعة التدفق النقدي الشهري.',
    };
  }

  return {
    score: normalizedScore,
    level: RiskLevel.Safe,
    lowestProjectedBalance,
    lowestBalanceDate,
    hasOverdraftRisk,
    daysBelowDanger,
    reason: 'התזרים החודשי נראה יציב.',
    reasonAr: 'يبدو التدفق النقدي الشهري مستقراً.',
  };
}
