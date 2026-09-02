import { BILLING_REMINDER_WINDOW_MONTHS } from '../config/financial';

/** Day-of-month → the next occurrence on or after `asOfDate`, within the window. Calendar, not policy. */
export const billingDatesInWindow = (
  dayOfMonth: number,
  asOfDate: string,
  throughDate: string,
): readonly string[] => {
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return [];
  const out: string[] = [];
  const start = new Date(asOfDate + 'T00:00:00Z');
  const end = new Date(throughDate + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    /* A card billing on the 31st bills on the last day of a short month. Clamping is the Israeli
       billing model, not an approximation of it. */
    const day = Math.min(dayOfMonth, daysInMonth);
    const d = new Date(Date.UTC(y, m, day));
    if (d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) {
      out.push(d.toISOString().slice(0, 10));
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
};

const localDateAsIso = (date: Date): string => {
  const localMidnightAsUtc = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ));
  return localMidnightAsUtc.toISOString().slice(0, 10);
};

/** Billing dates in the product's bounded notification horizon, starting today. */
export const billingReminderDates = (
  dayOfMonth: number,
  asOf: Date,
): readonly string[] => {
  const asOfDate = localDateAsIso(asOf);
  const start = new Date(Date.UTC(
    asOf.getFullYear(),
    asOf.getMonth(),
    asOf.getDate(),
  ));
  const through = new Date(start);
  through.setUTCMonth(through.getUTCMonth() + BILLING_REMINDER_WINDOW_MONTHS);
  through.setUTCDate(through.getUTCDate() - 1);
  return billingDatesInWindow(
    dayOfMonth,
    asOfDate,
    through.toISOString().slice(0, 10),
  );
};
