/**
 * Add-card wizard surface → adapter seam.
 *
 * Screens may not import `src/data/adapter/**` under the predecessor E1 lint
 * (that lint still names `src/authority/**` as the adapter). D2 forbids this
 * file from opening a pack itself; the modules below sit in data/adapter/**
 * and are the only readers of catalog/pack.json.
 */
export {
  catalogDisplayName,
  currentCatalogInstitutions,
  currentCatalogProducts,
  searchCatalog,
  type CatalogInstitution,
  type CatalogProductHit,
} from '../data/adapter/catalogSearch';
export {
  clubInstitutions,
  currentCatalogClubs,
  remainingClubsAfter,
  resolveClub,
  type CatalogClub,
  type ClubResolution,
} from '../data/adapter/clubResolver';
export {
  catalogFxPrefill,
  catalogPrefillView,
  unknownFieldView,
  userEnteredView,
} from '../data/adapter/wizardProvenance';
export { writeWizardCard } from '../data/adapter/wizardVault';
