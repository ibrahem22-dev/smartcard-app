/**
 * W1-AS-05 — Feature Data Requirements.
 *
 * A feature declares which fields it needs and at what grade. The gate then
 * answers from real authority states rather than from a boolean someone set by
 * hand. A feature that requires official authority stays unavailable while the
 * adapter is disabled — which is the correct behaviour, not a bug to route
 * around with bundled data.
 */

import {
  type AuthorityValue,
  isCurrentAuthority,
  isHistorical,
} from './authorityValue';
import {
  type AuthorityLookup,
  type DataAuthorityAdapter,
} from './DataAuthorityAdapter';

export const REQUIREMENT_GRADES = [
  'OFFICIAL_AUTHORITY_REQUIRED',
  'ANY_KNOWN_VALUE',
  'OPTIONAL',
] as const;

export type RequirementGrade = (typeof REQUIREMENT_GRADES)[number];

export interface FeatureDataRequirement {
  readonly field: string;
  readonly grade: RequirementGrade;
}

export interface FeatureRequirementSpec {
  readonly featureId: string;
  readonly requirements: readonly FeatureDataRequirement[];
}

export interface UnmetRequirement {
  readonly field: string;
  readonly grade: RequirementGrade;
  readonly state: string;
  readonly reason: string;
}

export interface FeatureAvailability {
  readonly featureId: string;
  readonly available: boolean;
  /** True when the feature can run but some optional data is missing. */
  readonly degraded: boolean;
  readonly unmet: readonly UnmetRequirement[];
}

function describe<T>(value: AuthorityValue<T>): string {
  switch (value.state) {
    case 'UNKNOWN':
      return value.reason;
    case 'BLOCKED':
      return value.reason;
    case 'CONFLICT':
      return value.reason;
    case 'HISTORICAL':
      return `historical value observed ${value.observedAt}`;
    case 'KNOWN':
      return `provenance ${value.provenance}`;
    default: {
      const exhaustive: never = value;
      return JSON.stringify(exhaustive);
    }
  }
}

function meets<T>(grade: RequirementGrade, value: AuthorityValue<T>): boolean {
  switch (grade) {
    case 'OFFICIAL_AUTHORITY_REQUIRED':
      return isCurrentAuthority(value);
    case 'ANY_KNOWN_VALUE':
      // HISTORICAL is explicitly NOT a known current value here: a stale rate
      // satisfying "any known value" is exactly how stale numbers reach a UI.
      return value.state === 'KNOWN';
    case 'OPTIONAL':
      return true;
    default: {
      const exhaustive: never = grade;
      throw new Error(`unhandled requirement grade: ${String(exhaustive)}`);
    }
  }
}

export function evaluateFeatureRequirements(
  spec: FeatureRequirementSpec,
  resolve: (field: string) => AuthorityValue<unknown>,
): FeatureAvailability {
  const unmet: UnmetRequirement[] = [];
  let degraded = false;

  for (const requirement of spec.requirements) {
    const value = resolve(requirement.field);
    if (meets(requirement.grade, value)) {
      if (requirement.grade === 'OPTIONAL' && !isCurrentAuthority(value)) {
        degraded = true;
      }
      continue;
    }
    unmet.push({
      field: requirement.field,
      grade: requirement.grade,
      state: value.state,
      reason: describe(value),
    });
  }

  return {
    featureId: spec.featureId,
    available: unmet.length === 0,
    degraded,
    unmet,
  };
}

/** Evaluate against the installed adapter (disabled by default). */
export function evaluateAgainstAdapter(
  spec: FeatureRequirementSpec,
  entityId: string,
  adapter: DataAuthorityAdapter,
): FeatureAvailability {
  return evaluateFeatureRequirements(spec, (field) => {
    const lookup: AuthorityLookup = { field, entityId };
    return adapter.lookupNumber(lookup);
  });
}

/** True when a historical value is being offered where current data is needed. */
export function isStaleSubstitution<T>(
  grade: RequirementGrade,
  value: AuthorityValue<T>,
): boolean {
  return isHistorical(value) && grade !== 'OPTIONAL';
}
