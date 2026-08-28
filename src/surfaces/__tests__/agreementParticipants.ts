/**
 * WHO HAS TO AGREE, AND WHO IS BUILT YET.
 *
 * Group A's five properties each name their participants in the contract's own words. Every one of
 * those participants is a surface P5 builds in a later phase — so at PHASE-1 each property is REAL
 * and RED, and each later phase turns one more participant on. `P5_EXECUTION_PLAN.md` §1.1 is
 * explicit that this ordering is the point:
 *
 *   > *"PHASE-1 delivers A1 through A5 as failing properties with nothing to satisfy them yet. Each
 *   > later phase makes one more of them pass. That is deliberate — a property that has never been
 *   > red is a property nobody has watched."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE REQUIRED LIST IS WRITTEN OUT AND THE POPULATION IS NOT
 *
 * Criterion A6 forbids a hand-listed **population** — the contexts and surfaces a property runs
 * over — because a list of those rots silently as the product grows. The **participants** are a
 * different thing: they are the criterion's own text, quoted, and they may not grow at all without
 * an Owner amendment. Writing them down is how a property can fail for the right reason — *"Wallet's
 * limit bar has no reader yet"* — instead of quietly measuring whatever happens to be implemented,
 * which is the shape that would let A4 close in PHASE-4 while still comparing one surface with
 * itself.
 *
 * `derivedSurfaces()` is still what says which surfaces EXIST; the gate cross-checks every P5
 * participant id against it, so a participant naming a surface the navigation declaration does not
 * carry fails rather than passing unnoticed.
 */
import type { P5SurfaceId } from './derivedPopulation';

/** The five properties closure test 2 gates on. */
export type AgreementProperty =
  | 'one-scoring'
  | 'one-load'
  | 'one-risk'
  | 'one-limit'
  | 'caches-agree';

/**
 * A participant is a surface plus the thing on it that renders the figure.
 *
 * `check-verdict` is P4's surface, not a P5 one, and it appears here because A2 and A4 name it.
 * P5 renders beside it and compares against it; **P5 does not edit it** — contract §1.2 and §17,
 * and if a property finds the Verdict disagreeing, that is the property working and the finding is
 * raised to P4 rather than repaired here.
 */
export interface AgreementParticipant {
  readonly id: string;
  readonly surface: P5SurfaceId | 'check-verdict';
  /** The element, in the contract's words. */
  readonly renders: string;
  /** The phase that gives this participant a reader. Prose, for a red line to be readable. */
  readonly builtIn: string;
}

export const REQUIRED_PARTICIPANTS: Readonly<Record<AgreementProperty, readonly AgreementParticipant[]>> = {
  'one-scoring': [
    { id: 'wallet-best-for-chips', surface: 'wallet-cards', renders: "Wallet's Best-For chips", builtIn: 'PHASE-4' },
    { id: 'card-dna-when-best', surface: 'card-dna', renders: "Card DNA §C's Best-For chips", builtIn: 'PHASE-3' },
    { id: 'check-recommendation', surface: 'check-verdict', renders: 'the recommendation Check would produce for the same context', builtIn: 'P4 — already built' },
  ],
  'one-load': [
    { id: 'home-load-bar', surface: 'home', renders: "Home's monthly load bar", builtIn: 'PHASE-7' },
    { id: 'commitments-summary', surface: 'plan-commitments', renders: "Plan Commitments' sticky summary", builtIn: 'PHASE-5' },
    { id: 'card-dna-utilization', surface: 'card-dna', renders: "Card DNA §D's credit-limit utilization", builtIn: 'PHASE-3' },
    { id: 'verdict-impact-panel', surface: 'check-verdict', renders: "the Verdict's Financial Impact panel", builtIn: 'P4 — already built' },
  ],
  'one-risk': [
    { id: 'home-risk-strip', surface: 'home', renders: "Home's 7-day risk strip", builtIn: 'PHASE-7' },
    /*
     * PHASE-6, READ THIS BEFORE YOU BUILD THE DOTS.
     *
     * B1's module walk surfaced it: Plan Calendar today reads its charges through
     * `src/hooks/useCashflowCalendar.ts`, an M3-era hook that calls `src/engines/cashflowRadar.ts`
     * and `src/engines/loanEngine.ts` DIRECTLY. That is a legitimate shape under B1 — a hook
     * calling an engine is what "every number came from an engine call" asks for — and the screen
     * renders no figure at all today, so nothing disagrees with anything yet.
     *
     * It stops being harmless the moment these dots exist. `one-risk` compares them against
     * Home's 7-day risk strip, and the strip reads the P5 seam. If the dots are fed from
     * cashflowRadar instead, the property is comparing TWO ENGINE STACKS, and group A's whole
     * premise — spec §20, "any two surfaces showing different numbers for the same inputs is a P0
     * bug" — turns into a coin flip that contract §2 rule 10 was written to forbid.
     *
     * So: the dots read `evaluateSurfaceEngines`. If PHASE-6 finds a reason they cannot, that is a
     * deviation to raise, not a decision to make quietly at the keyboard.
     */
    { id: 'calendar-risk-dots', surface: 'plan-calendar', renders: "Plan Calendar's risk dots", builtIn: 'PHASE-6' },
  ],
  'one-limit': [
    { id: 'wallet-limit-bar', surface: 'wallet-cards', renders: "Wallet's available-limit bar", builtIn: 'PHASE-4' },
    { id: 'card-dna-utilization', surface: 'card-dna', renders: "Card DNA §D's utilization", builtIn: 'PHASE-3' },
    { id: 'verdict-impact-strip', surface: 'check-verdict', renders: "the Verdict's impact strip", builtIn: 'P4 — already built' },
  ],
  'caches-agree': [
    { id: 'cache-best-for', surface: 'wallet-cards', renders: 'the best-for cache', builtIn: 'PHASE-7' },
    { id: 'cache-load-ratio', surface: 'home', renders: 'the load-% cache', builtIn: 'PHASE-7' },
    { id: 'cache-calendar-risk', surface: 'plan-calendar', renders: 'the calendar-risk cache', builtIn: 'PHASE-7' },
  ],
};

/** What a property says when a participant has no reader yet. One wording, so five properties agree. */
export const notBuiltYet = (property: AgreementProperty, p: AgreementParticipant): string =>
  `${property}: ${p.renders} (${p.id}) has no reader yet — it is built in ${p.builtIn}. ` +
  'This property is RED for that reason and for no other: it is not a defect, it is the harness ' +
  'existing before the surfaces it will refuse to let disagree.';
