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

/**
 * WHERE A VALUE CAME FROM — the Data Contract's four-state chip, and nothing else.
 *
 * This module used to declare its own:
 *
 *     PROVENANCES = ['OFFICIAL_AUTHORITY', 'BUNDLED_DATASET', 'USER_INPUT', 'DERIVED_CALCULATION']
 *
 * Data Contract §2.2 predicted that in writing — *"without `USER` in this enum, the application
 * inevitably grows a second provenance enum for overrides, and two enums for one concept is exactly
 * the divergence class this contract exists to prevent"* — and it happened anyway, because nothing
 * compared the app against the contract.
 *
 * Criterion B5 ends it: one vocabulary, and it is `src/authority/provenanceChip.ts`, mirrored from
 * §2 and parity-checked in the pipeline preflight.
 */
export type { ProvenanceChip as Provenance } from './provenanceChip';
export { PROVENANCE_CHIPS as PROVENANCES } from './provenanceChip';

/**
 * The chips that may back a KNOWN authority value with a verified affordance.
 *
 * Derived from the contract's own `mayRenderAsVerified` column rather than restated — `USER` is
 * `calculationSafe` and still may NOT render as verified, because §2.1 says it renders as "Your
 * value", a different claim and a truer one. The derivation lives beside the table in
 * `provenanceChip.ts`; computing it here created a module-initialisation cycle.
 */
export { AUTHORITY_GRADE_CHIPS as AUTHORITY_GRADE_PROVENANCES } from './provenanceChip';

import {
  AUTHORITY_GRADE_CHIPS,
  type ProvenanceChip as ProvenanceChipType,
} from './provenanceChip';

/**
 * The local name every signature in this module uses. It IS the contract's chip — aliased rather
 * than redeclared, so there is exactly one type and `Provenance` remains a readable word at the
 * call sites that have used it since before the contract was consulted.
 */
type Provenance = ProvenanceChipType;

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
  /**
   * WHERE THIS READING APPLIES — criterion A3, which requires every competing reading to be shown
   * "with its scope and its source".
   *
   * Two sources disagreeing about one number are often not disagreeing at all: one is quoting the
   * rate for a card tier and the other for the whole issuer, or one covers purchases abroad and the
   * other cash withdrawals. Showing both figures without saying what each one COVERS turns a
   * difference of scope into an apparent contradiction, and a user reading two numbers with no
   * scope has no way to tell which describes them.
   *
   * Optional because the pipeline does not always carry one, and a scope this app invented would be
   * worse than none.
   */
  readonly scope?: string | undefined;
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
  return v.state === 'KNOWN' && AUTHORITY_GRADE_CHIPS.includes(v.provenance);
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
