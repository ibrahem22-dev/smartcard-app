import { STALE_AFTER_CALENDAR_DAYS, isBusinessDay, stalenessOf, type Staleness } from '@smartcard/data-authority-adapter';

/**
 * MARKET-HOLIDAY AWARENESS, AND ITS ABSENCE — criterion C9.
 *
 *   > **C9.** *"A BOI market-holiday calendar is supplied to `stalenessOf` **or** its absence is a
 *   > dated `DEFERRED` entry carrying an OD id. **A holiday must not read as an ordinary
 *   > publication day.**"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THERE IS NO CALENDAR, AND INVENTING ONE WOULD BE THE WORSE ANSWER
 *
 *   > `P1_DEFERRED.md` §2.11: *"inventing an Israeli market calendar is not a data-pipeline task…
 *   > `stalenessOf` accepts a holiday list and nothing supplies one, so a holiday reads as an
 *   > ordinary publication day — a rate looks **older** than it is, failing toward `STALE`. …The
 *   > safe direction, which is why it is a deferral and not a defect."*
 *
 * A calendar assembled from a web search would be a list of dates with no authority behind it,
 * rendered to users as though the Bank of Israel had said so. A wrong holiday in it makes a stale
 * rate look fresh — the unsafe direction, and the one this deferral exists to avoid.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * SO THE ABSENCE IS DECLARED, DATED, AND CARRIES AN OWNER DECISION
 *
 * **OD-31 Clause A** (CLOSED — APPROVED, 2026-08-23) names the BOI market-holiday calendar among
 * the six obligations `P1_TO_P2_HANDOFF.md` transfers, and accepts their classification in
 * `P1_DEFERRED.md`. The deferral is Owner-ruled; this module records which ruling and when, rather
 * than asserting a deferral on its own authority.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE SECOND HALF OF C9 IS ENFORCED HERE
 *
 * *"A holiday must not read as an ordinary publication day."* With no calendar, the adapter's
 * `businessDaysOld` counts a closed market as an open one. That number is therefore **a floor, not
 * a fact**, and this module says so in the value it returns — so a surface cannot render
 * "4 business days old" as though somebody had checked whether the market was open.
 *
 * `stale` itself is unaffected: **STALE ⇔ more than 7 CALENDAR days old**, and calendar days need
 * no calendar.
 */

/** The calendar, its state, and the ruling that put it there. */
export const MARKET_HOLIDAY_CALENDAR = {
  state: 'ABSENT_DEFERRED' as const,
  /** Nothing. Declared explicitly rather than by omission, so a reader sees the decision. */
  days: [] as readonly string[],
  deferredBy: 'OD-31',
  deferredAt: '2026-08-23',
  register: 'reports/campaign/P1_DEFERRED.md §2.11',
  direction: 'FAILS_TOWARD_STALE' as const,
} as const;

export interface StalenessReading extends Staleness {
  /**
   * Whether `businessDaysOld` was computed against a real market calendar.
   *
   * `false` here means the number counts every weekday as a publication day, including days the
   * Bank of Israel was closed. It is a FLOOR: the true business age is this or lower.
   */
  readonly businessDaysAreAuthoritative: boolean;
  readonly holidayCalendar: typeof MARKET_HOLIDAY_CALENDAR.state;
  readonly deferredBy: string;
}

/**
 * How old a rate is, with the calendar's absence carried in the answer.
 *
 * `asOf` is an argument and never a clock — the same rule the rest of the FX path follows, and for
 * the same reason: a module that knows what today is will eventually label a Friday rate with a
 * Sunday.
 */
export function stalenessReading(rateDate: string, asOf: string): StalenessReading {
  const staleness = stalenessOf(rateDate, asOf, MARKET_HOLIDAY_CALENDAR.days);
  return {
    ...staleness,
    // No calendar means no authority. Saying so in the value is what stops a surface from
    // rendering a business-day count somebody would reasonably read as checked.
    businessDaysAreAuthoritative: MARKET_HOLIDAY_CALENDAR.days.length > 0,
    holidayCalendar: MARKET_HOLIDAY_CALENDAR.state,
    deferredBy: MARKET_HOLIDAY_CALENDAR.deferredBy,
  };
}

/**
 * Is this date one the Bank of Israel publishes on, so far as this build can tell?
 *
 * Returns `undefined` where the answer depends on the missing calendar — a weekday that could be a
 * holiday. **Not `true`.** A weekday is only *probably* a publication day, and the whole of C9 is
 * that a holiday must not read as an ordinary one.
 */
export function publishesOn(iso: string): boolean | undefined {
  const weekday = isBusinessDay(iso, MARKET_HOLIDAY_CALENDAR.days);
  if (!weekday) return false;      // A weekend needs no calendar to rule out.
  return MARKET_HOLIDAY_CALENDAR.days.length > 0 ? true : undefined;
}

/** Re-exported so a surface reads the threshold from the adapter rather than repeating 7. */
export { STALE_AFTER_CALENDAR_DAYS };
