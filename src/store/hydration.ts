/**
 * MVP_SCOPE §5 — "Store rehydration/lifecycle is unsafe or incomplete."
 *
 * Every persisted store starts at its empty default (`cards: []`,
 * `activeProfile: null`) and fills in when `hydrate()` runs. Nothing recorded
 * whether that had happened yet, so an unloaded store was indistinguishable
 * from a genuinely empty one.
 *
 * That is not cosmetic. `usePurchaseGate` reads `cards.length === 0` and tells
 * the user "no cards found — add a card first". Before hydration completed, a
 * user who owned cards was told they owned none. And because
 * `keyVault.getEncryptedStorage()` throws while the vault is locked (AUTH-07),
 * a failed hydration left the same empty defaults behind with no way to know.
 *
 * This is the `?? 0` problem in a different costume: absence rendered as a
 * confident empty answer. The remedy is the same — make the unloaded and failed
 * cases states you cannot read past by accident.
 */

export const HYDRATION_STATUSES = [
  'NOT_HYDRATED',
  'HYDRATING',
  'HYDRATED',
  'FAILED',
] as const;

export type HydrationStatus = (typeof HYDRATION_STATUSES)[number];

export interface HydrationState {
  readonly status: HydrationStatus;
  /** Set only on FAILED. */
  readonly error?: string | undefined;
  /** Set only on HYDRATED. */
  readonly hydratedAt?: string | undefined;
}

export const NOT_HYDRATED: HydrationState = { status: 'NOT_HYDRATED' };
export const HYDRATING: HydrationState = { status: 'HYDRATING' };

export function hydrated(at: string): HydrationState {
  return { status: 'HYDRATED', hydratedAt: at };
}

export function hydrationFailed(error: string): HydrationState {
  return { status: 'FAILED', error };
}

/**
 * The ONLY sanctioned test for "is this collection's emptiness meaningful?".
 *
 * A store that has not hydrated, is hydrating, or failed to hydrate cannot
 * report a trustworthy count — its emptiness is an artifact of loading, not a
 * fact about the user.
 */
export function isCountTrustworthy(state: HydrationState): boolean {
  return state.status === 'HYDRATED';
}

/**
 * True only when the store has loaded AND is genuinely empty.
 *
 * This is what a "you have no cards, add one" prompt must be gated on. Reading
 * `items.length === 0` directly is the bug.
 */
export function isKnownEmpty(state: HydrationState, count: number): boolean {
  return isCountTrustworthy(state) && count === 0;
}

/** True when the UI should show a loading affordance rather than empty state. */
export function isPending(state: HydrationState): boolean {
  return state.status === 'NOT_HYDRATED' || state.status === 'HYDRATING';
}

export const COLLECTION_READINESS = [
  'PENDING',
  'KNOWN_EMPTY',
  'KNOWN_POPULATED',
  'UNAVAILABLE',
] as const;

export type CollectionReadiness = (typeof COLLECTION_READINESS)[number];

/**
 * Classify a persisted collection for a consumer that must branch on it.
 *
 * Exhaustive by construction, so a caller cannot forget the PENDING or
 * UNAVAILABLE case the way `length === 0` silently folds them into empty.
 */
export function classifyCollection(
  state: HydrationState,
  count: number,
): CollectionReadiness {
  switch (state.status) {
    case 'NOT_HYDRATED':
    case 'HYDRATING':
      return 'PENDING';
    case 'FAILED':
      return 'UNAVAILABLE';
    case 'HYDRATED':
      return count === 0 ? 'KNOWN_EMPTY' : 'KNOWN_POPULATED';
    default: {
      const exhaustive: never = state.status;
      throw new Error(`unhandled hydration status: ${String(exhaustive)}`);
    }
  }
}

/** Normalise a thrown value into a recordable reason without losing it. */
export function describeHydrationError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return typeof error === 'string' ? error : 'unknown_hydration_error';
}
