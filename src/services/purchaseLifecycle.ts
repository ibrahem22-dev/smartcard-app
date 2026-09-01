import { writeLoggedPurchase, writeVerdictHistory } from '../check/activityMapper';
import {
  DERIVED_MONETARY_SUM_TOLERANCE_ILS,
  INSTALLMENT_PLAN_MIN_PAYMENT_COUNT,
} from '../config/financial';
import type { PurchaseVerdict } from '../engines/verdict';
import type { ActivityState } from '../store/useActivityStore';
import type { CardsState } from '../store/useCardsStore';
import type { LoggedPurchase, VerdictHistoryRecord } from '../types/activity.types';
import type { ImportedInstallment } from '../types/installment.types';

export interface PurchaseLifecycleMutationActions {
  readonly getPurchases: () => readonly LoggedPurchase[];
  readonly getVerdicts: () => readonly VerdictHistoryRecord[];
  readonly getObligations: () => readonly ImportedInstallment[];
  readonly updatePurchase: ActivityState['updatePurchase'];
  readonly deletePurchase: ActivityState['deletePurchase'];
  readonly replaceActivity: ActivityState['replaceActivity'];
  readonly updateObligation: CardsState['updateObligation'];
  readonly deleteObligation: CardsState['deleteObligation'];
  readonly replaceObligations: CardsState['replaceObligations'];
}

export interface PurchaseLifecycleActions extends PurchaseLifecycleMutationActions {
  readonly logPurchase: ActivityState['logPurchase'];
  readonly recordVerdict: ActivityState['recordVerdict'];
  readonly addObligation: CardsState['addObligation'];
}

export type PurchaseLifecycleFailureReason =
  | 'INSTALLMENT_CARD_REQUIRED'
  | 'INVALID_INSTALLMENT_PLAN'
  | 'PURCHASE_ID_CONFLICT'
  | 'PURCHASE_WRITE_FAILED_ROLLED_BACK'
  | 'PURCHASE_WRITE_FAILED_ROLLBACK_FAILED'
  | 'COMMITMENT_WRITE_FAILED_ROLLED_BACK'
  | 'COMMITMENT_WRITE_FAILED_ROLLBACK_FAILED'
  | 'VERDICT_WRITE_FAILED_ROLLED_BACK'
  | 'VERDICT_WRITE_FAILED_ROLLBACK_FAILED'
  | 'EDIT_WRITE_FAILED_ROLLED_BACK'
  | 'EDIT_WRITE_FAILED_ROLLBACK_FAILED'
  | 'DELETE_WRITE_FAILED_ROLLED_BACK'
  | 'DELETE_WRITE_FAILED_ROLLBACK_FAILED'
  | 'LIFECYCLE_NOT_FOUND'
  | 'LIFECYCLE_INVARIANT_FAILED_ROLLED_BACK'
  | 'LIFECYCLE_INVARIANT_FAILED_ROLLBACK_FAILED';

export type PurchaseLifecycleResult =
  | {
    readonly ok: true;
    readonly status: 'CREATED' | 'ALREADY_COMMITTED' | 'EDITED' | 'DELETED';
    readonly purchase?: LoggedPurchase;
    readonly obligation?: ImportedInstallment;
  }
  | {
    readonly ok: false;
    readonly reason: PurchaseLifecycleFailureReason;
    readonly detail: string;
  };

interface Snapshot {
  readonly purchases: readonly LoggedPurchase[];
  readonly verdicts: readonly VerdictHistoryRecord[];
  readonly obligations: readonly ImportedInstallment[];
}

let activityIdSequence = 0;

/** Collision-free within the running session, including two calls in one millisecond. */
export function nextPurchaseActivityId(at: string): string {
  activityIdSequence += 1;
  return `activity:${at}:${activityIdSequence}`;
}

const same = (left: unknown, right: unknown): boolean => (
  JSON.stringify(left) === JSON.stringify(right)
);

function snapshot(actions: PurchaseLifecycleMutationActions): Snapshot {
  return {
    purchases: [...actions.getPurchases()],
    verdicts: [...actions.getVerdicts()],
    obligations: [...actions.getObligations()],
  };
}

function restoreAndVerify(
  actions: PurchaseLifecycleMutationActions,
  before: Snapshot,
): boolean {
  let activityRestored = false;
  let obligationsRestored = false;
  try {
    actions.replaceActivity(before.purchases, before.verdicts);
    activityRestored = true;
  } catch {
    activityRestored = false;
  }
  try {
    actions.replaceObligations(before.obligations);
    obligationsRestored = true;
  } catch {
    obligationsRestored = false;
  }
  return activityRestored
    && obligationsRestored
    && same(actions.getPurchases(), before.purchases)
    && same(actions.getVerdicts(), before.verdicts)
    && same(actions.getObligations(), before.obligations);
}

function failure(
  stage: 'PURCHASE_WRITE' | 'COMMITMENT_WRITE' | 'VERDICT_WRITE' | 'EDIT_WRITE' | 'DELETE_WRITE' | 'LIFECYCLE_INVARIANT',
  rolledBack: boolean,
  error: unknown,
): PurchaseLifecycleResult {
  const suffix = rolledBack ? 'ROLLED_BACK' : 'ROLLBACK_FAILED';
  return {
    ok: false,
    reason: `${stage}_FAILED_${suffix}` as PurchaseLifecycleFailureReason,
    detail: error instanceof Error ? error.message : String(error),
  };
}

export function purchaseLifecycleProblems(
  purchases: readonly LoggedPurchase[],
  obligations: readonly ImportedInstallment[],
): readonly string[] {
  const problems: string[] = [];
  const purchaseObligations = obligations.filter((row) => row.source === 'purchase');
  for (const obligation of purchaseObligations) {
    const purchase = purchases.find(
      (row) => row.activityId === obligation.loggedPurchaseActivityId,
    );
    if (purchase === undefined) {
      problems.push(`orphaned commitment ${obligation.installmentId} names missing purchase ${obligation.loggedPurchaseActivityId ?? '(none)'}`);
      continue;
    }
    if (purchase.linkedInstallmentId !== obligation.installmentId) {
      problems.push(`commitment ${obligation.installmentId} and purchase ${purchase.activityId} do not link to each other`);
    }
    if (
      Math.abs(purchase.amountIls - obligation.monthlyPayment)
        > DERIVED_MONETARY_SUM_TOLERANCE_ILS
    ) {
      problems.push(`purchase ${purchase.activityId} and commitment ${obligation.installmentId} disagree on monthly amount`);
    }
    if (purchase.installmentPlanTotalIls !== obligation.totalAmount) {
      problems.push(`purchase ${purchase.activityId} and commitment ${obligation.installmentId} disagree on plan total`);
    }
    if (purchase.installmentCount !== obligation.monthsRemaining + 1) {
      problems.push(`purchase ${purchase.activityId} and commitment ${obligation.installmentId} disagree on payment count`);
    }
    if (purchase.cardId !== obligation.billingCardId) {
      problems.push(`purchase ${purchase.activityId} and commitment ${obligation.installmentId} disagree on billing card`);
    }
    const exposure = purchase.amountIls
      + obligation.monthlyPayment * obligation.monthsRemaining;
    if (Math.abs(exposure - obligation.totalAmount) > DERIVED_MONETARY_SUM_TOLERANCE_ILS) {
      problems.push(`purchase ${purchase.activityId} double-count invariant failed: ${purchase.amountIls} logged + ${obligation.monthlyPayment * obligation.monthsRemaining} held != ${obligation.totalAmount} total`);
    }
  }
  for (const purchase of purchases.filter((row) => row.linkedInstallmentId !== undefined)) {
    const obligation = purchaseObligations.find(
      (row) => row.installmentId === purchase.linkedInstallmentId,
    );
    if (obligation === undefined) {
      problems.push(`installment purchase ${purchase.activityId} names missing commitment ${purchase.linkedInstallmentId ?? '(none)'}`);
    } else if (obligation.loggedPurchaseActivityId !== purchase.activityId) {
      problems.push(`purchase ${purchase.activityId} and commitment ${obligation.installmentId} do not link to each other`);
    }
  }
  return problems;
}

function exactExistingLifecycle(
  purchase: LoggedPurchase,
  obligation: ImportedInstallment | undefined,
  expectedPurchase: LoggedPurchase,
  expectedObligation: ImportedInstallment | undefined,
): boolean {
  return same(purchase, expectedPurchase) && same(obligation, expectedObligation);
}

export function commitPurchaseLifecycle(input: {
  readonly activityId: string;
  readonly at: string;
  readonly totalAmountIls: number;
  readonly installmentCount: number;
  readonly merchantName: string;
  readonly cardId?: string;
  readonly verdict: PurchaseVerdict;
  readonly actions: PurchaseLifecycleActions;
}): PurchaseLifecycleResult {
  const { actions } = input;
  if (!(input.totalAmountIls > 0) || !Number.isFinite(input.totalAmountIls)) {
    return { ok: false, reason: 'INVALID_INSTALLMENT_PLAN', detail: 'plan total must be positive' };
  }
  const isInstallment = input.installmentCount >= INSTALLMENT_PLAN_MIN_PAYMENT_COUNT;
  if (!Number.isInteger(input.installmentCount) || input.installmentCount < 1) {
    return { ok: false, reason: 'INVALID_INSTALLMENT_PLAN', detail: 'payment count must be a positive integer' };
  }
  if (isInstallment && input.cardId === undefined) {
    return { ok: false, reason: 'INSTALLMENT_CARD_REQUIRED', detail: 'an installment plan must name its billing card' };
  }

  const installmentId = `installment:${input.activityId}`;
  const monthlyPayment = input.totalAmountIls / input.installmentCount;
  const purchase = writeLoggedPurchase({
    activityId: input.activityId,
    amountIls: isInstallment ? monthlyPayment : input.totalAmountIls,
    at: input.at,
    ...(input.cardId === undefined ? {} : { cardId: input.cardId }),
    ...(isInstallment
      ? {
        linkedInstallmentId: installmentId,
        installmentPlanTotalIls: input.totalAmountIls,
        installmentCount: input.installmentCount,
      }
      : {}),
  });
  const obligation: ImportedInstallment | undefined = isInstallment
    ? {
      installmentId,
      merchantName: input.merchantName,
      totalAmount: input.totalAmountIls,
      monthsRemaining: input.installmentCount - 1,
      monthlyPayment,
      billingCardId: input.cardId as string,
      source: 'purchase',
      loggedPurchaseActivityId: input.activityId,
    }
    : undefined;

  const existingPurchase = actions.getPurchases().find(
    (row) => row.activityId === input.activityId,
  );
  if (existingPurchase !== undefined) {
    const existingObligation = actions.getObligations().find(
      (row) => row.installmentId === existingPurchase.linkedInstallmentId,
    );
    return exactExistingLifecycle(existingPurchase, existingObligation, purchase, obligation)
      ? { ok: true, status: 'ALREADY_COMMITTED', purchase: existingPurchase, ...(existingObligation ? { obligation: existingObligation } : {}) }
      : { ok: false, reason: 'PURCHASE_ID_CONFLICT', detail: input.activityId };
  }

  const before = snapshot(actions);
  let stage: 'PURCHASE_WRITE' | 'COMMITMENT_WRITE' | 'VERDICT_WRITE' | 'LIFECYCLE_INVARIANT' = 'PURCHASE_WRITE';
  try {
    actions.logPurchase(purchase);
    if (obligation !== undefined) {
      stage = 'COMMITMENT_WRITE';
      actions.addObligation(obligation);
    }
    stage = 'VERDICT_WRITE';
    actions.recordVerdict(writeVerdictHistory({
      activityId: purchase.activityId,
      at: purchase.loggedAt,
      verdict: input.verdict,
      purchaseAmountIls: input.totalAmountIls,
      ...(input.cardId === undefined ? {} : { cardId: input.cardId }),
    }));
    stage = 'LIFECYCLE_INVARIANT';
    const problems = purchaseLifecycleProblems(
      actions.getPurchases(),
      actions.getObligations(),
    );
    if (problems.length > 0) throw new Error(problems.join('; '));
    return { ok: true, status: 'CREATED', purchase, ...(obligation ? { obligation } : {}) };
  } catch (error: unknown) {
    return failure(stage, restoreAndVerify(actions, before), error);
  }
}

export function editPurchaseLifecycle(input: {
  readonly activityId: string;
  readonly totalAmountIls: number;
  readonly monthsRemaining: number;
  readonly actions: PurchaseLifecycleMutationActions;
}): PurchaseLifecycleResult {
  const { actions } = input;
  const purchase = actions.getPurchases().find((row) => row.activityId === input.activityId);
  const obligation = actions.getObligations().find(
    (row) => row.loggedPurchaseActivityId === input.activityId && row.source === 'purchase',
  );
  if (purchase === undefined || obligation === undefined) {
    return { ok: false, reason: 'LIFECYCLE_NOT_FOUND', detail: input.activityId };
  }
  if (!(input.totalAmountIls > 0) || !Number.isFinite(input.totalAmountIls)
    || !Number.isInteger(input.monthsRemaining) || input.monthsRemaining < 1) {
    return { ok: false, reason: 'INVALID_INSTALLMENT_PLAN', detail: 'edited total and remaining payments must be valid' };
  }
  const installmentCount = input.monthsRemaining + 1;
  const monthlyPayment = input.totalAmountIls / installmentCount;
  const nextPurchase: LoggedPurchase = {
    ...purchase,
    amountIls: monthlyPayment,
    installmentPlanTotalIls: input.totalAmountIls,
    installmentCount,
  };
  const nextObligation: ImportedInstallment = {
    ...obligation,
    totalAmount: input.totalAmountIls,
    monthsRemaining: input.monthsRemaining,
    monthlyPayment,
  };
  const before = snapshot(actions);
  let stage: 'EDIT_WRITE' | 'LIFECYCLE_INVARIANT' = 'EDIT_WRITE';
  try {
    actions.updatePurchase(input.activityId, nextPurchase);
    actions.updateObligation(obligation.installmentId, nextObligation);
    stage = 'LIFECYCLE_INVARIANT';
    const problems = purchaseLifecycleProblems(actions.getPurchases(), actions.getObligations());
    if (problems.length > 0) throw new Error(problems.join('; '));
    return { ok: true, status: 'EDITED', purchase: nextPurchase, obligation: nextObligation };
  } catch (error: unknown) {
    return failure(stage, restoreAndVerify(actions, before), error);
  }
}

export function deletePurchaseLifecycle(
  activityId: string,
  actions: PurchaseLifecycleMutationActions,
): PurchaseLifecycleResult {
  const purchase = actions.getPurchases().find((row) => row.activityId === activityId);
  if (purchase === undefined) {
    return { ok: false, reason: 'LIFECYCLE_NOT_FOUND', detail: activityId };
  }
  const before = snapshot(actions);
  let stage: 'DELETE_WRITE' | 'LIFECYCLE_INVARIANT' = 'DELETE_WRITE';
  try {
    actions.deletePurchase(activityId);
    if (purchase.linkedInstallmentId !== undefined) {
      actions.deleteObligation(purchase.linkedInstallmentId);
    }
    stage = 'LIFECYCLE_INVARIANT';
    const problems = purchaseLifecycleProblems(actions.getPurchases(), actions.getObligations());
    if (problems.length > 0) throw new Error(problems.join('; '));
    return { ok: true, status: 'DELETED' };
  } catch (error: unknown) {
    return failure(stage, restoreAndVerify(actions, before), error);
  }
}
