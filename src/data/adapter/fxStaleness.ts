import type { Staleness } from '@smartcard/data-authority-adapter/fx/rate-table';

// The adapter is a Node-targeted local junction and cannot enter a React Native render bundle.
// Pin the runtime-safe seam to its literal-typed contract so an authority change from 7 fails
// compilation here instead of silently diverging.
export const STALE_AFTER_CALENDAR_DAYS:
  typeof import('@smartcard/data-authority-adapter/fx/rate-table').STALE_AFTER_CALENDAR_DAYS = 7;
const DAY_MS = 86_400_000;
const BOI_NON_PUBLICATION_DAYS = [0, 6] as const;

function asUtc(iso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`${iso} is not an ISO date`);
  const parsed = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(parsed)) throw new Error(`${iso} is not an ISO date`);
  return parsed;
}

function isBusinessDay(iso: string, holidays: readonly string[] = []): boolean {
  if (holidays.includes(iso)) return false;
  return !BOI_NON_PUBLICATION_DAYS.includes(
    new Date(asUtc(iso)).getUTCDay() as (typeof BOI_NON_PUBLICATION_DAYS)[number],
  );
}

function stalenessOf(
  rateDate: string,
  asOf: string,
  holidays: readonly string[] = [],
): Staleness {
  const from = asUtc(rateDate);
  const to = asUtc(asOf);
  if (to < from) throw new Error(`rate ${rateDate} is in the future as of ${asOf}`);
  const calendarDaysOld = Math.round((to - from) / DAY_MS);
  let businessDaysOld = 0;
  for (let day = 1; day < calendarDaysOld; day += 1) {
    const iso = new Date(from + day * DAY_MS).toISOString().slice(0, 10);
    if (isBusinessDay(iso, holidays)) businessDaysOld += 1;
  }
  return {
    stale: calendarDaysOld > STALE_AFTER_CALENDAR_DAYS,
    calendarDaysOld,
    businessDaysOld,
    carriedForwardOnly: calendarDaysOld > 0 && businessDaysOld === 0,
  };
}

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

/**
 * THE ONLY DOOR A CALENDAR MAY ENTER THROUGH -- criterion H2.
 *
 * P2_DEFERRED 2.2 and P1_DEFERRED 2.11 refused to invent an Israeli market calendar because a list
 * assembled without authority would be rendered to users as though the Bank of Israel had said so.
 * That refusal needs teeth for as long as the calendar stays absent -- and the moment one ever
 * arrives, it must arrive WITH its authority, not beside it.
 *
 * So supplying a calendar is a function call that REFUSES unless it carries:
 *   - a named source (document and section that owns the dates), and
 *   - the Owner Decision id under which it ships.
 * A web search is not either of those. A malformed date is not a date.
 */
export class UnauthorisedCalendarError extends Error {
  constructor(missing: string) {
    super(
      'a market-holiday calendar was supplied without ' + missing + '. A calendar assembled '
        + 'without authority would be rendered as though the Bank of Israel had said so, and a '
        + 'wrong holiday makes a stale rate look fresh -- the unsafe direction. Name the source '
        + 'and the Owner Decision that rules it, or ship the absence (the safe direction).',
    );
    this.name = 'UnauthorisedCalendarError';
  }
}

/** Who says these dates mean the market was closed. Both fields are load-bearing. */
export interface CalendarAuthority {
  /** Document and section that owns the dates. Never a URL alone. */
  readonly namedSource: string;
  /** The Owner Decision id under which this calendar enters the build, e.g. OD-nn. */
  readonly ruledBy: string;
}

export interface AuthorisedHolidayCalendar {
  readonly state: 'SUPPLIED';
  readonly days: readonly string[];
  readonly authority: CalendarAuthority;
}

/**
 * Construct a holiday calendar. Refuses anything that cannot cite itself -- this is the refusal
 * H2 watches fire, called directly by the committed control so it can never rot quietly.
 */
export function supplyMarketHolidayCalendar(
  days: readonly string[],
  authority: CalendarAuthority,
): AuthorisedHolidayCalendar {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!authority || typeof authority.namedSource !== 'string' || authority.namedSource.trim() === '') {
    throw new UnauthorisedCalendarError('a named source');
  }
  if (!authority || typeof authority.ruledBy !== 'string' || !/OD-\d+/.test(authority.ruledBy)) {
    throw new UnauthorisedCalendarError('an Owner Decision id');
  }
  for (const d of days) {
    if (typeof d !== 'string' || !iso.test(d)) {
      throw new UnauthorisedCalendarError('a well-formed ISO date (got "' + String(d) + '")');
    }
  }
  return { state: 'SUPPLIED', days: [...days], authority: { ...authority } };
}

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

/** Export above is literal-typed against the adapter contract. */
