/**
 * W1-AS-06 — Manual / user input boundary.
 *
 * A number the user typed is a number the user typed. It may be stored, shown
 * back, and used for the user's own calculations — but it can never become
 * official authority, and it must never acquire a verified affordance by
 * passing through enough layers.
 *
 * The boundary is enforced by construction: `acceptManualInput` can only ever
 * produce provenance USER_INPUT, which `isCurrentAuthority` rejects.
 */

import {
  type AuthorityValue,
  type KnownAuthority,
  known,
  unknown,
} from './authorityValue';

export interface ManualInputRequest {
  readonly field: string;
  readonly rawValue: string;
  readonly enteredAt: string;
  readonly enteredBy?: string;
}

export interface ManualNumberPolicy {
  readonly min?: number;
  readonly max?: number;
  /** Reject values with more precision than the field can mean. */
  readonly maxDecimals?: number;
}

export interface ManualInputRejection {
  readonly accepted: false;
  readonly field: string;
  readonly reason: string;
}

export interface ManualInputAcceptance {
  readonly accepted: true;
  readonly field: string;
  readonly value: KnownAuthority<number>;
}

export type ManualInputOutcome = ManualInputAcceptance | ManualInputRejection;

function countDecimals(text: string): number {
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * Validate and admit a user-entered number.
 *
 * Note the return type: acceptance yields a KnownAuthority whose provenance is
 * pinned to USER_INPUT. There is no parameter to override it, so no caller can
 * launder manual input into OFFICIAL_AUTHORITY.
 */
export function acceptManualInput(
  request: ManualInputRequest,
  policy: ManualNumberPolicy = {},
): ManualInputOutcome {
  const raw = request.rawValue.trim();
  if (raw === '') {
    return { accepted: false, field: request.field, reason: 'empty_input' };
  }
  // Reject anything that is not a plain decimal number: no thousands
  // separators, no currency symbols, no exponent notation.
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    return { accepted: false, field: request.field, reason: 'not_a_plain_number' };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return { accepted: false, field: request.field, reason: 'not_finite' };
  }
  if (policy.min !== undefined && parsed < policy.min) {
    return { accepted: false, field: request.field, reason: 'below_minimum' };
  }
  if (policy.max !== undefined && parsed > policy.max) {
    return { accepted: false, field: request.field, reason: 'above_maximum' };
  }
  if (policy.maxDecimals !== undefined && countDecimals(raw) > policy.maxDecimals) {
    return { accepted: false, field: request.field, reason: 'too_many_decimals' };
  }
  return {
    accepted: true,
    field: request.field,
    value: known(parsed, 'USER_INPUT', request.enteredAt, request.enteredBy),
  };
}

/** Convert an outcome into an authority value, preserving the rejection reason. */
export function manualInputToAuthority(
  outcome: ManualInputOutcome,
): AuthorityValue<number> {
  return outcome.accepted
    ? outcome.value
    : unknown(`manual_input_rejected:${outcome.reason}`);
}

/**
 * Explicit assertion for call sites that must never receive manual input --
 * for example anything that writes an official-authority record.
 */
export function assertNotUserInput<T>(value: AuthorityValue<T>, context: string): void {
  if (value.state === 'KNOWN' && value.provenance === 'USER_INPUT') {
    throw new Error(
      `${context}: user input may not be used as official authority`,
    );
  }
}
