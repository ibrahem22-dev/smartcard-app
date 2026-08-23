/**
 * WHAT THE PROVENANCE CHIP SHOWS — criterion A2, decided here and rendered elsewhere.
 *
 *   > **A2.** *"The four-state provenance chip (Verified / Your value / Estimate / Unknown) **plus
 *   > the Stale modifier** is one shared primitive; no screen constructs chip markup locally."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS IS A MAPPING, NOT A SECOND VOCABULARY, and criterion B5 is why:
 *
 *   > **B5.** *"`USER` is the same enum member the Data Contract defines. **No second provenance
 *   > vocabulary.**"*
 *
 * `src/authority/authorityValue.ts` already defines five authority states and four provenances, and
 * `presentation.ts` already folds them into six presentation tones. A chip that invented its own
 * four names beside those would be the third vocabulary for one fact — so the chip has no
 * vocabulary of its own. It has a VIEW of the existing one, and this file is the whole of it.
 *
 * The decision is separated from the component so it can be tested without rendering anything, and
 * so that a reviewer checking A2 against the Data Contract reads one table instead of a JSX tree.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CHIP REFUSES TO SPEAK FOR A CONFLICT, and that refusal is the point.
 *
 * `DISPUTED` — sources disagree — maps to NO CHIP. Not to "Estimate", not to "Unknown". A conflict
 * has a shared component of its own (`ConflictedValue`, criterion A3) whose whole job is to render
 * every competing reading **with no winner and no default selection**. A chip is a single badge; the
 * moment one is shown for a conflict, a winner has been picked by the act of choosing which badge.
 *
 * So `chipStateFor` returns `null`, and the caller must reach for `ConflictedValue`. A `null` that
 * forces a better component is worth more than a badge that quietly resolves a disagreement the
 * pipeline deliberately refused to resolve.
 */
import type { PresentationTone } from '../authority/presentation';
import type { Provenance } from '../authority/authorityValue';

/** The four states A2 names. `stale` is a MODIFIER on top of one of these, never a fifth state. */
export const CHIP_STATES = ['verified', 'user', 'estimate', 'unknown'] as const;
export type ChipState = (typeof CHIP_STATES)[number];

export interface ChipView {
  readonly state: ChipState;
  /** A2's Stale modifier. True when the value was true once and is not current authority. */
  readonly stale: boolean;
}

/**
 * The tone → state table. Every `PresentationTone` appears exactly once, so a tone added upstream
 * makes this fail to compile rather than fall through to a default — a `default:` branch here would
 * quietly render "Unknown" for a state nobody had thought about, which is a confident answer about
 * somebody's money produced by an oversight.
 */
const BY_TONE: Readonly<Record<PresentationTone, ChipView | null>> = {
  VERIFIED: { state: 'verified', stale: false },
  UNVERIFIED_INPUT: { state: 'user', stale: false },
  UNAVAILABLE: { state: 'unknown', stale: false },
  WITHHELD: { state: 'unknown', stale: false },
  STALE: { state: 'verified', stale: true },
  // See the header. A conflict gets ConflictedValue, never a badge.
  DISPUTED: null,
};

/**
 * `UNVERIFIED_INPUT` covers two different things and the chip must not: a number the USER typed is
 * "Your value", and a number the app DERIVED or read from a bundled dataset is an "Estimate".
 * Telling a user their own figure is an estimate is wrong in one direction; calling the app's
 * estimate their value is wrong in the other, and worse.
 */
const BY_PROVENANCE: Readonly<Record<Provenance, ChipState>> = {
  OFFICIAL_AUTHORITY: 'verified',
  USER_INPUT: 'user',
  BUNDLED_DATASET: 'estimate',
  DERIVED_CALCULATION: 'estimate',
};

/**
 * Which chip a presentation deserves, or `null` when no single badge can honestly stand for it.
 *
 * `provenance` is optional because not every tone carries one. When it is present and the tone is
 * ambiguous between "your value" and "estimate", it decides — that is the only thing it is allowed
 * to do, so a provenance can never override a VERIFIED or turn an UNAVAILABLE into a number.
 */
export function chipStateFor(
  tone: PresentationTone,
  provenance?: Provenance,
): ChipView | null {
  const base = BY_TONE[tone];
  if (base === null) return null;
  if (tone === 'UNVERIFIED_INPUT' && provenance !== undefined) {
    return { state: BY_PROVENANCE[provenance], stale: base.stale };
  }
  return base;
}

/**
 * THE LABEL EACH STATE CARRIES, as a Hebrew source string.
 *
 * This project's `t()` takes the Hebrew text itself and looks up Arabic and English by it — there
 * is no key namespace. Inventing one for the chip would have made it the only component in the app
 * translated a different way, and `arabicCoverage.test.ts` — which walks the Hebrew sources and
 * demands an Arabic entry for each — would not have seen the chip at all.
 *
 * A2 names the four states in English; these are their Hebrew equivalents, and `ar.ts` / `en.ts`
 * carry the other two languages.
 */
export const CHIP_LABEL: Readonly<Record<ChipState, string>> = {
  verified: 'מאומת',
  user: 'הערך שלך',
  estimate: 'הערכה',
  unknown: 'לא ידוע',
};

/**
 * A2's Stale MODIFIER. Rendered ALONGSIDE the state's label and never instead of it — that is what
 * makes it a modifier rather than a fifth state, and it is the difference between "this was
 * verified and may be out of date" and "we do not know".
 */
export const CHIP_STALE_LABEL = 'לא עדכני';
