/**
 * W1-AS-04 — Business Rules vs Financial Data Claims (APP-DEC-08).
 *
 * A product rule ("show installments above 3 payments") and a financial claim
 * ("this card charges 2.8% abroad") are different kinds of statement. Only the
 * second needs official authority. The failure this module prevents is a
 * product rule being presented with the confidence of verified financial data.
 *
 * Classification is STRUCTURAL — derived from the claim's own shape, not from
 * a flag a caller sets — so a claim cannot self-declare as a business rule to
 * escape the authority requirement.
 */

import {
  type AuthorityValue,
  type Provenance,
  isCurrentAuthority,
} from './authorityValue';

export const CLAIM_KINDS = [
  'BUSINESS_RULE',
  'FINANCIAL_DATA_CLAIM',
  'DERIVED_PRESENTATION',
  'UNCLASSIFIED',
] as const;

export type ClaimKind = (typeof CLAIM_KINDS)[number];

/**
 * Fields that assert something about money the issuer charges or pays.
 * A claim touching any of these is a FINANCIAL_DATA_CLAIM regardless of intent.
 */
export const FINANCIAL_FIELD_PREFIXES: readonly string[] = [
  'card.fee',
  'card.cardFee',
  'card.fx',
  'card.interest',
  'card.apr',
  'card.cashback',
  'card.rate',
  'card.commission',
  'card.creditLimit',
  'card.minimumPayment',
  'card.installmentFee',
  'card.withdrawalFee',
];

/** Fields that describe app behaviour, never issuer money. */
export const BUSINESS_RULE_FIELD_PREFIXES: readonly string[] = [
  'ui.',
  'app.',
  'feature.',
  'preference.',
  'display.',
];

export interface ClaimDescriptor {
  readonly claimId: string;
  /** Dotted field path, e.g. "card.fx.foreignFeePercent". */
  readonly field: string;
  readonly provenance: Provenance;
}

export interface ClaimClassification {
  readonly claimId: string;
  readonly field: string;
  readonly kind: ClaimKind;
  readonly requiresOfficialAuthority: boolean;
  readonly rationale: string;
}

function hasPrefix(field: string, prefixes: readonly string[]): boolean {
  const normalized = field.trim().toLowerCase();
  return prefixes.some((prefix) => normalized.startsWith(prefix.toLowerCase()));
}

export function classifyClaim(claim: ClaimDescriptor): ClaimClassification {
  const base = { claimId: claim.claimId, field: claim.field };

  if (hasPrefix(claim.field, FINANCIAL_FIELD_PREFIXES)) {
    return {
      ...base,
      kind: 'FINANCIAL_DATA_CLAIM',
      requiresOfficialAuthority: true,
      rationale: 'field asserts issuer monetary terms',
    };
  }
  if (hasPrefix(claim.field, BUSINESS_RULE_FIELD_PREFIXES)) {
    return {
      ...base,
      kind: 'BUSINESS_RULE',
      requiresOfficialAuthority: false,
      rationale: 'field describes application behaviour, not issuer terms',
    };
  }
  if (claim.provenance === 'DERIVED_CALCULATION') {
    return {
      ...base,
      kind: 'DERIVED_PRESENTATION',
      // A derivation is only as authoritative as its inputs; it can never
      // manufacture authority the inputs did not have.
      requiresOfficialAuthority: true,
      rationale: 'derived from other values; inherits their authority requirement',
    };
  }
  return {
    ...base,
    kind: 'UNCLASSIFIED',
    // Fail closed: an unrecognised field is treated as if it needed authority.
    requiresOfficialAuthority: true,
    rationale: 'field not recognised; treated as authority-requiring',
  };
}

export interface ClaimAdmission {
  readonly admitted: boolean;
  readonly classification: ClaimClassification;
  readonly reason: string;
}

/**
 * Decide whether a claim may be presented as verified.
 *
 * A FINANCIAL_DATA_CLAIM is admitted only when its value is current official
 * authority. A BUSINESS_RULE is admitted without authority but is never
 * labelled verified — that distinction is carried into presentation.
 */
export function admitClaim<T>(
  claim: ClaimDescriptor,
  value: AuthorityValue<T>,
): ClaimAdmission {
  const classification = classifyClaim(claim);
  if (!classification.requiresOfficialAuthority) {
    return {
      admitted: true,
      classification,
      reason: 'business rule does not require official authority',
    };
  }
  if (isCurrentAuthority(value)) {
    return {
      admitted: true,
      classification,
      reason: 'backed by current official authority',
    };
  }
  return {
    admitted: false,
    classification,
    reason: `financial claim lacks current official authority (state=${value.state})`,
  };
}
