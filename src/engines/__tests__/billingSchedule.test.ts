import { billingDatesInWindow } from '../billingSchedule';

describe('billingDatesInWindow', () => {
  test('clamps a 31st billing day to the last day of February', () => {
    expect(billingDatesInWindow(31, '2027-02-01', '2027-02-28')).toEqual([
      '2027-02-28',
    ]);
  });

  test('keeps a 30th billing day on the 30th in a 31-day month', () => {
    expect(billingDatesInWindow(30, '2027-03-01', '2027-03-31')).toEqual([
      '2027-03-30',
    ]);
  });

  test.each([0, 32, 1.5])('rejects an out-of-range billing day: %s', (day) => {
    expect(billingDatesInWindow(day, '2027-01-01', '2027-03-31')).toEqual([]);
  });

  test('returns no dates for an empty window', () => {
    expect(billingDatesInWindow(10, '2027-03-11', '2027-03-10')).toEqual([]);
  });
});
