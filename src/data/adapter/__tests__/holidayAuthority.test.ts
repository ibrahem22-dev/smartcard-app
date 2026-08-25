import {
  MARKET_HOLIDAY_CALENDAR,
  UnauthorisedCalendarError,
  supplyMarketHolidayCalendar,
} from '../fxStaleness';

/**
 * H2's controls -- the refusal a calendar meets when it arrives without authority.
 *
 * Contract: *"No calendar was assembled without authority: a calendar with no cited source is
 * refused."* The shipped state is ABSENT_DEFERRED (OD-31); these cases prove that if anyone ever
 * does supply one, the door refuses to open without a named source and an Owner Decision id --
 * and opens only through them.
 */

describe('the market-holiday calendar door (H2)', () => {
  it('the shipped state is the declared absence, not an empty accident', () => {
    expect(MARKET_HOLIDAY_CALENDAR.state).toBe('ABSENT_DEFERRED');
    expect(MARKET_HOLIDAY_CALENDAR.days).toEqual([]);
    expect(MARKET_HOLIDAY_CALENDAR.deferredBy).toMatch(/^OD-\d+$/);
  });

  it('CONTROL: a calendar with no named source is REFUSED', () => {
    expect(() =>
      supplyMarketHolidayCalendar(['2026-09-22'], { namedSource: '', ruledBy: 'OD-31' }),
    ).toThrow(UnauthorisedCalendarError);
    expect(() =>
      supplyMarketHolidayCalendar(['2026-09-22'], { namedSource: '   ', ruledBy: 'OD-31' }),
    ).toThrow(/named source/);
  });

  it('CONTROL: a calendar whose ruling carries no OD id is REFUSED', () => {
    expect(() =>
      supplyMarketHolidayCalendar(['2026-09-22'], {
        namedSource: 'some document',
        ruledBy: 'because it seems right',
      }),
    ).toThrow(/Owner Decision id/);
  });

  it('CONTROL: a malformed date is REFUSED', () => {
    expect(() =>
      supplyMarketHolidayCalendar(['22/09/2026'], {
        namedSource: 'a real source',
        ruledBy: 'OD-99',
      }),
    ).toThrow(/well-formed ISO date/);
  });

  it('an authority-cited, well-formed calendar is accepted -- the door opens only through citation', () => {
    const cal = supplyMarketHolidayCalendar(['2026-09-22'], {
      namedSource: 'hypothetical future ruling source',
      ruledBy: 'OD-99',
    });
    expect(cal.state).toBe('SUPPLIED');
    expect(cal.days).toEqual(['2026-09-22']);
    expect(cal.authority.ruledBy).toBe('OD-99');
  });
});
