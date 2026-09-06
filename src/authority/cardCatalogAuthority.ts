/**
 * CARD CATALOG AUTHORITY — the one door outside `src/data/adapter/**` to canonical card identity.
 *
 * The same arrangement `addCardCatalog.ts` has held since the add-card wizard shipped, for the
 * canonical layer the campaign addendum adds: issuers, products, networks, programmes and the fee
 * profile. Boundary rule R3 names `src/authority/**` as the permitted importer of a pack module.
 *
 * Every consumer — the guided add-card flow, Card Detail, Card DNA, the Benefits Hub and the
 * Negotiation Hub — reads this. A second joiner would be a second answer to "what does this card
 * cost", which is the defect the layer behind this door exists to prevent.
 */
export {
  allCatalogNetworks,
  allCatalogProducts,
  availableBanks,
  availableCardCompanies,
  cardProductsForIssuer,
  catalogProductById,
  compatibleProgrammesForProduct,
  issuerByOrgId,
  issuerDisplayName,
  networkByIdCatalog,
  networkIdsFor,
  productDisplayName,
  searchProductsForIssuer,
  type CatalogIssuer,
  type CatalogNetwork,
  type CatalogProduct,
  type CatalogProgramme,
  type ProductProgrammeLink,
} from '../data/adapter/cardCatalog';

export {
  cardFeeProfileFor,
  issuerInterestObservation,
  unbindableNamedFeeRowCount,
  type CardFeeProfile,
  type FeeAbsenceReason,
  type PublishedFeeRow,
  type FeeEvidenceState,
  type FeeReading,
  type WaiverReading,
} from '../data/adapter/cardFeeProfile';

export {
  adoptCanonicalProduct,
  reconcileAll,
  reconcileCard,
  type ReconcilableCard,
  type ReconciliationReading,
  type ReconciliationState,
} from '../data/adapter/cardReconciliation';
