/**
 * THE CHECK SEAM — WP-1.3 / criterion B1.
 *
 *   > *"No P4 surface holds recommendation logic in either direction: every number a surface
 *   > shows came from an engine call…"*  (contract §5 B1; spec §20)
 *
 * One function. One engine call. One result object. The pill (`verdict`) and the Financial
 * Impact panel (`financialImpact`) are fields of that object — they cannot disagree because
 * they are not produced separately.
 *
 * THIS FILE MAPS. IT DOES NOT DECIDE. Mapping a typed amount onto `purchaseAmountIls` and
 * defaulting a missing installment count to 1 is input assembly. Load ratios, threshold
 * comparisons, ranking and monthly-affordability arithmetic stay inside
 * `evaluatePurchaseVerdict`. If you find yourself dividing by income here, stop.
 *
 * Foreign-currency conversion is C4 and is refused rather than approximated. The PHASE-1
 * spine is shekel-only on purpose (execution plan: "default currency, no category, one
 * card, no FX").
 */
import type { CheckInputDraft } from './CheckInputScreen';
import { provenanced } from '../../engines/provenance';
import {
  evaluatePurchaseVerdict,
  type PurchaseVerdictInput,
  type PurchaseVerdictResult,
} from '../../engines/verdict';
import { Currency } from '../../types/purchase.types';

export interface PurchaseCheckContext {
  readonly monthlyIncomeIls: PurchaseVerdictInput['monthlyIncomeIls'];
  readonly commitments: PurchaseVerdictInput['commitments'];
  readonly nextPayday?: PurchaseVerdictInput['nextPayday'];
  readonly riskFlags?: PurchaseVerdictInput['riskFlags'];
  readonly imminentBilling?: PurchaseVerdictInput['imminentBilling'];
  readonly thresholds?: PurchaseVerdictInput['thresholds'];
}

export function runPurchaseCheck(
  draft: CheckInputDraft,
  context: PurchaseCheckContext,
): PurchaseVerdictResult {
  if (draft.currency !== Currency.ILS) {
    throw new Error(
      'runPurchaseCheck: foreign currency is criterion C4; the PHASE-1 spine does not convert',
    );
  }
  return evaluatePurchaseVerdict({
    purchaseAmountIls: provenanced(draft.amount, 'USER'),
    installmentCount: draft.installments ?? 1,
    monthlyIncomeIls: context.monthlyIncomeIls,
    commitments: context.commitments,
    ...(context.nextPayday !== undefined ? { nextPayday: context.nextPayday } : {}),
    ...(context.riskFlags !== undefined ? { riskFlags: context.riskFlags } : {}),
    ...(context.imminentBilling !== undefined ? { imminentBilling: context.imminentBilling } : {}),
    ...(context.thresholds !== undefined ? { thresholds: context.thresholds } : {}),
  });
}
