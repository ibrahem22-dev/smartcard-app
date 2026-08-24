import {
  MARKET_HOLIDAY_CALENDAR,
  STALE_AFTER_CALENDAR_DAYS,
  publishesOn,
  stalenessReading,
} from '../fxStaleness';

/**
 * CRITERION C9 — *"A BOI market-holiday calendar is supplied to `stalenessOf` **or** its absence is
 * a dated `DEFERRED` entry carrying an OD id. **A holiday must not read as an ordinary publication
 * day.**"*
 *
 * There is no calendar. These tests assert both halves: that the absence is declared with a ruling
 * and a date, and that nothing in this app presents a business-day judgement it cannot make.
 */

describe('C9 — the calendar is absent, and the absence is declared', () => {
  it('carries an Owner Decision id and a date, not a bare TODO', () => {
    expect(MARKET_HOLIDAY_CALENDAR.state).toBe('ABSENT_DEFERRED');
    expect(MARKET_HOLIDAY_CALENDAR.deferredBy).toMatch(/^OD-\d+$/);
    expect(MARKET_HOLIDAY_CALENDAR.deferredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(MARKET_HOLIDAY_CALENDAR.register).toContain('P1_DEFERRED');
  });

  it('declares WHICH WAY it fails, because the direction is the reason it is a deferral', () => {
    // A holiday counted as a publication day makes a rate look OLDER than it is. Fails toward
    // STALE, which is the safe direction; a wrong calendar would fail the other way.
    expect(MARKET_HOLIDAY_CALENDAR.direction).toBe('FAILS_TOWARD_STALE');
  });

  it('supplies an EMPTY list explicitly rather than omitting the argument', () => {
    // The adapter's parameter is optional. Passing nothing and passing nothing-on-purpose read the
    // same to a compiler and differently to a person.
    expect(Array.isArray(MARKET_HOLIDAY_CALENDAR.days)).toBe(true);
    expect(MARKET_HOLIDAY_CALENDAR.days).toEqual([]);
  });
});

describe('C9 — a holiday does not read as an ordinary publication day', () => {
  it('marks businessDaysOld as NOT authoritative while the calendar is absent', () => {
    const reading = stalenessReading('2026-08-14', '2026-08-18');
    expect(reading.businessDaysAreAuthoritative).toBe(false);
    expect(reading.holidayCalendar).toBe('ABSENT_DEFERRED');
    expect(reading.deferredBy).toBe(MARKET_HOLIDAY_CALENDAR.deferredBy);
  });

  it('refuses to call a weekday a publication day', () => {
    // 2026-08-18 is a Tuesday. Without a calendar the honest answer is "cannot tell", not "yes".
    expect(publishesOn('2026-08-18')).toBeUndefined();
  });

  it('DOES rule out a weekend, which needs no calendar', () => {
    // 2026-08-15 is a Saturday. The market is closed and no holiday list is required to know it,
    // so returning undefined here would be false modesty.
    expect(publishesOn('2026-08-15')).toBe(false);
  });

  it('staleness itself is unaffected — STALE is a CALENDAR-day judgement', () => {
    // Calendar days need no calendar. The threshold is read from the adapter rather than repeated.
    expect(STALE_AFTER_CALENDAR_DAYS).toBe(7);
    expect(stalenessReading('2026-08-01', '2026-08-18').stale).toBe(true);
    expect(stalenessReading('2026-08-17', '2026-08-18').stale).toBe(false);
  });

  it('carries both numbers, because they answer different questions', () => {
    const reading = stalenessReading('2026-08-14', '2026-08-18');
    expect(typeof reading.calendarDaysOld).toBe('number');
    expect(typeof reading.businessDaysOld).toBe('number');
    // "The market has been closed for four days" and "we have not fetched for four days" need
    // different answers, and collapsing the two would leave a support conversation unable to tell
    // them apart.
    expect(reading.businessDaysOld).toBeLessThanOrEqual(reading.calendarDaysOld);
  });

  it('a weekend carry-forward is not stale, and says so', () => {
    // Friday's rate read on Sunday: the current publication, carried forward, not out of date.
    const reading = stalenessReading('2026-08-14', '2026-08-16');
    expect(reading.stale).toBe(false);
    expect(reading.carriedForwardOnly).toBe(true);
  });
});
