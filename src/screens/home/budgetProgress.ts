/**
 * THE MONTHLY BUDGET, MEASURED AGAINST WHAT THE APP CAN ACTUALLY SEE.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS BEING COUNTED, STATED BEFORE IT IS COUNTED
 *
 * The directive is blunt about the failure to avoid: *"FIRST inspect what the current bar actually
 * measures. Do NOT relabel a different metric as real spending… Never imply bank-account
 * transaction synchronization unless it exists."* It does not exist. This app has no bank
 * connection and never has.
 *
 * So the figure below is the sum of exactly two things the user themselves put in the vault:
 *
 *   · MONTHLY OBLIGATIONS — `load.current.monthlyObligationsIls`, the load engine's own number,
 *     taken unchanged. It is what the user's commitments, imported installments and loans cost
 *     this month.
 *   · PURCHASES LOGGED THIS MONTH — amounts the user recorded through the Check flow, in the
 *     current calendar month.
 *
 * It is NOT a bank statement, it is NOT card spending, and the surface says so in the label rather
 * than in a footnote. A purchase paid in cash never appears; a direct debit the user never entered
 * never appears. Under-counting is the honest direction for a figure the app can only see part of,
 * and the wording is what stops it being read as complete.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE LOAD BAR IS A DIFFERENT QUESTION AND KEEPS ITS OWN NUMBER
 *
 * `HomeLoadBar` measures monthly obligations against INCOME, with thresholds the load engine owns.
 * This measures outflow-the-app-can-see against a target the USER chose. Two bars, two questions,
 * and the obligation total in both comes from the same engine result so they cannot disagree
 * about the part they share.
 *
 * THIS FILE ADDS TWO NUMBERS. It sets no threshold of its own beyond the three bands below, which
 * are a presentation of the ratio and not a financial rule: nothing is blocked, refused or
 * recommended on the strength of them.
 */
import { BUDGET_APPROACHING_FRACTION } from '../../config/financial';
import type { FinancialLoadResult } from '../../engines/load';
import type { LoggedPurchase } from '../../types/activity.types';

/** How the bar reads. Bands are presentation; no decision is taken on them. */
export type BudgetBand = 'no-target' | 'on-track' | 'approaching' | 'over';

/**
 * Fraction of the target at which the bar starts saying "approaching".
 *
 * RE-EXPORTED, NOT DECLARED. It is a threshold, and a threshold has one home — `config/financial.ts`
 * — which is what the P3 no-magic-numbers rule is about. The name stays here so a reader of this
 * file can see what the band means without following the import.
 */
export const APPROACHING_FRACTION = BUDGET_APPROACHING_FRACTION;

export interface BudgetProgressInput {
  /** ₪ target the user set, or `undefined` when they have not set one. */
  readonly targetIls: number | undefined;
  /** The load engine's result, or `null` when it could not run. */
  readonly load: FinancialLoadResult | null;
  readonly purchases: readonly LoggedPurchase[];
  /** `yyyy-mm` — the month being measured. Supplied, never read from the clock here. */
  readonly monthIso: string;
}

export interface BudgetProgressReading {
  readonly band: BudgetBand;
  /** ₪ the app can see leaving this month. Absent when the load engine produced nothing. */
  readonly seenOutflowIls?: number;
  /** The two parts, so a surface can show what it added rather than only the total. */
  readonly monthlyObligationsIls?: number;
  readonly loggedPurchasesIls: number;
  readonly targetIls?: number;
  /** `seen / target`, unclamped, so a surface can show 130% as 130%. Absent with no target. */
  readonly ratioOfTarget?: number;
}

/** `yyyy-mm` of an ISO instant, or `null` when the string is not one. */
function monthOf(iso: string): string | null {
  return /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : null;
}

export function budgetProgress(input: BudgetProgressInput): BudgetProgressReading {
  const loggedPurchasesIls = input.purchases
    .filter((purchase) => monthOf(purchase.loggedAt) === input.monthIso)
    .reduce((sum, purchase) => sum + (Number.isFinite(purchase.amountIls) ? purchase.amountIls : 0), 0);

  const obligations = input.load?.current.monthlyObligationsIls.value;
  const seenOutflowIls = obligations === undefined ? undefined : obligations + loggedPurchasesIls;

  if (input.targetIls === undefined || !Number.isFinite(input.targetIls) || input.targetIls <= 0) {
    return {
      band: 'no-target',
      loggedPurchasesIls,
      ...(obligations === undefined ? {} : { monthlyObligationsIls: obligations }),
      ...(seenOutflowIls === undefined ? {} : { seenOutflowIls }),
    };
  }

  if (seenOutflowIls === undefined) {
    /* A target with nothing to measure against it is not "on track" — it is a target and no
       measurement, and the bar says which. */
    return {
      band: 'no-target',
      loggedPurchasesIls,
      targetIls: input.targetIls,
    };
  }

  const ratioOfTarget = seenOutflowIls / input.targetIls;
  const band: BudgetBand =
    ratioOfTarget > 1 ? 'over' : ratioOfTarget >= APPROACHING_FRACTION ? 'approaching' : 'on-track';

  return {
    band,
    seenOutflowIls,
    loggedPurchasesIls,
    targetIls: input.targetIls,
    ratioOfTarget,
    ...(obligations === undefined ? {} : { monthlyObligationsIls: obligations }),
  };
}
