/**
 * O5 — income and payday from the vault, assembled as engine input.
 *
 * THIS FILE MAPS. IT DOES NOT DECIDE. Turning a stored payday chip into the next
 * ISO date is calendar arithmetic, not a threshold, a rank or a recommendation.
 * Inventing 0 when income was skipped is the defect assessSnapshot exists to stop.
 */
import { provenanced } from '../engines/provenance';
import type { PaydayCapture, UserProfile } from '../types/user.types';
import type { CommitmentState } from './commitmentInput';
import type { PurchaseCheckContext } from './runPurchaseCheck';

const PAYDAY_DAYS = [1, 10, 15, 28] as const;

export function paydayFromChip(id: string | null): PaydayCapture | undefined {
  if (id === 'last') return { kind: 'last' };
  const day = Number(id);
  if (PAYDAY_DAYS.includes(day as (typeof PAYDAY_DAYS)[number])) {
    return { kind: 'day', day: day as (typeof PAYDAY_DAYS)[number] };
  }
  return undefined;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseIsoDate(todayIso: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayIso);
  if (!match) {
    throw new Error('incomeAnchor: todayIso must be YYYY-MM-DD');
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function nextPaydayIso(payday: PaydayCapture, todayIso: string): string {
  const today = parseIsoDate(todayIso);
  if (payday.kind === 'last') {
    const lastThis = lastDayOfMonth(today.year, today.month);
    if (today.day <= lastThis) return iso(today.year, today.month, lastThis);
    const month = today.month === 12 ? 1 : today.month + 1;
    const year = today.month === 12 ? today.year + 1 : today.year;
    return iso(year, month, lastDayOfMonth(year, month));
  }
  const lastThis = lastDayOfMonth(today.year, today.month);
  const dayThis = Math.min(payday.day, lastThis);
  if (today.day <= dayThis) return iso(today.year, today.month, dayThis);
  const month = today.month === 12 ? 1 : today.month + 1;
  const year = today.month === 12 ? today.year + 1 : today.year;
  const lastNext = lastDayOfMonth(year, month);
  return iso(year, month, Math.min(payday.day, lastNext));
}

/**
 * Why the Check loop has no context to evaluate against.
 *
 * ADDED UNDER OWNER RULING OQ-P5-001, 2026-08-29. This function used to return `null` for "no
 * income", and `null` was adequate while that was the only way to fail. It no longer is: a purchase
 * cannot be judged against commitments nobody has loaded either, and a caller handed a bare `null`
 * cannot tell the two apart or say which to a user. The shape mirrors `SurfaceEngineAbsence` in
 * `src/surfaces/surfaceContext.ts` on purpose — *"an absence is a render, not a zero"* is the same
 * rule on both sides of the seam, and the two lanes should not word one state two ways.
 */
export type PurchaseContextAbsence =
  | 'NO_PROFILE'
  | 'NO_INCOME'
  | 'COMMITMENTS_PENDING'
  | 'COMMITMENTS_UNAVAILABLE';

export type PurchaseContextResult =
  | { readonly kind: 'READY'; readonly context: PurchaseCheckContext }
  | { readonly kind: 'ABSENT'; readonly because: PurchaseContextAbsence; readonly detail: string };

const ABSENT = (
  because: PurchaseContextAbsence,
  detail: string,
): PurchaseContextResult => ({ kind: 'ABSENT', because, detail });

/**
 * THE CHECK LOOP'S AUTHORITY BOUNDARY — income, payday and existing commitments, or the reason
 * there is no answer.
 *
 * `commitments` IS A PARAMETER AND NOT A DEFAULT, WHICH IS THE WHOLE REPAIR. Line 82 of this file
 * used to read `commitments: []`, unconditionally, and every purchase the shipped app has ever
 * judged was judged as if the user owed nothing. That is Owner question OQ-P5-001 and this is its
 * ruling: the commitments come from `commitmentState`, the same canonical mapper the five P5
 * surfaces read, and there is no longer a literal here for a future edit to leave behind.
 *
 * An UNKNOWN commitment state does not fall back to an empty list. It refuses, with its reason.
 * `[]` was never a safe default: it is the single most optimistic input the verdict engine can
 * receive, so guessing it turns "we could not load your obligations" into "good to go".
 */
export function purchaseContextFromProfile(
  profile: UserProfile | null,
  todayIso: string,
  commitments: CommitmentState,
  paidEarlyCommitmentIds?: readonly string[],
): PurchaseContextResult {
  if (profile === null) {
    return ABSENT('NO_PROFILE', 'no vault profile is loaded, so there is no income to measure against');
  }
  if (profile.monthlyIncome === undefined || !Number.isFinite(profile.monthlyIncome)) {
    return ABSENT('NO_INCOME', 'no monthly income has been captured; a load ratio has no denominator');
  }
  if (!commitments.known) {
    return ABSENT(commitments.because, commitments.detail);
  }
  const nextPayday =
    profile.payday === undefined
      ? undefined
      : nextPaydayIso(profile.payday, todayIso);
  return {
    kind: 'READY',
    context: {
      monthlyIncomeIls: provenanced(profile.monthlyIncome, 'USER'),
      commitments: commitments.commitments,
      ...(paidEarlyCommitmentIds !== undefined ? { paidEarlyCommitmentIds } : {}),
      ...(nextPayday !== undefined ? { nextPayday } : {}),
    },
  };
}
