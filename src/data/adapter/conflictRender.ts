import {
  CONFLICT_RENDER_PLAN,
  conflictRecordAvailabilityOf,
  conflictRenderPlan,
  intervalRankabilityOf,
  type ConflictRecordAvailability,
  type ConflictRenderPlan,
  type PackConflict,
  type IntervalRankability,
} from '@smartcard/data-authority-adapter';

/**
 * WHICH OF THE TWO RENDER PLANS APPLIES — criterion A4, obligation OB-1.
 *
 *   > **A4.** *"`conflictRenderPlan`'s **both** members render correctly, demonstrated **by record
 *   > id**: `DISPUTED_WITHOUT_CANDIDATES` on `term:one-zero|research:FX_COMMISSION_PCT:4` renders
 *   > *"This figure is disputed"* and nothing further; empty `conflictIds` produces neither
 *   > spinner, error, nor fallback."*
 *
 *   > **OB-1.** *"Call `conflictRenderPlan(amount.conflictRecords)` and handle both members."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE PLAN IS ASKED FOR, NOT INFERRED FROM A LENGTH
 *
 * `candidates.length === 0` gives the right answer today and is the wrong question. It is the same
 * mistake A5 forbids with `label === null`: a length is a SYMPTOM of a state, and the field that
 * carries the state is the one to switch on. A third availability member — a record withheld for
 * licensing, say — would also arrive with zero candidates and would need saying differently.
 *
 * Reading the plan means the next member is a compile error here rather than a silently wrong
 * screen.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AN EMPTY `conflictIds` IS AN ANSWER, NOT AN ABSENCE OF ONE
 *
 *   > **OB-1.** *"What P2 must NOT do: treat an empty `conflictIds` as a loading state, an error,
 *   > or a reason to hide the fact."*
 *
 * The estate graded the fact as disputed and **named no counterparty anywhere in the corpus**. §7.3
 * requires two or more participants in a conflict record precisely so a record always names a real
 * disagreement, and manufacturing a one-participant record would make the shape whole while
 * asserting a disagreement whose other side does not exist. **The pipeline refuses, and the refusal
 * is correct.**
 *
 * So the fact is shown, it is marked disputed, and nothing further is said about it. Hiding it
 * would delete information the estate does have; inventing a reading would add information it does
 * not.
 */

/** Re-exported so a consumer switches on the adapter's domain and never on a local copy of it. */
export { CONFLICT_RENDER_PLAN };
export type {
  ConflictRenderPlan,
  ConflictRecordAvailability,
  IntervalRankability,
  PackConflict,
};

/**
 * `intervalRankability` -- criterion K3, handoff section 3 row 4, read and never computed.
 *
 * The adapter is the ONLY thing that decides whether a conflicted fact can be ranked:
 * `intervalRankabilityOf` reads `disagreementAxis` off each record, and `disagreementAxis` is
 * written by the pipeline's build-time classifier (OQ-3 AMEND; ADR-014 section 3), never by
 * this app. Exposing the adapter's answer through this seam is what makes that checkable: a
 * consumer that wants a rankability asks here and gets the adapter's verdict, or it violates
 * D2/K3 trying to make its own. Until a pack republication stamps axes into the records
 * (PD-P3-005), every conflicted fact reads NOT_RANKABLE_AXIS_NOT_CLASSIFIED -- which routes
 * to COMPARISON_INCOMPLETE, the honest outcome, not a defect to work around.
 */
export function intervalRankabilityFor(
  conflicts: readonly PackConflict[],
): IntervalRankability {
  return intervalRankabilityOf(conflicts);
}

/**
 * The plan for one conflicted fact, decided by the adapter.
 *
 * Nothing here grades, ranks or counts. `conflictRecordAvailabilityOf` and `conflictRenderPlan` are
 * the adapter's (handoff §2, IF-4), and re-deriving either is what D4 forbids.
 */
export function renderPlanFor(conflicts: readonly PackConflict[]): {
  readonly availability: ConflictRecordAvailability;
  readonly plan: ConflictRenderPlan;
  readonly candidateCount: number;
  readonly rankability: IntervalRankability;
} {
  const availability = conflictRecordAvailabilityOf(conflicts);
  return {
    availability,
    plan: conflictRenderPlan(availability),
    candidateCount: conflicts.length,
    rankability: intervalRankabilityOf(conflicts),
  };
}

/**
 * `describePlan` lives in `conflictRenderPlan.ts`, which imports the adapter AS A TYPE ONLY.
 *
 * That module is erased at runtime, so a React Native component can switch on the plan without
 * pulling a Node-targeted package into the bundle — and the render suite proved that is not
 * hypothetical. Re-exported here so a data-layer caller reaches both halves from one place.
 */
export { describePlan, type PlanShape } from './conflictRenderPlan';
