/**
 * THE PURCHASE VERDICT ENGINE — criterion N2, product spec §9 / §20.2.
 *
 * One call returns the verdict-pill state AND the Financial Impact model. There is deliberately no
 * exported `getPillState` or second calculation helper: a surface receives this result and reads
 * `verdict` for the pill and `financialImpact` for the panel. The numeric objects used by the impact
 * bullets are the very same objects used by `thresholdMath`, making the old “green pill, unsafe
 * percentage” contradiction structurally unnecessary rather than merely discouraged.
 *
 * Boundaries are the product spec's exact words: at or below the safe threshold is good; above the
 * safe threshold through the hard threshold is caution; only ABOVE the hard threshold blocks.
 * A hard risk flag always blocks. Waiting is available only when an imminent billing event makes
 * the post-event load safe and no independent risk flag remains.
 */
import { provenanced, type ProvenancedNumber } from './provenance';
import { step, trace, type ReasonTrace } from './reasonTrace';

export type PurchaseVerdict =
  | 'good_to_go'
  | 'caution'
  | 'dont_buy_now'
  | 'wait_until_billing_passes';

export interface VerdictCommitment {
  readonly commitmentId: string;
  readonly monthlyAmountIls: ProvenancedNumber;
}

export interface VerdictRiskFlag {
  readonly flagId: string;
  readonly severity: 'soft' | 'hard';
}

export interface VerdictThresholds {
  /** At or below this ratio, load alone is safe. Defaults to the configured 35%. */
  readonly safeRatio: ProvenancedNumber;
  /** Only a ratio strictly above this boundary blocks. Defaults to the configured 50%. */
  readonly hardRatio: ProvenancedNumber;
}

export interface ImminentBillingEvent {
  /** ISO date on which the commitment amount clears. */
  readonly date: string;
  readonly commitmentsClearingIls: ProvenancedNumber;
}

export interface PurchaseVerdictInput {
  readonly purchaseAmountIls: ProvenancedNumber;
  /** One means a single payment. Must be a positive integer. */
  readonly installmentCount: number;
  readonly monthlyIncomeIls: ProvenancedNumber;
  readonly commitments: readonly VerdictCommitment[];
  readonly nextPayday?: string;
  readonly riskFlags?: readonly VerdictRiskFlag[];
  readonly imminentBilling?: ImminentBillingEvent;
  /** Profile-setting overrides. Omission uses the app's cited product-decision defaults. */
  readonly thresholds?: VerdictThresholds;
}

export type ImpactBullet =
  | {
      readonly kind: 'PURCHASE_MONTHLY_COMMITMENT';
      readonly amountIls: ProvenancedNumber;
    }
  | {
      readonly kind: 'LOAD_AFTER_PURCHASE';
      readonly ratioOfIncome: ProvenancedNumber;
    }
  | {
      readonly kind: 'HARD_THRESHOLD_HEADROOM';
      /** Negative means the projected obligation is beyond the hard boundary. */
      readonly amountIls: ProvenancedNumber;
    }
  | {
      readonly kind: 'LOAD_AFTER_BILLING';
      readonly billingDate: string;
      readonly ratioOfIncome: ProvenancedNumber;
    };

export interface VerdictThresholdMath {
  readonly monthlyPurchaseCommitmentIls: ProvenancedNumber;
  readonly currentMonthlyCommitmentsIls: ProvenancedNumber;
  readonly projectedMonthlyCommitmentsIls: ProvenancedNumber;
  readonly projectedLoadRatio: ProvenancedNumber;
  readonly safeRatio: ProvenancedNumber;
  readonly hardRatio: ProvenancedNumber;
  readonly hardThresholdHeadroomIls: ProvenancedNumber;
  readonly postBillingLoadRatio?: ProvenancedNumber;
}

export interface FinancialImpact {
  readonly bullets: readonly ImpactBullet[];
  readonly thresholdMath: VerdictThresholdMath;
}

export interface PurchaseVerdictResult {
  /** The only pill state. Consumers must not recalculate it from the panel. */
  readonly verdict: PurchaseVerdict;
  /** The same calculation's numeric account; not a second surface-specific projection. */
  readonly financialImpact: FinancialImpact;
  /** Populated only for the wait state, so a surface cannot invent the date. */
  readonly waitUntil?: string;
  readonly trace: ReasonTrace;
}

/**
 * Cited constants — spec §9 four-state defaults: "load lands between thresholds (default 35–50%)",
 * editable by the user in More (spec feature #8). Deliberately NOT imported from the installment
 * gate's config ratios: the two happen to share values today, but they are independent product
 * knobs, and tuning one must never silently move the other's boundary (G11: a threshold lives in
 * an engine only when it cites its authority in the same breath).
 */
const VERDICT_SAFE_LOAD_DEFAULT_RATIO = 0.35;
const VERDICT_HARD_LOAD_DEFAULT_RATIO = 0.5;

const DEFAULT_SAFE_RATIO: ProvenancedNumber = {
  value: VERDICT_SAFE_LOAD_DEFAULT_RATIO,
  provenance: 'VERIFIED',
};
const DEFAULT_HARD_RATIO: ProvenancedNumber = {
  value: VERDICT_HARD_LOAD_DEFAULT_RATIO,
  provenance: 'VERIFIED',
};

function assertUsableNonNegative(label: string, number: ProvenancedNumber): void {
  if (!Number.isFinite(number.value) || number.value < 0) {
    throw new Error(label + ': refusing a negative or non-finite monetary input');
  }
  if (number.provenance === 'UNKNOWN') {
    throw new Error(label + ': UNKNOWN cannot accompany a calculable number');
  }
}

function assertIsoDate(label: string, value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error(label + ': expected an ISO date');
  }
}

/** Compute the pill state, impact bullets and threshold math once, as one immutable result. */
export function evaluatePurchaseVerdict(input: PurchaseVerdictInput): PurchaseVerdictResult {
  assertUsableNonNegative('purchaseAmountIls', input.purchaseAmountIls);
  if (input.purchaseAmountIls.value === 0) {
    throw new Error('purchaseAmountIls: a zero amount is not a purchase to evaluate');
  }
  assertUsableNonNegative('monthlyIncomeIls', input.monthlyIncomeIls);
  if (input.monthlyIncomeIls.value === 0) {
    throw new Error('monthlyIncomeIls: zero income cannot produce a load ratio');
  }
  if (!Number.isInteger(input.installmentCount) || input.installmentCount <= 0) {
    throw new Error('installmentCount: expected a positive integer');
  }

  const commitmentIds = new Set<string>();
  for (const commitment of input.commitments) {
    if (!commitment.commitmentId.trim()) throw new Error('a commitment must have a commitmentId');
    if (commitmentIds.has(commitment.commitmentId)) {
      throw new Error(commitment.commitmentId + ': duplicate commitmentId');
    }
    commitmentIds.add(commitment.commitmentId);
    assertUsableNonNegative(commitment.commitmentId + ' monthlyAmountIls', commitment.monthlyAmountIls);
  }

  if (input.nextPayday !== undefined) assertIsoDate('nextPayday', input.nextPayday);
  if (input.imminentBilling !== undefined) {
    assertIsoDate('imminentBilling.date', input.imminentBilling.date);
    assertUsableNonNegative(
      'imminentBilling.commitmentsClearingIls',
      input.imminentBilling.commitmentsClearingIls,
    );
  }

  const thresholds = input.thresholds ?? {
    safeRatio: DEFAULT_SAFE_RATIO,
    hardRatio: DEFAULT_HARD_RATIO,
  };
  assertUsableNonNegative('thresholds.safeRatio', thresholds.safeRatio);
  assertUsableNonNegative('thresholds.hardRatio', thresholds.hardRatio);
  if (thresholds.safeRatio.value >= thresholds.hardRatio.value || thresholds.hardRatio.value > 1) {
    throw new Error('thresholds: expected 0 <= safeRatio < hardRatio <= 1');
  }

  const flags = input.riskFlags ?? [];
  const flagIds = new Set<string>();
  for (const flag of flags) {
    if (!flag.flagId.trim()) throw new Error('a risk flag must have a flagId');
    if (flagIds.has(flag.flagId)) throw new Error(flag.flagId + ': duplicate risk flag');
    flagIds.add(flag.flagId);
  }

  const currentCommitments = input.commitments
    .reduce((sum, commitment) => sum + commitment.monthlyAmountIls.value, 0);
  const purchaseCommitment = input.purchaseAmountIls.value / input.installmentCount;
  const projectedCommitments = currentCommitments + purchaseCommitment;
  const projectedRatio = projectedCommitments / input.monthlyIncomeIls.value;
  const hardHeadroom = input.monthlyIncomeIls.value * thresholds.hardRatio.value
    - projectedCommitments;
  const afterBillingCommitments = input.imminentBilling === undefined
    ? undefined
    : Math.max(0, projectedCommitments - input.imminentBilling.commitmentsClearingIls.value);
  const afterBillingRatio = afterBillingCommitments === undefined
    ? undefined
    : afterBillingCommitments / input.monthlyIncomeIls.value;

  // Every number below is created once. Bullets point to these same objects; no surface owns math.
  const monthlyPurchaseCommitmentIls = provenanced(purchaseCommitment, 'ESTIMATE');
  const currentMonthlyCommitmentsIls = provenanced(currentCommitments, 'ESTIMATE');
  const projectedMonthlyCommitmentsIls = provenanced(projectedCommitments, 'ESTIMATE');
  const projectedLoadRatio = provenanced(projectedRatio, 'ESTIMATE');
  const hardThresholdHeadroomIls = provenanced(hardHeadroom, 'ESTIMATE');
  const postBillingLoadRatio = afterBillingRatio === undefined
    ? undefined
    : provenanced(afterBillingRatio, 'ESTIMATE');

  const hasHardFlag = flags.some((flag) => flag.severity === 'hard');
  const hasSoftFlag = flags.some((flag) => flag.severity === 'soft');
  const becomesSafeAfterBilling = postBillingLoadRatio !== undefined
    && postBillingLoadRatio.value <= thresholds.safeRatio.value;

  let verdict: PurchaseVerdict;
  if (hasHardFlag) {
    verdict = 'dont_buy_now';
  } else if (!hasSoftFlag && becomesSafeAfterBilling
      && projectedLoadRatio.value > thresholds.safeRatio.value) {
    verdict = 'wait_until_billing_passes';
  } else if (projectedLoadRatio.value > thresholds.hardRatio.value) {
    verdict = 'dont_buy_now';
  } else if (hasSoftFlag || projectedLoadRatio.value > thresholds.safeRatio.value) {
    verdict = 'caution';
  } else {
    verdict = 'good_to_go';
  }

  const bullets: ImpactBullet[] = [
    { kind: 'PURCHASE_MONTHLY_COMMITMENT', amountIls: monthlyPurchaseCommitmentIls },
    { kind: 'LOAD_AFTER_PURCHASE', ratioOfIncome: projectedLoadRatio },
    ...(verdict === 'wait_until_billing_passes' && postBillingLoadRatio !== undefined
      ? [{
          kind: 'LOAD_AFTER_BILLING' as const,
          billingDate: input.imminentBilling!.date,
          ratioOfIncome: postBillingLoadRatio,
        }]
      : [{ kind: 'HARD_THRESHOLD_HEADROOM' as const, amountIls: hardThresholdHeadroomIls }]),
  ];

  const resultTrace = trace('verdict', [
    step(
      'product spec §20.2 threshold math',
      'divided current commitments plus this purchase plan\'s monthly commitment by monthly income',
      ['purchaseAmountIls', 'installmentCount', 'commitments', 'monthlyIncomeIls'],
    ),
    step(
      'product spec §9 four-state verdict',
      'selected ' + verdict + ' from that same projected load, the configured thresholds, risk '
        + 'flags and any imminent billing relief',
      ['projectedLoadRatio', 'safeRatio', 'hardRatio', 'riskFlags', 'imminentBilling'],
    ),
    step(
      'criterion N2 one computation',
      'returned the pill state, impact bullets and threshold math together; bullet numbers reuse '
        + 'the threshold-math values',
    ),
  ]);

  return {
    verdict,
    financialImpact: {
      bullets,
      thresholdMath: {
        monthlyPurchaseCommitmentIls,
        currentMonthlyCommitmentsIls,
        projectedMonthlyCommitmentsIls,
        projectedLoadRatio,
        safeRatio: thresholds.safeRatio,
        hardRatio: thresholds.hardRatio,
        hardThresholdHeadroomIls,
        ...(postBillingLoadRatio === undefined ? {} : { postBillingLoadRatio }),
      },
    },
    ...(verdict === 'wait_until_billing_passes'
      ? { waitUntil: input.imminentBilling!.date }
      : {}),
    trace: resultTrace,
  };
}
