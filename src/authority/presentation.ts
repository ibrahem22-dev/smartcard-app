/**
 * W1-AS-03 — UI-safe presentation of unavailable authority.
 *
 * The rule this module enforces: an unavailable value never reaches the screen
 * as "0", "0%", "₪0", "free", "none" or "verified". Those readings are worse
 * than showing nothing, because each is a confident financial statement the app
 * has no basis for.
 *
 * Presentation returns a DESCRIPTOR rather than a string so callers cannot
 * concatenate a number onto an unavailable value: `amountText` is null unless
 * the value is genuinely current authority.
 */

import {
  AUTHORITY_GRADE_PROVENANCES,
  type AuthorityValue,
  foldAuthority,
} from './authorityValue';

export const PRESENTATION_TONES = [
  'VERIFIED',
  'UNAVAILABLE',
  'WITHHELD',
  'DISPUTED',
  'STALE',
  'UNVERIFIED_INPUT',
] as const;

export type PresentationTone = (typeof PRESENTATION_TONES)[number];

export interface AuthorityPresentation {
  readonly tone: PresentationTone;
  /** i18n key. Never a pre-rendered financial string. */
  readonly labelKey: string;
  /** The formatted value, ONLY when current official authority backs it. */
  readonly amountText: string | null;
  /** True when the UI may attach a "verified" affordance. */
  readonly mayShowAsVerified: boolean;
  /** Machine-readable why, for support and audit. */
  readonly detail: string;
}

/** Strings that must never be emitted for an unavailable value. */
export const FORBIDDEN_UNAVAILABLE_RENDERINGS: readonly string[] = [
  '0',
  '0%',
  '0.0%',
  '₪0',
  '$0',
  'free',
  'none',
  'no fee',
  'verified',
  'חינם',
  'ללא עמלה',
  'مجانا',
];

export type AmountFormatter<T> = (value: T) => string;

/**
 * Build a presentation descriptor for any authority value.
 *
 * `format` is applied ONLY on the current-authority path. It is never called
 * for UNKNOWN/BLOCKED/CONFLICT, so a formatter that maps undefined to "0"
 * cannot be reached with an unavailable value.
 */
export function presentAuthority<T>(
  value: AuthorityValue<T>,
  format: AmountFormatter<T>,
): AuthorityPresentation {
  return foldAuthority<T, AuthorityPresentation>(value, {
    // Provenance is checked directly rather than through isCurrentAuthority:
    // inside onKnown the value is already narrowed to KnownAuthority, so the
    // type predicate would narrow the negative branch to `never`.
    onKnown: (k) =>
      AUTHORITY_GRADE_PROVENANCES.includes(k.provenance)
        ? {
            tone: 'VERIFIED',
            labelKey: 'authority.verified',
            amountText: format(k.value),
            mayShowAsVerified: true,
            detail: `official authority observed ${k.observedAt}`,
          }
        : {
            // KNOWN but not authority-grade: the number exists and may be
            // shown, but never with a verified affordance.
            tone: 'UNVERIFIED_INPUT',
            labelKey: 'authority.unverified',
            amountText: format(k.value),
            mayShowAsVerified: false,
            detail: `provenance ${k.provenance} is not official authority`,
          },
    onUnknown: (u) => ({
      tone: 'UNAVAILABLE',
      labelKey: 'authority.unknown',
      amountText: null,
      mayShowAsVerified: false,
      detail: u.reason,
    }),
    onBlocked: (b) => ({
      tone: 'WITHHELD',
      labelKey: 'authority.blocked',
      amountText: null,
      mayShowAsVerified: false,
      detail: b.reason,
    }),
    onConflict: (c) => ({
      tone: 'DISPUTED',
      labelKey: 'authority.conflict',
      amountText: null,
      mayShowAsVerified: false,
      detail: `${c.candidates.length} competing sources: ${c.reason}`,
    }),
    onHistorical: (h) => ({
      // A stale number may be shown as history, but never as the current rate
      // and never as verified.
      tone: 'STALE',
      labelKey: 'authority.historical',
      amountText: format(h.value),
      mayShowAsVerified: false,
      detail: `historical value observed ${h.observedAt}`,
    }),
  });
}

/** Currency symbols and separators stripped before testing for a zero amount. */
const AMOUNT_DECORATION = /[\s%₪$€£,]/g;

/**
 * True when a rendering reads as a zero amount in ANY precision or currency
 * form: "0", "0%", "0.00%", "₪0", "0.000".
 *
 * Deliberately not an exact-match list. The first version of this guard
 * enumerated string forms and "0.00%" walked straight through it — every added
 * decimal place would have needed a new entry.
 */
export function rendersAsZeroAmount(rendered: string): boolean {
  const stripped = rendered.replace(AMOUNT_DECORATION, '');
  if (stripped === '') {
    return false;
  }
  if (!/^-?\d*\.?\d+$/.test(stripped)) {
    return false;
  }
  return Number(stripped) === 0;
}

/**
 * Guard for tests and defensive call sites: assert a rendering never presents
 * an unavailable value as a confident financial statement.
 */
export function assertSafeRendering(
  presentation: AuthorityPresentation,
  rendered: string,
): void {
  if (presentation.amountText !== null) {
    return;
  }
  const normalized = rendered.trim().toLowerCase();
  if (rendersAsZeroAmount(normalized)) {
    throw new Error(
      `unavailable authority (${presentation.tone}) rendered as zero amount "${rendered}"`,
    );
  }
  const offending = FORBIDDEN_UNAVAILABLE_RENDERINGS.find(
    (forbidden) => normalized === forbidden.toLowerCase(),
  );
  if (offending !== undefined) {
    throw new Error(
      `unavailable authority (${presentation.tone}) rendered as "${offending}"`,
    );
  }
}
