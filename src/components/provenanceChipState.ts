import type { PresentationTone } from '../authority/presentation';
import {
  PROVENANCE_CHIPS,
  type ProvenanceChip,
  type ProvenanceRecord,
} from '../authority/provenanceChip';

/**
 * WHAT THE PROVENANCE CHIP SHOWS — criterion A2, and the vocabulary is the Data Contract's.
 *
 *   > **A2.** *"The four-state provenance chip (Verified / Your value / Estimate / Unknown) **plus
 *   > the Stale modifier** is one shared primitive; no screen constructs chip markup locally."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS FILE WAS A SECOND VOCABULARY AND ITS HEADER SAID IT WAS NOT
 *
 * The first version declared `CHIP_STATES = ['verified', 'user', 'estimate', 'unknown']` — lowercase
 * names of its own — and opened with a confident paragraph titled *"THIS IS A MAPPING, NOT A SECOND
 * VOCABULARY"*, citing criterion B5. The author had checked the app's `PROVENANCES` enum and
 * concluded that was canonical.
 *
 * It was not. `SMARTCARD_DATA_CONTRACT.md` §2.1 defines the Layer-B chip as **exactly four states,
 * `USER · VERIFIED · ESTIMATE · UNKNOWN`**, and calls that *"a published product promise"*. The app
 * had already grown a second enum (`OFFICIAL_AUTHORITY`, `BUNDLED_DATASET`, `USER_INPUT`,
 * `DERIVED_CALCULATION`) — precisely what §2.2 predicts in writing — and this file made it a third.
 *
 * The states below ARE the contract's members, imported. There is nothing here to disagree with it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CHIP REFUSES TO SPEAK FOR A CONFLICT, and that refusal is the point.
 *
 * `DISPUTED` — sources disagree — maps to NO CHIP. Not to `ESTIMATE`, not to `UNKNOWN`. §2.1 is
 * explicit that `CONFLICTING` *"is not a chip either… a conflicted field is structurally different —
 * it carries `candidates[]` and no scalar value"*. A conflict has `ConflictedValue` (criterion A3),
 * whose whole job is every competing reading with no winner. A chip is a single badge, and the
 * moment one appears for a conflict a winner has been picked by the act of choosing which badge.
 */

/** The four states, re-exported from the one vocabulary. Never redeclared here. */
export const CHIP_STATES = PROVENANCE_CHIPS;
export type ChipState = ProvenanceChip;

/** A chip plus §2.3's stale modifier. The contract's own record shape. */
export type ChipView = ProvenanceRecord;

/**
 * The tone → chip table. Every `PresentationTone` appears exactly once, so a tone added upstream
 * makes this fail to compile rather than fall through to a default — a `default:` branch would
 * quietly render "Unknown" for a state nobody had thought about, which is a confident answer about
 * somebody's money produced by an oversight.
 */
const BY_TONE: Readonly<Record<PresentationTone, ChipView | null>> = {
  VERIFIED: { chip: 'VERIFIED', stale: false },
  UNVERIFIED_INPUT: { chip: 'USER', stale: false },
  UNAVAILABLE: { chip: 'UNKNOWN', stale: false },
  WITHHELD: { chip: 'UNKNOWN', stale: false },
  // §2.3: HISTORICAL sets stale and RETAINS the chip its verification grade earned.
  STALE: { chip: 'VERIFIED', stale: true },
  // See the header. §2.1: CONFLICTING is not a chip.
  DISPUTED: null,
};

/**
 * Which chip a presentation deserves, or `null` when no single badge can honestly stand for it.
 *
 * `provenance` decides the one genuinely ambiguous case: a value the app did not verify is either
 * the USER's own figure or the app's ESTIMATE, and telling somebody their own number is an estimate
 * is wrong in one direction while calling our estimate their value is worse in the other. It can do
 * nothing else — a provenance can never override a VERIFIED or turn an UNAVAILABLE into a number.
 */
export function chipStateFor(
  tone: PresentationTone,
  provenance?: ProvenanceChip,
): ChipView | null {
  const base = BY_TONE[tone];
  if (base === null) return null;
  if (tone === 'UNVERIFIED_INPUT' && provenance !== undefined) {
    return { chip: provenance, stale: base.stale };
  }
  return base;
}

/**
 * THE LABEL EACH STATE CARRIES, as a Hebrew source string.
 *
 * This project's `t()` takes the Hebrew text itself and looks up Arabic and English by it — there is
 * no key namespace. Inventing one for the chip would have made it the only component translated a
 * different way, and `arabicCoverage.test.ts` — which walks Hebrew sources and demands an Arabic
 * entry for each — would not have seen the chip at all.
 *
 * `USER` reads as "Your value", which is the contract's own wording in §2.1's table and a deliberate
 * refusal to let a user's own figure wear a "verified" affordance.
 */
export const CHIP_LABEL: Readonly<Record<ChipState, string>> = {
  VERIFIED: 'מאומת',
  USER: 'הערך שלך',
  ESTIMATE: 'הערכה',
  UNKNOWN: 'לא ידוע',
};

/**
 * §2.3's Stale MODIFIER. Rendered ALONGSIDE the state's label and never instead of it — that is what
 * makes it a modifier rather than a fifth state, and it is the difference between "this was verified
 * and may be out of date" and "we do not know".
 */
export const CHIP_STALE_LABEL = 'לא עדכני';
