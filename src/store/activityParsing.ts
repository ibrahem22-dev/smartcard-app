/**
 * Parse the encrypted activity vault. Malformed JSON is an empty vault, not a throw.
 */
import {
  DERIVED_MONETARY_SUM_TOLERANCE_ILS,
  INSTALLMENT_PLAN_MIN_PAYMENT_COUNT,
} from '../config/financial';
import type {
  ActivityVault,
  LoggedPurchase,
  VerdictHistoryRecord,
} from '../types/activity.types';
import type { PurchaseVerdict } from '../engines/verdict';

const VERDICTS: readonly PurchaseVerdict[] = [
  'good_to_go',
  'caution',
  'dont_buy_now',
  'wait_until_billing_passes',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVerdict(value: unknown): value is PurchaseVerdict {
  return typeof value === 'string' && (VERDICTS as readonly string[]).includes(value);
}

export function isLoggedPurchase(value: unknown): value is LoggedPurchase {
  if (!isRecord(value)) return false;
  if (typeof value.activityId !== 'string' || value.activityId.length === 0) return false;
  if (typeof value.amountIls !== 'number' || !(value.amountIls > 0) || !Number.isFinite(value.amountIls)) {
    return false;
  }
  if (typeof value.loggedAt !== 'string' || value.loggedAt.length === 0) return false;
  if (value.cardId !== undefined && typeof value.cardId !== 'string') return false;
  const hasInstallmentLink = value.linkedInstallmentId !== undefined;
  const hasPlanTotal = value.installmentPlanTotalIls !== undefined;
  const hasInstallmentCount = value.installmentCount !== undefined;
  if (hasInstallmentLink || hasPlanTotal || hasInstallmentCount) {
    if (
      typeof value.linkedInstallmentId !== 'string'
      || value.linkedInstallmentId.length === 0
      || typeof value.installmentPlanTotalIls !== 'number'
      || !(value.installmentPlanTotalIls > 0)
      || !Number.isFinite(value.installmentPlanTotalIls)
      || typeof value.installmentCount !== 'number'
      || !Number.isInteger(value.installmentCount)
      || value.installmentCount < INSTALLMENT_PLAN_MIN_PAYMENT_COUNT
      || typeof value.cardId !== 'string'
      || value.cardId.length === 0
      || Math.abs(value.amountIls * value.installmentCount - value.installmentPlanTotalIls)
        > DERIVED_MONETARY_SUM_TOLERANCE_ILS
    ) {
      return false;
    }
  }
  return true;
}

export function isVerdictHistoryRecord(value: unknown): value is VerdictHistoryRecord {
  if (!isRecord(value)) return false;
  if (typeof value.activityId !== 'string' || value.activityId.length === 0) return false;
  if (typeof value.at !== 'string' || value.at.length === 0) return false;
  if (!isVerdict(value.verdict)) return false;
  if (
    typeof value.purchaseAmountIls !== 'number'
    || !(value.purchaseAmountIls > 0)
    || !Number.isFinite(value.purchaseAmountIls)
  ) {
    return false;
  }
  if (value.cardId !== undefined && typeof value.cardId !== 'string') return false;
  return true;
}

export const EMPTY_ACTIVITY: ActivityVault = { purchases: [], verdicts: [] };

export function parseStoredActivity(raw: string | undefined): ActivityVault {
  if (raw === undefined) return EMPTY_ACTIVITY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_ACTIVITY;
    const purchases = Array.isArray(parsed.purchases)
      ? parsed.purchases.filter(isLoggedPurchase)
      : [];
    const verdicts = Array.isArray(parsed.verdicts)
      ? parsed.verdicts.filter(isVerdictHistoryRecord)
      : [];
    return { purchases, verdicts };
  } catch {
    return EMPTY_ACTIVITY;
  }
}
