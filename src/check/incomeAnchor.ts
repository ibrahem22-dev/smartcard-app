/**
 * O5 — income and payday from the vault, assembled as engine input.
 *
 * THIS FILE MAPS. IT DOES NOT DECIDE. Turning a stored payday chip into the next
 * ISO date is calendar arithmetic, not a threshold, a rank or a recommendation.
 * Inventing 0 when income was skipped is the defect assessSnapshot exists to stop.
 */
import { provenanced } from '../engines/provenance';
import type { PaydayCapture, UserProfile } from '../types/user.types';
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

export function purchaseContextFromProfile(
  profile: UserProfile | null,
  todayIso: string,
): PurchaseCheckContext | null {
  if (
    profile === null ||
    profile.monthlyIncome === undefined ||
    !Number.isFinite(profile.monthlyIncome)
  ) {
    return null;
  }
  const nextPayday =
    profile.payday === undefined
      ? undefined
      : nextPaydayIso(profile.payday, todayIso);
  return {
    monthlyIncomeIls: provenanced(profile.monthlyIncome, 'USER'),
    commitments: [],
    ...(nextPayday !== undefined ? { nextPayday } : {}),
  };
}
