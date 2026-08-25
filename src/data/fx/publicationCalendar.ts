import { isBusinessDay } from '@smartcard/data-authority-adapter';

/**
 * THE BOI PUBLICATION CALENDAR — authority/boi-fetch-spec.md §C7.
 *
 *   > *"MON-FRI, Fridays published, no Saturday or Sunday — measured over real publication dates,
 *   > not assumed from the Israeli banking week."*
 *
 * THE TRAP THIS MODULE EXISTS TO KEEP CLOSED. `isBusinessDay` was first written for the Israeli
 * BANKING week — Sunday-Thursday, weekend Friday+Saturday. That is the obvious answer and it is
 * wrong for this publication: measured over every distinct date in the golden snapshot and its
 * history (reports/campaign/BOI_STATE.md §4), publication dates fall Mon 3 · Tue 3 · Wed 3 · Thu 3
 * · Fri 3 · Sat 0 · Sun 0. **Friday IS a publication day and Sunday is NOT** — opposite to the
 * banking calendar on both days at once.
 *
 * This module adds no calendar logic of its own: the adapter owns `isBusinessDay` and this module
 * re-exports the judgement through publication-day naming so callers cannot quietly substitute a
 * different notion of "business day". One home per fact.
 *
 * Holidays: the market-holiday question is P3-4 (contract group H). Until an authority supplies a
 * calendar, the list stays empty and a holiday reads as an ordinary publication day — failing
 * toward STALE, the safe direction (fxStaleness.ts records the deferral).
 */

/** Stated rather than implied, so the trap cannot return silently. */
export const PUBLICATION_WEEK = {
  /** MON-FRI. Friday IS a publication day — the international FX market week, not the banking week. */
  fridayIsPublicationDay: true,
  /** No Saturday publication. Ever observed: 0. */
  saturdayIsPublicationDay: false,
  /** No Sunday publication. Ever observed: 0. */
  sundayIsPublicationDay: false,
} as const;

/**
 * Is this ISO date a day the Bank of Israel publishes representative rates on?
 *
 * Weekends need no calendar to rule out. A weekday is provisional until P3-4 answers the
 * market-holiday question — `publishesOn` in fxStaleness.ts carries that nuance for renderers;
 * this function answers the CALENDAR question for fetch cadence (spec §3, PD-P3-003).
 */
export function isPublicationDay(iso: string, holidays: readonly string[] = []): boolean {
  return isBusinessDay(iso, holidays);
}

/**
 * The most recent publication day on or before `iso` — the day whose publication a probe on `iso`
 * should have received. Walking FORWARD from a weekend is the carry-forward's other half, and it is
 * where the banking-week bug would send a Saturday probe hunting for a Sunday rate that was never
 * published.
 */
export function lastPublicationDayOnOrBefore(
  iso: string,
  holidays: readonly string[] = [],
): string | undefined {
  const dayMs = 86_400_000;
  let cursor = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(cursor)) return undefined;
  for (let i = 0; i < 14; i += 1) {
    const candidate = new Date(cursor).toISOString().slice(0, 10);
    if (isBusinessDay(candidate, holidays)) return candidate;
    cursor -= dayMs;
  }
  return undefined;
}
