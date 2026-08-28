import type { SurfaceContext, SurfaceEngineResults } from '../../surfaces';

export type DayEventKind =
  | 'salary-in'
  | 'card-billing'
  | 'installment-due'
  | 'loan-or-mortgage'
  | 'fixed-order';

export interface DayEvent {
  readonly kind: DayEventKind;
  readonly label: string;
  readonly amountIls?: number;
  readonly derived: boolean;
}

/** K3's taxonomy is data in one place; callers map this array and never sort live events. */
export const DAY_EVENT_ORDER: readonly DayEventKind[] = [
  'salary-in',
  'card-billing',
  'installment-due',
  'loan-or-mortgage',
  'fixed-order',
];

function utcParts(iso: string): {
  readonly day: number;
  readonly daysInMonth: number;
} | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    return null;
  }
  return {
    day: date.getUTCDate(),
    daysInMonth: new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate(),
  };
}

function billingDayMatches(
  billingDayOfMonth: number,
  parts: { readonly day: number; readonly daysInMonth: number },
): boolean {
  if (
    !Number.isInteger(billingDayOfMonth) ||
    billingDayOfMonth < 1 ||
    billingDayOfMonth > 31
  ) {
    return false;
  }
  return parts.day === Math.min(billingDayOfMonth, parts.daysInMonth);
}

/**
 * Detail rows for one date, sourced only from the surface context and its shared seam result.
 *
 * Provenance is about the DATE here. Salary is not derived: its payday is a value the user stated.
 * Card billings and linked installments are derived because the occurrence is worked out from a
 * recurring card billing cycle. Loans/mortgages carry a start date but no payment due date, and
 * fixed orders have no store, so neither is invented onto a day.
 */
export function dayEventsFor(
  results: SurfaceEngineResults,
  ctx: SurfaceContext,
  iso: string,
): readonly DayEvent[] {
  const parts = utcParts(iso);
  if (parts === null) return [];
  const publishedDay = results.risk?.days.find((candidate) => candidate.date === iso);

  return DAY_EVENT_ORDER.flatMap((kind): readonly DayEvent[] => {
    switch (kind) {
      case 'salary-in': {
        const profile = ctx.profile;
        if (profile?.payday === undefined) return [];
        const matches = profile.payday.kind === 'last'
          ? parts.day === parts.daysInMonth
          : parts.day === profile.payday.day;
        return matches
          ? [{
            kind,
            label: 'משכורת',
            amountIls: publishedDay?.salaryInflowIls.value ?? profile.monthlyIncome,
            derived: false,
          }]
          : [];
      }
      case 'card-billing':
        return ctx.cards
          .filter((card) => billingDayMatches(card.billingCycle.billingDayOfMonth, parts))
          .map((card): DayEvent => ({
            kind,
            label: card.displayName,
            amountIls: card.framework.currentBalance,
            derived: true,
          }));
      case 'installment-due':
        return ctx.installments.flatMap((installment): readonly DayEvent[] => {
          const card = ctx.cards.find(
            (candidate) => candidate.cardId === installment.billingCardId,
          );
          if (
            card === undefined ||
            !billingDayMatches(card.billingCycle.billingDayOfMonth, parts)
          ) {
            return [];
          }
          return [{
            kind,
            label: installment.merchantName,
            amountIls: installment.monthlyPayment,
            derived: true,
          }];
        });
      case 'loan-or-mortgage':
      case 'fixed-order':
        return [];
    }
  });
}
