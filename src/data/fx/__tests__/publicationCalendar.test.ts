import {
  isPublicationDay,
  lastPublicationDayOnOrBefore,
} from '../publicationCalendar';

/**
 * A2 — THE PUBLICATION CALENDAR (authority/boi-fetch-spec.md §C7).
 *
 * The trap: `isBusinessDay` was first written for the Israeli BANKING week (Sun–Thu, weekend
 * Fri+Sat). The publication follows the international FX market week, measured over every distinct
 * date in the golden snapshot and its history — Mon 3 · Tue 3 · Wed 3 · Thu 3 · Fri 3 · Sat 0 ·
 * Sun 0. These tests pin that measurement against the calendar this module serves.
 */

describe('A2 — the BOI publication week is MON-FRI with Fridays published', () => {
  // 2026-08-21 is a Friday; a real publication date in the shipped series' own week.
  it('Friday IS a publication day — the banking-week assumption would have called it a weekend', () => {
    expect(isPublicationDay('2026-08-21')).toBe(true);
    expect(isPublicationDay('2026-08-14')).toBe(true);
    expect(isPublicationDay('2026-08-07')).toBe(true);
  });

  it('Saturday and Sunday are not publication days', () => {
    expect(isPublicationDay('2026-08-22')).toBe(false);
    expect(isPublicationDay('2026-08-23')).toBe(false);
    expect(isPublicationDay('2026-08-15')).toBe(false);
    expect(isPublicationDay('2026-08-16')).toBe(false);
  });

  it('Monday through Thursday are publication days', () => {
    expect(isPublicationDay('2026-08-17')).toBe(true);
    expect(isPublicationDay('2026-08-18')).toBe(true);
    expect(isPublicationDay('2026-08-19')).toBe(true);
    expect(isPublicationDay('2026-08-20')).toBe(true);
  });
});

describe('A2/A3 — carry-forward walks BACK to a real publication day', () => {
  it('a Sunday probe walks back to Friday, never hunting a rate that was never published', () => {
    // The banking-week bug would walk a Sunday probe to THURSDAY (last banking day) and read a
    // Friday publication as if it were a weekend carry-forward in the wrong direction.
    expect(lastPublicationDayOnOrBefore('2026-08-23')).toBe('2026-08-21');
    expect(lastPublicationDayOnOrBefore('2026-08-16')).toBe('2026-08-14');
  });

  it('a Saturday probe also lands on Friday', () => {
    expect(lastPublicationDayOnOrBefore('2026-08-22')).toBe('2026-08-21');
  });

  it('a publication day resolves to itself', () => {
    expect(lastPublicationDayOnOrBefore('2026-08-21')).toBe('2026-08-21');
    expect(lastPublicationDayOnOrBefore('2026-08-18')).toBe('2026-08-18');
  });
});

describe('A3 — staleness is computed from the calendar, never guessed', () => {
  it('the calendar honours a supplied holiday list', () => {
    // A declared holiday returns a missed publication to a carry-forward (BOI_STATE §5).
    const thursday = '2026-08-20';
    const friday = '2026-08-21';
    expect(lastPublicationDayOnOrBefore(friday, [friday])).toBe(thursday);
  });

  it('a malformed date answers undefined rather than inventing a day', () => {
    expect(lastPublicationDayOnOrBefore('not-a-date')).toBeUndefined();
  });
});
