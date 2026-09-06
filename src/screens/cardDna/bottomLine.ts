/**
 * THE BOTTOM LINE — "what is this card worth to me each month", answered or honestly refused.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE ARITHMETIC THE OWNER ASKED FOR, AND WHY IT USUALLY CANNOT BE DONE
 *
 * The directive asks for *"monthly realized/eligible benefit value MINUS monthly card fee"* and, in
 * the same breath, forbids the two ways of faking it: *"Do not fabricate monthly benefit
 * realization"* and *"Never label an estimate as actual savings."*
 *
 * Both halves are usually missing, and for different reasons:
 *
 *   · THE FEE. 338 of 378 current products have at least one bindable tariff row, but only **14**
 *     have exactly one distinct figure. The rest differ by a card LEVEL — Blue ₪15.90, Gold ₪22.90,
 *     Platinum $32.90 — that no field on a product row names. Subtracting one of six candidates
 *     would tell somebody their card costs ₪15.90 when the issuer charges them ₪32.90.
 *
 *   · THE BENEFIT VALUE. The app records no redemption. It knows which benefits a card is evidenced
 *     for and, for some, a published headline value; it does not know what the holder actually
 *     used. A monthly realised value would be a number nobody measured.
 *
 * So the net value is `AVAILABLE` only when the fee resolves to exactly one figure AND a realised
 * benefit value is supplied by a caller that genuinely has one. Nothing in the app supplies one
 * today, so the honest render is the fee, the benefit COUNT, and a stated absence where the net
 * value would be. That is a smaller claim than the directive's ideal and it is the true one.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS FILE COMPOSES. IT DOES NOT PRICE.
 *
 * The fee comes from `cardFeeProfileFor`, unchanged. The benefits come from the one eligibility
 * layer, unchanged. The only arithmetic here is one subtraction, performed only in the branch
 * where both operands are facts.
 */
import {
  cardFeeProfileFor,
  type FeeCandidate,
  type FeeReading,
} from '../../authority/cardCatalogAuthority';
import {
  benefitsForProduct,
  isCurrentlyShowable,
  type EligibleBenefit,
} from '../../authority/benefitAuthority';

/** Whether a net monthly value can be stated at all, and why not when it cannot. */
export type BottomLineState =
  /** Fee is a single figure and a realised benefit value was supplied. */
  | 'AVAILABLE'
  /** The fee resolves to one figure; no realised benefit value exists, so no net value does. */
  | 'FEE_ONLY'
  /** The tariff publishes several figures for this scope, separated by a level nothing names. */
  | 'FEE_NEEDS_LEVEL'
  /** No tariff row reaches this card at all. */
  | 'FEE_UNKNOWN'
  /** The card is not a canonical product, so no tariff can be reached from it. */
  | 'NOT_A_CANONICAL_PRODUCT';

export interface BottomLineReading {
  readonly state: BottomLineState;
  /** The single monthly fee, when exactly one is bindable. Never one of several. */
  readonly monthlyFee?: FeeCandidate;
  /** Every candidate the tariff publishes for this card's scope, when they differ. */
  readonly feeCandidates: readonly FeeCandidate[];
  /** The whole fee reading, so a surface can show the evidence without a second lookup. */
  readonly feeReading?: FeeReading;
  /** Benefits the estate evidences for this exact product and that are not expired or upcoming. */
  readonly showableBenefits: readonly EligibleBenefit[];
  /** Every benefit evidenced for the product, including expired ones. Context, never a claim. */
  readonly evidencedBenefits: readonly EligibleBenefit[];
  /**
   * ₪ net value for the month. Present ONLY in the `AVAILABLE` state.
   *
   * A caller that has genuinely measured what the holder realised passes it in; nothing in the app
   * does yet, which is why this is almost always absent and stated as absent rather than as zero.
   */
  readonly netMonthlyValueIls?: number;
  /** The realised benefit value the caller supplied, echoed so a surface can show both operands. */
  readonly realisedBenefitValueIls?: number;
}

export interface BottomLineInput {
  /** The canonical product id. A `manual:`/`legacy:` id reaches no tariff, which is a state. */
  readonly cardProductId: string | undefined;
  readonly todayIso: string;
  /**
   * ₪ the holder actually realised this month, if anything in the app has measured it.
   *
   * OPTIONAL AND IT STAYS OPTIONAL. Defaulting it to zero would make every card's net value read
   * as "minus the fee", which is a claim that the card gave the holder nothing — a statement about
   * their behaviour that the app has no evidence for.
   */
  readonly realisedBenefitValueIls?: number;
}

/** Only a monthly charge belongs in a monthly net value. The estate writes the period in words. */
function isMonthly(candidate: FeeCandidate): boolean {
  const frequency = candidate.frequency ?? '';
  return /חודש|monthly/i.test(frequency);
}

export function bottomLineFor(input: BottomLineInput): BottomLineReading {
  const productId = input.cardProductId;
  if (productId === undefined || productId === '') {
    return {
      state: 'NOT_A_CANONICAL_PRODUCT',
      feeCandidates: [],
      showableBenefits: [],
      evidencedBenefits: [],
    };
  }

  const profile = cardFeeProfileFor(productId);
  const evidencedBenefits = profile === undefined
    ? []
    : benefitsForProduct(productId, input.todayIso);
  const showableBenefits = evidencedBenefits.filter((row) => isCurrentlyShowable(row.validity));

  if (profile === undefined) {
    return {
      state: 'NOT_A_CANONICAL_PRODUCT',
      feeCandidates: [],
      showableBenefits,
      evidencedBenefits,
    };
  }

  const fee = profile.cardFee;
  const monthlyCandidates = fee.candidates.filter(isMonthly);

  if (fee.state === 'NOT_AVAILABLE' || monthlyCandidates.length === 0) {
    return {
      state: 'FEE_UNKNOWN',
      feeCandidates: [],
      feeReading: fee,
      showableBenefits,
      evidencedBenefits,
    };
  }

  const distinct = new Set(monthlyCandidates.map((c) => `${c.value}|${c.unit}`));
  if (distinct.size > 1) {
    return {
      state: 'FEE_NEEDS_LEVEL',
      feeCandidates: monthlyCandidates,
      feeReading: fee,
      showableBenefits,
      evidencedBenefits,
    };
  }

  const monthlyFee = monthlyCandidates[0] as FeeCandidate;
  const realised = input.realisedBenefitValueIls;
  if (realised === undefined || !Number.isFinite(realised) || monthlyFee.unit !== 'ILS') {
    return {
      state: 'FEE_ONLY',
      monthlyFee,
      feeCandidates: monthlyCandidates,
      feeReading: fee,
      showableBenefits,
      evidencedBenefits,
    };
  }

  /* THE ONE SUBTRACTION, and only where both operands are facts. */
  return {
    state: 'AVAILABLE',
    monthlyFee,
    feeCandidates: monthlyCandidates,
    feeReading: fee,
    showableBenefits,
    evidencedBenefits,
    netMonthlyValueIls: realised - monthlyFee.value,
    realisedBenefitValueIls: realised,
  };
}
