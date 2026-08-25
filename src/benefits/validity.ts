/**
 * THE FIRST TWO PURE KERNELS OF THE BENEFITS MATCHING ENGINE.
 *
 * PD-P3-007 gives the ADR-019 validity-clock and stacking judgements a production home while the
 * rest of the Benefits Matching Engine remains a product-spec §20.3 / V1.x concern. They consume
 * adapter-published facts and return judgements; no pack, adapter, or test harness owns this logic.
 *
 * @authority ADR-011 §5
 * @authority spec §20.3
 */

export type StackingResolution =
  | 'MAY_SUM'
  | 'MUST_NOT_SUM_EXPLICIT'
  | 'MUST_NOT_SUM_DEFAULT';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(label: string, value: string): void {
  if (!ISO_DATE.test(value)) {
    throw new Error(`${label}: expected yyyy-mm-dd`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label}: expected a real calendar date`);
  }
}

/**
 * Whether a benefit's published validity window has closed at the caller's pinned clock.
 *
 * Missing and `UNTIL_FURTHER_NOTICE` are open-ended facts, not dates to coerce. A benefit remains
 * valid through its `validUntil` day and closes only after it, matching the ordinary meaning of
 * “valid until”.
 */
export function hasClosed(validUntil: string | undefined, asOf: string): boolean {
  assertDate('asOf', asOf);
  if (validUntil === undefined || validUntil === 'UNTIL_FURTHER_NOTICE') return false;
  assertDate('validUntil', validUntil);
  return validUntil < asOf;
}

/** Resolve two published stacking rules according to ADR-011 §5's fail-closed treatment. */
export function resolveStackingPair(
  left: string | undefined,
  right: string | undefined,
): StackingResolution {
  if (left === 'STACKS' && right === 'STACKS') return 'MAY_SUM';
  if (left === 'MUTUALLY_EXCLUSIVE' || right === 'MUTUALLY_EXCLUSIVE') {
    return 'MUST_NOT_SUM_EXPLICIT';
  }
  return 'MUST_NOT_SUM_DEFAULT';
}
