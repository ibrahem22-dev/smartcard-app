/**
 * MERCHANT AUTHORITY — the one door outside `src/data/adapter/**` to the merchant vocabulary.
 *
 * Boundary rule R3: a pack module is imported only from `src/authority/**`. That rule is why
 * `addCardCatalog.ts` exists for the add-card wizard, and this file is the same shape for Merchant
 * Radar and the Benefits Hub. Nothing is restated, wrapped or re-decided here: every symbol keeps
 * its definition in `src/data/adapter/**`, which is the only place that opens a pack.
 *
 * ONE DOOR MATTERS MORE HERE THAN USUAL. The campaign directive requires Merchant Radar and the
 * Benefits Hub to share one merchant resolver rather than growing two that drift — and two seams
 * would be two vocabularies wearing one name. So both read this, and the eligibility layer reads
 * `benefitEligibility.ts` behind it.
 */
export {
  allMerchants,
  merchantById,
  merchantHaystack,
  merchantName,
  merchantNameIsFallback,
  merchantPackIdentity,
  normalizeMerchantText,
  quickMerchants,
  resolveMerchantAlias,
  searchMerchants,
  QUICK_MERCHANT_IDS,
  type MerchantNameLanguage,
  type MerchantSearchOptions,
  type MerchantView,
} from '../data/adapter/merchantDirectory';

export {
  merchantBenefitsFor,
  merchantsWithEvidencedBenefits,
  type MerchantBenefitAbsence,
  type MerchantBenefitReading,
  type MerchantBenefitView,
} from '../data/adapter/merchantBenefits';
