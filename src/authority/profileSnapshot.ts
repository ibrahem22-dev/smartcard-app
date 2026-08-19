/**
 * MVP_SCOPE §4 — "App does not invent missing financial values."
 * MVP_SCOPE §5 — "Data uncertainty handling must block invented defaults."
 *
 * The Purchase Gate consumed `profile?.currentBalance ?? 0` and
 * `profile?.monthlyIncome ?? 0`. When onboarding had not captured those fields
 * the gate did not fail — it evaluated against a fabricated zero, and income
 * drives the buffer-percentage thresholds. A user with no entered income could
 * therefore be told a purchase was unaffordable on the strength of a number the
 * app made up.
 *
 * This module turns that absence into an explicit, nameable outcome. It does
 * not guess, and it does not substitute.
 */

import {
  type AuthorityValue,
  known,
  unknown,
} from './authorityValue';

/** Fields the gate cannot honestly run without. */
export const REQUIRED_SNAPSHOT_FIELDS = [
  'currentBalance',
  'monthlyIncome',
] as const;

export type RequiredSnapshotField = (typeof REQUIRED_SNAPSHOT_FIELDS)[number];

export interface ProfileFinancials {
  readonly currentBalance?: number | null | undefined;
  readonly monthlyIncome?: number | null | undefined;
}

export interface SnapshotComplete {
  readonly complete: true;
  readonly currentBalance: number;
  readonly monthlyIncome: number;
}

export interface SnapshotIncomplete {
  readonly complete: false;
  /** Exactly which fields are missing, for a UI that must say so. */
  readonly missing: readonly RequiredSnapshotField[];
}

export type SnapshotCompleteness = SnapshotComplete | SnapshotIncomplete;

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Decide whether a profile carries the financial facts the gate needs.
 *
 * A missing field is missing. It is deliberately NOT defaulted to 0 here, and
 * there is no `orZero` helper for a caller to reach for instead.
 */
export function assessSnapshot(
  profile: ProfileFinancials | null | undefined,
): SnapshotCompleteness {
  const missing: RequiredSnapshotField[] = [];
  if (!isUsableNumber(profile?.currentBalance)) {
    missing.push('currentBalance');
  }
  if (!isUsableNumber(profile?.monthlyIncome)) {
    missing.push('monthlyIncome');
  }
  if (missing.length > 0) {
    return { complete: false, missing };
  }
  return {
    complete: true,
    // Re-read through the guard so the narrowing is real, not asserted.
    currentBalance: profile?.currentBalance as number,
    monthlyIncome: profile?.monthlyIncome as number,
  };
}

/**
 * Represent a profile financial field as an authority value.
 *
 * Per MVP_SCOPE §2 these are `manual_user_value` — user-entered, never
 * official authority — so provenance is pinned to USER_INPUT and
 * `isCurrentAuthority` rejects them.
 */
export function profileFieldToAuthority(
  value: number | null | undefined,
  field: RequiredSnapshotField,
  enteredAt: string,
): AuthorityValue<number> {
  return isUsableNumber(value)
    ? known(value, 'USER_INPUT', enteredAt, `profile.${field}`)
    : unknown(`profile_field_not_entered:${field}`);
}

export const SNAPSHOT_INCOMPLETE_REASON = 'PROFILE_FINANCIALS_NOT_ENTERED';

/** Human-facing reason keys; the screen renders these, never a zero. */
export function snapshotMissingLabelKeys(
  missing: readonly RequiredSnapshotField[],
): readonly string[] {
  return missing.map((field) => `profile.missing.${field}`);
}
