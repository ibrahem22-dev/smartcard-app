/**
 * Wave 1 authority-safety layer.
 *
 * One rule holds the layer together: a value the app did not verify never
 * reaches the user as a confident financial statement.
 */

export {
  AUTHORITY_GRADE_PROVENANCES,
  AUTHORITY_STATES,
  AuthorityUnavailableError,
  PROVENANCES,
  blocked,
  conflict,
  currentAuthorityOrNull,
  foldAuthority,
  historical,
  isConflict,
  isCurrentAuthority,
  isHistorical,
  isKnown,
  isUnavailable,
  known,
  requireCurrentAuthority,
  unknown,
} from './authorityValue';
export type {
  AuthorityFold,
  AuthorityState,
  AuthorityValue,
  BlockedAuthority,
  ConflictAuthority,
  ConflictCandidate,
  HistoricalAuthority,
  KnownAuthority,
  Provenance,
  UnknownAuthority,
} from './authorityValue';

export {
  DisabledDataAuthorityAdapter,
  INTEGRATION_DISABLED_REASON,
  getDataAuthorityAdapter,
  hasOfficialAuthorityFor,
  resetDataAuthorityAdapter,
  setDataAuthorityAdapter,
} from './DataAuthorityAdapter';
export type { AuthorityLookup, DataAuthorityAdapter } from './DataAuthorityAdapter';

export {
  CLAIM_KINDS,
  BUSINESS_RULE_FIELD_PREFIXES,
  FINANCIAL_FIELD_PREFIXES,
  admitClaim,
  classifyClaim,
} from './claimClassification';
export type {
  ClaimAdmission,
  ClaimClassification,
  ClaimDescriptor,
  ClaimKind,
} from './claimClassification';

export {
  FORBIDDEN_UNAVAILABLE_RENDERINGS,
  PRESENTATION_TONES,
  assertSafeRendering,
  presentAuthority,
  rendersAsZeroAmount,
} from './presentation';
export type {
  AmountFormatter,
  AuthorityPresentation,
  PresentationTone,
} from './presentation';

export {
  REQUIREMENT_GRADES,
  evaluateAgainstAdapter,
  evaluateFeatureRequirements,
  isStaleSubstitution,
} from './featureDataRequirements';
export type {
  FeatureAvailability,
  FeatureDataRequirement,
  FeatureRequirementSpec,
  RequirementGrade,
  UnmetRequirement,
} from './featureDataRequirements';

export {
  acceptManualInput,
  assertNotUserInput,
  manualInputToAuthority,
} from './manualInputBoundary';
export type {
  ManualInputAcceptance,
  ManualInputOutcome,
  ManualInputRejection,
  ManualInputRequest,
  ManualNumberPolicy,
} from './manualInputBoundary';

/**
 * D3 — the non-authority bundled-data access point is GONE, and nothing replaces its exports here.
 *
 * `BUNDLED_DATASET_PROVENANCE` and `fxAbroadToAuthority` existed to dress a bundled JSON file up as
 * an authority answer. There is no such thing to dress up any more: the datasets are archived out
 * of the runtime and the adapter that replaces them is D1, in Phase 7.
 *
 * The seam that answers in the meantime is `./noSource`, and it answers UNKNOWN.
 */
export {
  NO_AUTHORITY_SOURCE,
  NO_AUTHORITY_SOURCE_DETAIL,
  EMPTY_BENEFITS_DB,
} from './noSource';
