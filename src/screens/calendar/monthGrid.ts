import { WEEK_ORDER } from '../../utils/calendar';

export interface MonthGridDay {
  readonly iso: string;
  readonly dayOfMonth: number;
  readonly inMonth: boolean;
}

function isoDate(year: number, monthIndex: number, dayOfMonth: number): string {
  const date = new Date(Date.UTC(year, monthIndex, dayOfMonth));
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${String(date.getUTCFullYear())}-${month}-${day}`;
}

export function monthGridFor(
  year: number,
  month: number,
): readonly (readonly MonthGridDay[])[] {
  const monthIndex = month - 1;
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const leadingDayCount = WEEK_ORDER.indexOf(firstWeekday as (typeof WEEK_ORDER)[number]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const rowCount = Math.ceil(
    (leadingDayCount + daysInMonth) / WEEK_ORDER.length,
  );

  return Array.from({ length: rowCount }, (_, rowIndex) =>
    WEEK_ORDER.map((_, columnIndex): MonthGridDay => {
      const relativeDay =
        rowIndex * WEEK_ORDER.length + columnIndex - leadingDayCount + 1;
      const date = new Date(Date.UTC(year, monthIndex, relativeDay));

      return {
        iso: isoDate(year, monthIndex, relativeDay),
        dayOfMonth: date.getUTCDate(),
        inMonth: date.getUTCMonth() === monthIndex,
      };
    }),
  );
}
