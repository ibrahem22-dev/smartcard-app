import type { CashflowSnapshot } from '../types/cashflow.types';
import type { PurchaseDecision } from '../types/decision.types';
import type { PurchaseInput } from '../types/purchase.types';
import { Currency } from '../types/purchase.types';
import { isValidMonetaryAmount } from '../utils/monetary';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WAIT_24H_AMOUNT_THRESHOLD_ILS = 500;
const APPROVAL_BUFFER_MULTIPLIER = 1.2;

function isWithinLast24Hours(date: string | null, snapshotDate: string): boolean {
  if (date === null) {
    return false;
  }

  const timestamp = Date.parse(date);
  const snapshotTimestamp = Date.parse(snapshotDate);

  if (!Number.isFinite(timestamp) || !Number.isFinite(snapshotTimestamp)) {
    return false;
  }

  const elapsedMs = snapshotTimestamp - timestamp;

  return elapsedMs >= 0 && elapsedMs < DAY_IN_MS;
}

function getExchangeFeeWarning(
  input: PurchaseInput,
  cashflow: CashflowSnapshot,
): string | undefined {
  if (!input.isInternational) {
    return undefined;
  }

  const card = cashflow.availableCards.find(
    availableCard => availableCard.cardId === input.cardId,
  );

  if (card === undefined || !Number.isFinite(card.foreignTransactionFee)) {
    return undefined;
  }

  const feePercent = (card.foreignTransactionFee * 100).toFixed(2);

  return `רכישה בינלאומית: בכרטיס זה עשויה לחול עמלת המרה של ${feePercent}%.`;
}

function invalidAmountDecision(currency: Currency): PurchaseDecision {
  return {
    verdict: 'blocked',
    reason: 'סכום הרכישה אינו תקין. הזן סכום בין ₪0.01 ל-₪999,999.',
    reasonAr: 'مبلغ الشراء غير صالح. أدخل مبلغًا بين ₪0.01 و₪999,999.',
    recommendedCard: null,
    savingsAmount: 0,
    currency,
  };
}

export function evaluatePurchase(
  input: PurchaseInput,
  cashflow: CashflowSnapshot,
): PurchaseDecision {
  if (!isValidMonetaryAmount(input.amount)) {
    return invalidAmountDecision(input.currency);
  }

  const isLargeIlsPurchase =
    input.currency === Currency.ILS && input.amount > WAIT_24H_AMOUNT_THRESHOLD_ILS;
  const exchangeFeeWarning = getExchangeFeeWarning(input, cashflow);

  if (
    isWithinLast24Hours(cashflow.lastPurchaseDate, cashflow.snapshotDate) &&
    isLargeIlsPurchase
  ) {
    const decision: PurchaseDecision = {
      verdict: 'wait_24h',
      reason: 'בוצעה רכישה משמעותית ב-24 השעות האחרונות. כדאי להמתין לפני רכישה נוספת.',
      reasonAr: 'تمت عملية شراء كبيرة خلال آخر 24 ساعة. من الأفضل الانتظار قبل شراء إضافي.',
      recommendedCard: null,
      savingsAmount: 0,
      currency: input.currency,
    };

    return exchangeFeeWarning === undefined
      ? decision
      : { ...decision, exchangeFeeWarning };
  }

  if (cashflow.remainingBalance > input.amount * APPROVAL_BUFFER_MULTIPLIER) {
    const decision: PurchaseDecision = {
      verdict: 'approved',
      reason: 'היתרה הצפויה מספיקה לרכישה ומשאירה מרווח ביטחון.',
      reasonAr: 'الرصيد المتوقع يكفي للشراء ويترك هامش أمان.',
      recommendedCard: null,
      savingsAmount: 0,
      currency: input.currency,
    };

    return exchangeFeeWarning === undefined
      ? decision
      : { ...decision, exchangeFeeWarning };
  }

  if (cashflow.remainingBalance > input.amount) {
    const decision: PurchaseDecision = {
      verdict: 'warning',
      reason: 'היתרה הצפויה מספיקה לרכישה, אך מרווח הביטחון נמוך.',
      reasonAr: 'الرصيد المتوقع يكفي للشراء، لكن هامش الأمان منخفض.',
      recommendedCard: null,
      savingsAmount: 0,
      currency: input.currency,
    };

    return exchangeFeeWarning === undefined
      ? decision
      : { ...decision, exchangeFeeWarning };
  }

  const decision: PurchaseDecision = {
    verdict: 'blocked',
    reason: 'היתרה הצפויה אינה מספיקה לכיסוי הרכישה.',
    reasonAr: 'الرصيد المتوقع لا يكفي لتغطية عملية الشراء.',
    recommendedCard: null,
    savingsAmount: 0,
    currency: input.currency,
  };

  return exchangeFeeWarning === undefined
    ? decision
    : { ...decision, exchangeFeeWarning };
}
