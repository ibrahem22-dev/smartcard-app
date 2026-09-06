/**
 * BENEFIT AUTHORITY — the one door outside `src/data/adapter/**` to benefit eligibility.
 *
 * Boundary rule R3 names `src/authority/**` as the permitted importer of a pack module, and this
 * file is that door for the Benefits Hub, Card Detail, Card DNA and Merchant Radar. Nothing is
 * restated here: every symbol keeps its definition in `benefitEligibility.ts`, which is the only
 * module that opens the benefits pack for this purpose.
 *
 * ONE DOOR IS THE POINT. The campaign addendum requires Merchant Radar and the Benefits Hub to
 * share one eligibility truth rather than grow two matchers, and two seams would be two matchers
 * wearing one name.
 */
export {
  allBenefits,
  benefitFamily,
  benefitTitle,
  benefitValidity,
  benefitsForProduct,
  eligibleBenefitsForCards,
  eligibleBenefitsForFamily,
  eligibleBenefitsForMerchant,
  isCurrentlyShowable,
  productsWithEvidencedBenefits,
  programmeDependentBenefitsFor,
  EXPIRING_SOON_DAYS,
  type BenefitFamily,
  type BenefitValidity,
  type BenefitView,
  type EligibilityBasis,
  type EligibleBenefit,
  type HeldCard,
} from '../data/adapter/benefitEligibility';
