import { predictChargeReturn } from './cashflowRadar';
import type {
  PurchaseDecision,
  PurchaseGateInput,
} from '../types/decision.types';
import type { PurchaseInput } from '../types/purchase.types';
import { Currency } from '../types/purchase.types';
import { isValidMonetaryAmount } from '../utils/monetary';

const APPROVED_BUFFER_RATIO = 0.2;
const WARNING_MIN_BUFFER_RATIO = 0.05;
const WAIT_24H_MAX_BUFFER_RATIO = 0.15;
const BLOCKED_UTILIZATION_RATIO = 0.9;
const WARNING_UTILIZATION_RATIO = 0.7;

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

  if (
    card === undefined ||
    !isValidMonetaryAmount(card.framework.creditLimit) ||
    !Number.isFinite(card.framework.currentBalance) ||
    card.framework.currentBalance < 0
  ) {
    return null;
  }

  return (card.framework.currentBalance + input.amount) / card.framework.creditLimit;
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
    creditUtilization > BLOCKED_UTILIZATION_RATIO
  ) {
    return buildDecision(
      'blocked',
      'ניצול מסגרת האשראי יעבור 90%, ולכן הרכישה חסומה.',
      'سيتجاوز استخدام إطار الائتمان 90%، لذلك تم حظر الشراء.',
      input.currency,
      exchangeFeeWarning,
    );
  }

  const postPurchaseBuffer = gateInput.remainingBalance - input.amount;
  const bufferRatio = postPurchaseBuffer / gateInput.monthlyIncome;

  if (bufferRatio < WARNING_MIN_BUFFER_RATIO) {
    return buildDecision(
      'blocked',
      'מרווח הביטחון אחרי הרכישה נמוך מ-5% מההכנסה.',
      'هامش الأمان بعد الشراء أقل من 5% من الدخل.',
      input.currency,
      exchangeFeeWarning,
    );
  }

  if (
    !input.isEssential &&
    bufferRatio >= WARNING_MIN_BUFFER_RATIO &&
    bufferRatio <= WAIT_24H_MAX_BUFFER_RATIO
  ) {
    return buildDecision(
      'wait_24h',
      'הרכישה אינה חיונית ומרווח הביטחון צפוף. כדאי להמתין 24 שעות.',
      'الشراء غير ضروري وهامش الأمان ضيق. من الأفضل الانتظار 24 ساعة.',
      input.currency,
      exchangeFeeWarning,
    );
  }

  if (
    creditUtilization !== null &&
    creditUtilization > WARNING_UTILIZATION_RATIO
  ) {
    return buildDecision(
      'warning',
      'ניצול מסגרת האשראי יעבור 70%, מומלץ לשקול כרטיס אחר.',
      'سيتجاوز استخدام إطار الائتمان 70%، يوصى بالتفكير ببطاقة أخرى.',
      input.currency,
      exchangeFeeWarning,
    );
  }

  if (bufferRatio <= APPROVED_BUFFER_RATIO) {
    return buildDecision(
      'warning',
      'מרווח הביטחון אחרי הרכישה הוא 5%-20% מההכנסה.',
      'هامش الأمان بعد الشراء بين 5% و20% من الدخل.',
      input.currency,
      exchangeFeeWarning,
    );
  }

  return buildDecision(
    'approved',
    'מרווח הביטחון אחרי הרכישה גבוה מ-20% מההכנסה.',
    'هامش الأمان بعد الشراء أعلى من 20% من الدخل.',
    input.currency,
    exchangeFeeWarning,
  );
}
