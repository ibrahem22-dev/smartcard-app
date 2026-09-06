/**
 * ZERO IS A BALANCE — the refusal the guided card-add walk ran into on artifact #8.
 *
 * `parseAmount` floors at `MONETARY_MIN_ILS` (₪0.01), which is the right rule for a purchase, an
 * instalment and a credit limit. It was also being applied to a card's CURRENT BALANCE, so a card
 * with nothing owed on it — the ordinary state of a card the moment somebody adds it — could not be
 * saved. The form answered with an error naming five fields, none of which was wrong.
 *
 * These cases pin both halves: zero passes here, and everything the original refuses is still
 * refused, so the second function is a named exception rather than a hole in the first.
 */
import { MONETARY_MAX_ILS, MONETARY_MIN_ILS } from '../monetary';
import { parseAmount, parseAmountAllowingZero } from '../parseAmount';

describe('parseAmountAllowingZero', () => {
  it('accepts zero, which parseAmount refuses', () => {
    expect(parseAmount('0')).toBeNull();
    expect(parseAmountAllowingZero('0')).toBe(0);
  });

  it('accepts the ways a person writes zero', () => {
    for (const written of ['0', ' 0 ', '0.00', '₪0', '00']) {
      expect(parseAmountAllowingZero(written)).toBe(0);
    }
  });

  it('still refuses an empty field — absent is not zero', () => {
    expect(parseAmountAllowingZero('')).toBeNull();
    expect(parseAmountAllowingZero('   ')).toBeNull();
  });

  it('still refuses what is not a number', () => {
    for (const written of ['abc', '1,2,3.4.5', 'NaN', '-']) {
      expect(parseAmountAllowingZero(written)).toBeNull();
    }
  });

  it('still refuses a negative amount and anything over the ceiling', () => {
    expect(parseAmountAllowingZero('-1')).toBeNull();
    expect(parseAmountAllowingZero(String(MONETARY_MAX_ILS + 1))).toBeNull();
  });

  it('agrees with parseAmount on every non-zero value', () => {
    for (const written of ['1', '0.01', '1234.56', '999999', String(MONETARY_MIN_ILS)]) {
      expect(parseAmountAllowingZero(written)).toBe(parseAmount(written));
    }
  });
});
