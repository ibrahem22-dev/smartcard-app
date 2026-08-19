/**
 * W1-AS-02 — Five-state authority values.
 *
 * A financial value the app did not verify must never reach the user as a
 * number. The five states below are STRUCTURAL: an unavailable value has no
 * `value` property at all, so "display the amount" cannot silently render 0,
 * and `undefined ?? 0` cannot manufacture one.
 *
 *   KNOWN       verified current authority; carries a value
 *   UNKNOWN     not established; carries NO value
 *   BLOCKED     deliberately withheld (integration disabled, gate closed)
 *   CONFLICT    sources disagree; carries the candidates, never a winner
 *   HISTORICAL  was true once; carries a value that is NOT current authority
 *
 * HISTORICAL deliberately carries a value while failing `isCurrentAuthority`.
 * That is the trap this module exists to close: a stale number is the easiest
 * thing in the system to mistake for a current one.
 */

export const AUTHORITY_STATES = [
  'KNOWN',
  'UNKNOWN',
  'BLOCKED',
  'CONFLICT',
  'HISTORICAL',
] as const;

export type AuthorityState = (typeof AUTHORITY_STATES)[number];

/** Where a value came from. USER_INPUT is never official authority. */
export const PROVENANCES = [
  'OFFICIAL_AUTHORITY',
  'BUNDLED_DATASET',
  'USER_INPUT',
  'DERIVED_CALCULATION',
] as const;

export type Provenance = (typeof PROVENANCES)[number];

/** Provenances that may back a KNOWN authority value. */
export const AUTHORITY_GRADE_PROVENANCES: readonly Provenance[] = [
  'OFFICIAL_AUTHORITY',
];

export interface KnownAuthority<T> {
  readonly state: 'KNOWN';
  readonly value: T;
  readonly provenance: Provenance;
  readonly observedAt: string;
  // Explicit `| undefined`: the project runs exactOptionalPropertyTypes, so an
  // optional field that may be assigned undefined must say so.
  readonly sourceId?: string | undefined;
}

export interface UnknownAuthority {
  readonly state: 'UNKNOWN';
  readonly reason: string;
}

export interface BlockedAuthority {
  readonly state: 'BLOCKED';
  readonly reason: string;
}

export interface ConflictAuthority<T> {
  readonly state: 'CONFLICT';
  /** Every competing candidate is preserved. None is promoted to an answer. */
  readonly candidates: readonly ConflictCandidate<T>[];
  readonly reason: string;
}

export interface ConflictCandidate<T> {
  readonly value: T;
  readonly provenance: Provenance;
  readonly sourceId?: string | undefined;
  readonly observedAt?: string | undefined;
}

export interface HistoricalAuthority<T> {
  readonly state: 'HISTORICAL';
  readonly value: T;
  readonly observedAt: string;
  readonly supersededAt?: string | undefined;
  readonly provenance: Provenance;
}

export type AuthorityValue<T> =
  | KnownAuthority<T>
  | UnknownAuthority
  | BlockedAuthority
  | ConflictAuthority<T>
  | HistoricalAuthority<T>;

// --- constructors ---------------------------------------------------------

export function known<T>(
  value: T,
  provenance: Provenance,
  observedAt: string,
  sourceId?: string,
): KnownAuthority<T> {
  return { state: 'KNOWN', value, provenance, observedAt, sourceId };
}

export function unknown(reason: string): UnknownAuthority {
  return { state: 'UNKNOWN', reason };
}

export function blocked(reason: string): BlockedAuthority {
  return { state: 'BLOCKED', reason };
}

export function conflict<T>(
  candidates: readonly ConflictCandidate<T>[],
  reason: string,
): ConflictAuthority<T> {
  return { state: 'CONFLICT', candidates, reason };
}

export function historical<T>(
  value: T,
  provenance: Provenance,
  observedAt: string,
  supersededAt?: string,
): HistoricalAuthority<T> {
  return { state: 'HISTORICAL', value, observedAt, supersededAt, provenance };
}

// --- predicates -----------------------------------------------------------

export function isKnown<T>(v: AuthorityValue<T>): v is KnownAuthority<T> {
  return v.state === 'KNOWN';
}

export function isHistorical<T>(v: AuthorityValue<T>): v is HistoricalAuthority<T> {
  return v.state === 'HISTORICAL';
}

export function isConflict<T>(v: AuthorityValue<T>): v is ConflictAuthority<T> {
  return v.state === 'CONFLICT';
}

/**
 * The ONLY sanctioned test for "may I use this as a current, official value?".
 *
 * HISTORICAL fails here even though it has a value, and a KNOWN value fails
 * unless its provenance is authority-grade — a bundled dataset or a
 * user-entered number is not official authority no matter how confident the
 * surrounding code is.
 */
export function isCurrentAuthority<T>(v: AuthorityValue<T>): v is KnownAuthority<T> {
  return v.state === 'KNOWN' && AUTHORITY_GRADE_PROVENANCES.includes(v.provenance);
}

/** True when the value carries no usable number at all. */
export function isUnavailable<T>(v: AuthorityValue<T>): boolean {
  return v.state === 'UNKNOWN' || v.state === 'BLOCKED' || v.state === 'CONFLICT';
}

// --- safe access ----------------------------------------------------------

/**
 * Exhaustive fold. Every state must be handled explicitly, so adding a state
 * later becomes a compile error at each call site rather than a silent
 * fall-through to a default.
 */
export interface AuthorityFold<T, R> {
  readonly onKnown: (v: KnownAuthority<T>) => R;
  readonly onUnknown: (v: UnknownAuthority) => R;
  readonly onBlocked: (v: BlockedAuthority) => R;
  readonly onConflict: (v: ConflictAuthority<T>) => R;
  readonly onHistorical: (v: HistoricalAuthority<T>) => R;
}

export function foldAuthority<T, R>(
  value: AuthorityValue<T>,
  fold: AuthorityFold<T, R>,
): R {
  switch (value.state) {
    case 'KNOWN':
      return fold.onKnown(value);
    case 'UNKNOWN':
      return fold.onUnknown(value);
    case 'BLOCKED':
      return fold.onBlocked(value);
    case 'CONFLICT':
      return fold.onConflict(value);
    case 'HISTORICAL':
      return fold.onHistorical(value);
    default: {
      const exhaustive: never = value;
      throw new Error(
        `unhandled authority state: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}

/**
 * Read a current-authority value or get null. There is deliberately no
 * `unwrapOr(fallback)`: a caller that wants a default must write the default
 * itself, in view, rather than receiving a fabricated number from this module.
 */
export function currentAuthorityOrNull<T>(v: AuthorityValue<T>): T | null {
  return isCurrentAuthority(v) ? v.value : null;
}

export class AuthorityUnavailableError extends Error {
  public readonly state: AuthorityState;

  constructor(state: AuthorityState, reason: string) {
    super(`authority value is ${state}: ${reason}`);
    this.name = 'AuthorityUnavailableError';
    this.state = state;
  }
}

/** Read a current-authority value or throw. Never returns a substitute. */
export function requireCurrentAuthority<T>(v: AuthorityValue<T>): T {
  if (isCurrentAuthority(v)) {
    return v.value;
  }
  const reason = foldAuthority<T, string>(v, {
    onKnown: (k) => `provenance ${k.provenance} is not authority-grade`,
    onUnknown: (u) => u.reason,
    onBlocked: (b) => b.reason,
    onConflict: (c) => c.reason,
    onHistorical: (h) => `superseded; observed ${h.observedAt}`,
  });
  throw new AuthorityUnavailableError(v.state, reason);
}
