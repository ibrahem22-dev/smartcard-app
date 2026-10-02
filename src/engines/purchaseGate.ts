import { predictChargeReturn } from './cashflowRadar';
import type {
  PurchaseDecision,
  PurchaseGateInput,
} from '../types/decision.types';
import type { PurchaseInput } from '../types/purchase.types';
import { Currency } from '../types/purchase.types';
import { isValidMonetaryAmount } from '../utils/monetary';
import {
  PURCHASE_GATE_RULES,
  evaluateCashflowVerdict,
} from './purchaseGateRules';

// Cashflow thresholds now come from MVP_SCOPE §7.4 via purchaseGateRules.
// The former local constants (blocked <5%, wait_24h 5-15%, approved >20%)
// contradicted §7.4 and were superseded by the Owner decision.
const { blockedUtilizationRatio, warningUtilizationRatio } = PURCHASE_GATE_RULES;

function buildDecision(
  verdict: PurchaseDecision['verdict'],
  reason: string,
  reasonAr: string,
  currency: Currency,
  exchangeFeeWarning?: string,
): PurchaseDecision {
  const decision: PurchaseDecision = {
    verdict,
    reason,
    reasonAr,
    recommendedCard: null,
    savingsAmount: 0,
    currency,
  };

  return exchangeFeeWarning === undefined
    ? decision
    : { ...decision, exchangeFeeWarning };
}

function getSelectedCard(
  input: PurchaseInput,
  gateInput: PurchaseGateInput,
): PurchaseGateInput['availableCards'][number] | undefined {
  return gateInput.availableCards.find(
    availableCard => availableCard.cardId === input.cardId,
  );
}

function getExchangeFeeWarning(
  input: PurchaseInput,
  gateInput: PurchaseGateInput,
): string | undefined {
  if (!input.isInternational) {
    return undefined;
  }

  const card = getSelectedCard(input, gateInput);

  if (card === undefined || !Number.isFinite(card.foreignTransactionFee)) {
    return undefined;
  }

  const feePercent = (card.foreignTransactionFee * 100).toFixed(2);

  return `רכישה בחו"ל: בכרטיס זה עשויה לחול עמלת המרה של ${feePercent}%.`;
}

function getCardsWithPendingPurchase(
  input: PurchaseInput,
  gateInput: PurchaseGateInput,
): PurchaseGateInput['availableCards'] {
  return gateInput.availableCards.map((card): PurchaseGateInput['availableCards'][number] => {
    if (card.cardId !== input.cardId) {
      return card;
    }

    return {
      ...card,
      framework: {
        ...card.framework,
        currentBalance: card.framework.currentBalance + input.amount,
      },
    };
  });
}

function getCreditUtilizationAfterPurchase(
  input: PurchaseInput,
  gateInput: PurchaseGateInput,
): number | null {
  const card = getSelectedCard(input, gateInput);

  if (card === undefined) {
    return null;
  }

  const { creditLimit } = card.framework;
  const safeLimit = Math.min(creditLimit ?? 0, 9_999_999);

  if (
    !isValidMonetaryAmount(safeLimit) ||
    !Number.isFinite(card.framework.currentBalance) ||
    card.framework.currentBalance < 0
  ) {
    return null;
  }

  return (card.framework.currentBalance + input.amount) / safeLimit;
}

export function evaluatePurchase(
  input: PurchaseInput,
  gateInput: PurchaseGateInput,
): PurchaseDecision {
  if (!isValidMonetaryAmount(input.amount)) {
    return buildDecision(
      'blocked',
      'סכום הרכישה אינו תקין. הזן סכום בין ₪0.01 ל-₪999,999.',
      'مبلغ الشراء غير صالح. أدخل مبلغًا بين ₪0.01 و₪999,999.',
      input.currency,
    );
  }

  if (
    !isValidMonetaryAmount(gateInput.currentBalance) ||
    !isValidMonetaryAmount(gateInput.remainingBalance)
  ) {
    return buildDecision(
      'blocked',
      'נתוני התזרים אינם תקינים. לא ניתן לאשר את הרכישה.',
      'بيانات التدفق النقدي غير صالحة. لا يمكن الموافقة على الشراء.',
      input.currency,
    );
  }

  if (!isValidMonetaryAmount(gateInput.monthlyIncome)) {
    return buildDecision(
      'blocked',
      'הכנסה חודשית חסרה או לא תקינה. לא ניתן לאשר רכישה.',
      'الدخل الشهري مفقود أو غير صالح. لا يمكن الموافقة على الشراء.',
      input.currency,
    );
  }

  const exchangeFeeWarning = getExchangeFeeWarning(input, gateInput);

  const chargeReturnRisk = predictChargeReturn(
    getCardsWithPendingPurchase(input, gateInput),
    gateInput.obligations,
    gateInput.currentBalance,
  );

  if (chargeReturnRisk.atRisk) {
    return buildDecision(
      'blocked',
      chargeReturnRisk.reason,
      chargeReturnRisk.reasonAr,
      input.currency,
      exchangeFeeWarning,
    );
  }

  const creditUtilization = getCreditUtilizationAfterPurchase(input, gateInput);

  if (
    creditUtilization !== null &&
    creditUtilization > blockedUtilizationRatio
  ) {
    return buildDecision(
      'blocked',
      'ניצול מסגרת האשראי יעבור 90%, ולכן הרכישה חסומה.',
      'سيتجاوز استخدام إطار الائتمان 90%، لذلك تم حظر الشراء.',
      input.currency,
      exchangeFeeWarning,
    );
  }

  // MVP_SCOPE §7.4 cashflow verdict. Obligations still due this month are
  // charged against the projected balance, so a purchase the user can afford
  // today but not after the 28th is caught.
  const cashflow = evaluateCashflowVerdict({
    remainingBalance: gateInput.remainingBalance,
    monthlyIncome: gateInput.monthlyIncome,
    purchaseAmount: input.amount,
    isEssential: input.isEssential,
    obligations: gateInput.obligations,
    todayDayOfMonth: new Date(gateInput.snapshotDate).getDate(),
  });

  if (cashflow.verdict === 'blocked') {
    return buildDecision(
      'blocked',
      `היתרה הצפויה אחרי הרכישה והתחייבויות החודש שלילית (₪${cashflow.projectedBalance.toFixed(2)}).`,
      `الرصيد المتوقع بعد الشراء والالتزامات الشهرية سالب (₪${cashflow.projectedBalance.toFixed(2)}).`,
      input.currency,
      exchangeFeeWarning,
    );
  }

  if (cashflow.verdict === 'warning') {
    return buildDecision(
      'warning',
      'מרווח הביטחון אחרי הרכישה נמוך מ-10% מההכנסה החודשית.',
      'هامش الأمان بعد الشراء أقل من 10% من الدخل الشهري.',
      input.currency,
      exchangeFeeWarning,
    );
  }

  if (cashflow.verdict === 'wait_24h') {
    return buildDecision(
      'wait_24h',
      'רכישה לא חיונית בגובה 25% ומעלה מההכנסה החודשית. כדאי להמתין 24 שעות.',
      'شراء غير ضروري بقيمة 25% أو أكثر من الدخل الشهري. من الأفضل الانتظار 24 ساعة.',
      input.currency,
      exchangeFeeWarning,
    );
  }

  // Utilisation guard is additional to §7.4, not a competing cashflow rule.
  if (
    creditUtilization !== null &&
    creditUtilization > warningUtilizationRatio
  ) {
    return buildDecision(
      'warning',
      'ניצול מסגרת האשראי יעבור 70%, מומלץ לשקול כרטיס אחר.',
      'سيتجاوز استخدام إطار الائتمان 70%، يوصى بالتفكير ببطاقة أخرى.',
      input.currency,
      exchangeFeeWarning,
    );
  }

  return buildDecision(
    'approved',
    'הרכישה בתוך מרווח הביטחון וההתחייבויות הידועות של החודש.',
    'الشراء ضمن هامش الأمان والالتزامات المعروفة لهذا الشهر.',
    input.currency,
    exchangeFeeWarning,
  );
}
