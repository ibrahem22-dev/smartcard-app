/**
 * THE CANONICAL COMMITMENT INPUT — one home for "what does this user already owe each month".
 *
 * Written under Owner ruling **OQ-P5-001** (answered 2026-08-29): *"AUTHORISE P5 TO MAKE THE REPAIR
 * — option 2, as a named, recorded exception to the P4 boundary … Implement the ruling at the
 * canonical authority/engine boundary, not in a presentation surface … preserve one canonical
 * source of financial truth."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT WAS WRONG
 *
 * `incomeAnchor.purchaseContextFromProfile` returned `commitments: []` unconditionally, so the
 * Check Verdict evaluated every purchase as if the user had no existing obligations, while the five
 * P5 surfaces evaluated the same vault WITH them. One vault, two answers: a 7,000/month installment
 * showed as 42,000 of holds and a MINUS 22,000 available limit on Wallet, and as a 0.06 load ratio
 * with an 18,800 impact strip on the Verdict. Spec §9 names that exact shape — *"Good to go at 41%
 * against a 35% threshold"* — as the canonical defect the architecture exists to make impossible.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS RATHER THAN A SECOND MAPPER
 *
 * The mapping from vault תשלומים + loans onto `LoadCommitment[]` already existed, privately, as
 * `commitmentsFrom` inside `src/surfaces/surfaceEngines.ts`. Copying it into the check lane would
 * have produced ONE FACT WITH TWO HOMES, which is the failure P1 and P2 between them found eleven
 * instances of. So it moved here and `surfaceEngines.ts` imports it: the Verdict and the five P5
 * surfaces now read the same commitments through the same function, and they cannot drift because
 * there is only one of it.
 *
 * It lives beside `activityMapper.ts` because that is already the shared home for vault → engine
 * input assembly, and because the established dependency direction is surfaces → check
 * (`surfaceEngines.ts` already imports `loadCardsFromVault` and `nextPaydayIso` from here).
 * Reversing it would have made a cycle out of a repair.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THIS FILE MAPS. IT DOES NOT DECIDE. No ratio, no band, no threshold. If you find yourself
 * dividing by income here, stop.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AN EMPTY LIST IS AN ANSWER. IT IS NOT THE ABSENCE OF ONE.
 *
 * `[]` meant two different things at the old call site: "this user has no commitments" and "nobody
 * looked". `src/store/hydration.ts` was written for exactly that confusion — *"an unloaded store was
 * indistinguishable from a genuinely empty one … absence rendered as a confident empty answer"* —
 * and it already carries the vocabulary. So this file does not invent a second one: it takes the
 * `CollectionReadiness` of each source collection and returns a DISCRIMINATED result. A caller
 * cannot read a commitment list out of an unknown state by accident, because there is not one there.
 */
import { provenanced } from '../engines/provenance';
import type { LoadCommitment } from '../engines/load';
import type { CollectionReadiness } from '../store/hydration';
import type { ImportedInstallment } from '../types/installment.types';
import type { Loan } from '../types/loan.types';

/**
 * The vault facts a commitment list is assembled from.
 *
 * `cards` is present only so a hold can be checked against a card the vault actually holds; nothing
 * but `cardId` is read, which is why the type asks for nothing more.
 */
export interface CommitmentSource {
  readonly cards: readonly { readonly cardId: string }[];
  readonly installments: readonly ImportedInstallment[];
  readonly loans: readonly Loan[];
}

/** Which vault collections the commitment list is assembled from, and whether each can be trusted. */
export interface CommitmentReadiness {
  readonly installments: CollectionReadiness;
  readonly loans: CollectionReadiness;
}

/** Why a commitment list could not be produced. Mirrors `SurfaceEngineAbsence`, deliberately. */
export type CommitmentUnknownCause = 'COMMITMENTS_PENDING' | 'COMMITMENTS_UNAVAILABLE';

export const COMMITMENT_UNKNOWN_DETAIL: Readonly<Record<CommitmentUnknownCause, string>> = {
  COMMITMENTS_PENDING:
    'the vault has not finished loading this user’s existing commitments, so an empty list would be a loading artifact rather than a fact about them',
  COMMITMENTS_UNAVAILABLE:
    'the vault could not load this user’s existing commitments, so what they already owe each month is not known',
};

/**
 * Either the commitments, or the reason there are none to give.
 *
 * There is no third shape and no optional field: a consumer branches on `known` and the compiler
 * will not let it reach `commitments` down the other arm.
 */
export type CommitmentState =
  | { readonly known: true; readonly commitments: readonly LoadCommitment[] }
  | { readonly known: false; readonly because: CommitmentUnknownCause; readonly detail: string };

/**
 * THE MAPPER. Moved verbatim from `surfaceEngines.commitmentsFrom` — the five P5 surfaces' behaviour
 * must not move by one shekel, and A2/A3/A5 are the properties that would catch it if it did.
 *
 * A monthly obligation and, when it reserves credit, the card it is held against.
 */
export const commitmentsFromVault = (src: CommitmentSource): readonly LoadCommitment[] => {
  const fromInstallments = src.installments.map((i): LoadCommitment => ({
    commitmentId: i.installmentId,
    monthlyAmountIls: provenanced(i.monthlyPayment, 'USER'),
    /* A hold only exists where the installment names a card the vault actually holds. Naming a
       card that is not there would make the load engine refuse the whole input, and an unlinked
       installment is a real state — LOCK-007 in the P3-era mapper made the same distinction. */
    ...(src.cards.some((c) => c.cardId === i.billingCardId)
      ? {
        linkedCardId: i.billingCardId,
        remainingHoldIls: provenanced(i.monthlyPayment * i.monthsRemaining, 'ESTIMATE'),
      }
      : {}),
  }));
  const fromLoans = src.loans.map((l): LoadCommitment => ({
    commitmentId: l.id,
    monthlyAmountIls: provenanced(l.monthlyPayment, 'USER'),
    ...(l.linkedCardId !== undefined && src.cards.some((c) => c.cardId === l.linkedCardId)
      ? {
        linkedCardId: l.linkedCardId,
        remainingHoldIls: provenanced(l.remainingBalance, 'ESTIMATE'),
      }
      : {}),
  }));
  return [...fromInstallments, ...fromLoans];
};

/**
 * The commitments still owed once the user has marked some Paid early.
 *
 * ONE RULE, TWO ENGINES, AND THEY ASK FOR IT DIFFERENTLY. `evaluateFinancialLoad` wants the FULL
 * list plus the paid-early ids — it needs every commitment to compute `current`, and it needs the
 * ids to release each one's held limit. `evaluatePurchaseVerdict` has no such parameter: it sums
 * whatever list it is handed, so a commitment the user has already settled has to be gone before it
 * arrives. Both readings are correct and they are the same fact, so the subtraction lives here
 * rather than in whichever caller noticed it first.
 *
 * Criterion A4 is what fails when they disagree: *"Paid early moves all three in the same run."*
 */
export const stillOwed = (
  commitments: readonly LoadCommitment[],
  paidEarlyCommitmentIds: readonly string[] | undefined,
): readonly LoadCommitment[] =>
  paidEarlyCommitmentIds === undefined || paidEarlyCommitmentIds.length === 0
    ? commitments
    : commitments.filter((c) => !paidEarlyCommitmentIds.includes(c.commitmentId));

/**
 * THE AUTHORITY BOUNDARY. Readiness in, a commitment list or a named absence out.
 *
 * UNAVAILABLE beats PENDING when the two collections disagree, because a failure is the more
 * specific fact and a caller that rendered "still loading" over a failed vault read would be
 * promising a resolution that is not coming.
 *
 * KNOWN_EMPTY is a KNOWN state and produces `known: true` with an empty list. That is the whole
 * distinction this function exists to make: a user with no commitments gets a real answer, and a
 * user whose commitments have not loaded does not get that same answer by accident.
 */
export const commitmentState = (
  src: CommitmentSource,
  readiness: CommitmentReadiness,
): CommitmentState => {
  const states: readonly CollectionReadiness[] = [readiness.installments, readiness.loans];
  if (states.includes('UNAVAILABLE')) {
    return {
      known: false,
      because: 'COMMITMENTS_UNAVAILABLE',
      detail: COMMITMENT_UNKNOWN_DETAIL.COMMITMENTS_UNAVAILABLE,
    };
  }
  if (states.includes('PENDING')) {
    return {
      known: false,
      because: 'COMMITMENTS_PENDING',
      detail: COMMITMENT_UNKNOWN_DETAIL.COMMITMENTS_PENDING,
    };
  }
  return { known: true, commitments: commitmentsFromVault(src) };
};
