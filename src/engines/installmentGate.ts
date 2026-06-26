import type {
  Installment,
  InstallmentDecision,
  InstallmentRequest,
  MonthlyImpact,
} from '../types/installment.types';
import { InstallmentWarningLevel } from '../types/installment.types';
import { isValidMonetaryAmount } from '../utils/monetary';

const MONTHS_TO_PROJECT = 3;
const WARNING_THRESHOLD = 0.25;
const STRONG_WARNING_THRESHOLD = 0.35;
const BLOCKED_THRESHOLD = 0.5;

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isValidRequest(request: InstallmentRequest): boolean {
  return (
    request.purchaseId.trim().length > 0 &&
    request.billingCardId.trim().length > 0 &&
    isValidMonetaryAmount(request.totalAmount) &&
    Number.isInteger(request.numPayments) &&
    request.numPayments >= 2 &&
    Number.isInteger(request.billingDayOfMonth) &&
    request.billingDayOfMonth >= 1 &&
    request.billingDayOfMonth <= 31
  );
}

function getActiveMonthlyLoad(
  existingInstallments: readonly Installment[],
): number {
  return existingInstallments.reduce((sum: number, installment: Installment): number => {
    if (
      installment.paymentsRemaining <= 0 ||
      !isValidMonetaryAmount(installment.monthlyPayment)
    ) {
      return sum;
    }

    return sum + installment.monthlyPayment;
  }, 0);
}

function getProjectedExistingLoad(
  existingInstallments: readonly Installment[],
  monthOffset: number,
): number {
  return existingInstallments.reduce((sum: number, installment: Installment): number => {
    if (
      installment.paymentsRemaining < monthOffset ||
      !isValidMonetaryAmount(installment.monthlyPayment)
    ) {
      return sum;
    }

    return sum + installment.monthlyPayment;
  }, 0);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getWarningLevel(loadRatio: number): InstallmentWarningLevel {
  if (loadRatio > BLOCKED_THRESHOLD) {
    return InstallmentWarningLevel.Blocked;
  }

  if (loadRatio > STRONG_WARNING_THRESHOLD) {
    return InstallmentWarningLevel.Strong;
  }

  if (loadRatio >= WARNING_THRESHOLD) {
    return InstallmentWarningLevel.Warning;
  }

  return InstallmentWarningLevel.None;
}

function buildImpact(
  existingInstallments: readonly Installment[],
  monthlyAddition: number,
  numPayments: number,
  monthlyIncome: number,
): readonly MonthlyImpact[] {
  return Array.from(
    { length: MONTHS_TO_PROJECT },
    (_value: unknown, index: number): MonthlyImpact => {
      const monthOffset = index + 1;
      const requestLoad = numPayments >= monthOffset ? monthlyAddition : 0;
      const projectedMonthlyLoad = roundMoney(
        getProjectedExistingLoad(existingInstallments, monthOffset) + requestLoad,
      );

      return {
        monthOffset,
        projectedMonthlyLoad,
        loadRatio: monthlyIncome > 0 ? projectedMonthlyLoad / monthlyIncome : 1,
      };
    },
  );
}

function buildDecision(
  approved: boolean,
  warningLevel: InstallmentWarningLevel,
  monthlyAddition: number,
  totalCost: number,
  resultingLoadRatio: number,
  threeMonthImpact: readonly MonthlyImpact[],
  reason: string,
  reasonAr: string,
): InstallmentDecision {
  return {
    approved,
    warningLevel,
    monthlyAddition,
    totalCost,
    resultingLoadRatio,
    threeMonthImpact,
    reason,
    reasonAr,
  };
}

export function evaluateInstallment(
  installmentRequest: InstallmentRequest,
  existingInstallments: readonly Installment[],
  monthlyIncome: number,
): InstallmentDecision {
  if (!isValidRequest(installmentRequest) || !isValidMonetaryAmount(monthlyIncome)) {
    return buildDecision(
      false,
      InstallmentWarningLevel.Blocked,
      0,
      Math.max(0, installmentRequest.totalAmount),
      1,
      buildImpact(existingInstallments, 0, 0, monthlyIncome),
      'בקשת התשלומים לא תקינה או שההכנסה החודשית חסרה, ולכן לא ניתן לאשר אותה.',
      'طلب التقسيط غير صالح أو الدخل الشهري غير متوفر، لذلك لا يمكن الموافقة عليه.',
    );
  }

  const monthlyAddition = roundMoney(
    installmentRequest.totalAmount / installmentRequest.numPayments,
  );
  const currentMonthlyLoad = getActiveMonthlyLoad(existingInstallments);
  const resultingMonthlyLoad = currentMonthlyLoad + monthlyAddition;
  const resultingLoadRatio = resultingMonthlyLoad / monthlyIncome;
  const warningLevel = getWarningLevel(resultingLoadRatio);
  const threeMonthImpact = buildImpact(
    existingInstallments,
    monthlyAddition,
    installmentRequest.numPayments,
    monthlyIncome,
  );

  if (warningLevel === InstallmentWarningLevel.Blocked) {
    return buildDecision(
      false,
      warningLevel,
      monthlyAddition,
      installmentRequest.totalAmount,
      resultingLoadRatio,
      threeMonthImpact,
      'עומס התשלומים לאחר העסקה יעבור 50% מההכנסה החודשית. עדיף לא לפתוח את התשלום הזה עכשיו.',
      'عبء الأقساط بعد العملية سيتجاوز 50% من الدخل الشهري. من الأفضل عدم فتح هذا التقسيط الآن.',
    );
  }

  if (warningLevel === InstallmentWarningLevel.Strong) {
    return buildDecision(
      true,
      warningLevel,
      monthlyAddition,
      installmentRequest.totalAmount,
      resultingLoadRatio,
      threeMonthImpact,
      'עומס התשלומים יהיה בין 35% ל-50% מההכנסה. זו אזהרה חזקה, וכדאי לבדוק את השפעת שלושת החודשים הקרובים.',
      'عبء الأقساط سيكون بين 35% و50% من الدخل. هذا تحذير قوي ويجب فحص أثر الأشهر الثلاثة القادمة.',
    );
  }

  if (warningLevel === InstallmentWarningLevel.Warning) {
    return buildDecision(
      true,
      warningLevel,
      monthlyAddition,
      installmentRequest.totalAmount,
      resultingLoadRatio,
      threeMonthImpact,
      'עומס התשלומים יהיה בין 25% ל-35% מההכנסה. ניתן להמשיך, אבל חשוב להשאיר מרווח ביטחון.',
      'عبء الأقساط سيكون بين 25% و35% من الدخل. يمكن المتابعة، لكن من المهم ترك هامش أمان.',
    );
  }

  return buildDecision(
    true,
    InstallmentWarningLevel.None,
    monthlyAddition,
    installmentRequest.totalAmount,
    resultingLoadRatio,
    threeMonthImpact,
    'עומס התשלומים נשאר מתחת ל-25% מההכנסה החודשית.',
    'يبقى عبء الأقساط أقل من 25% من الدخل الشهري.',
  );
}
