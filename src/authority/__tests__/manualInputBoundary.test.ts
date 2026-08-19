import {
  acceptManualInput,
  assertNotUserInput,
  manualInputToAuthority,
} from '../manualInputBoundary';
import { isCurrentAuthority, known } from '../authorityValue';

const AT = '2026-08-15T00:00:00Z';

describe('W1-AS-06 manual input boundary', () => {
  it('accepts a plain number and pins it to USER_INPUT', () => {
    const outcome = acceptManualInput({ field: 'card.fee', rawValue: '12.5', enteredAt: AT });
    expect(outcome.accepted).toBe(true);
    if (outcome.accepted) {
      expect(outcome.value.value).toBe(12.5);
      expect(outcome.value.provenance).toBe('USER_INPUT');
      // The whole point: user input is never current official authority.
      expect(isCurrentAuthority(outcome.value)).toBe(false);
    }
  });

  it('rejects anything that is not a plain decimal number', () => {
    for (const raw of ['', '  ', 'abc', '1,200', '₪12', '1e3', '12.5.6', '--3']) {
      const outcome = acceptManualInput({ field: 'f', rawValue: raw, enteredAt: AT });
      expect(outcome.accepted).toBe(false);
    }
  });

  it('enforces range and precision policy', () => {
    expect(
      acceptManualInput({ field: 'f', rawValue: '-1', enteredAt: AT }, { min: 0 }).accepted,
    ).toBe(false);
    expect(
      acceptManualInput({ field: 'f', rawValue: '101', enteredAt: AT }, { max: 100 }).accepted,
    ).toBe(false);
    expect(
      acceptManualInput({ field: 'f', rawValue: '1.234', enteredAt: AT }, { maxDecimals: 2 }).accepted,
    ).toBe(false);
    expect(
      acceptManualInput({ field: 'f', rawValue: '1.23', enteredAt: AT }, { maxDecimals: 2 }).accepted,
    ).toBe(true);
  });

  it('turns a rejection into UNKNOWN carrying the reason, never a zero', () => {
    const value = manualInputToAuthority(
      acceptManualInput({ field: 'f', rawValue: 'abc', enteredAt: AT }),
    );
    expect(value.state).toBe('UNKNOWN');
    if (value.state === 'UNKNOWN') {
      expect(value.reason).toContain('not_a_plain_number');
    }
    expect('value' in value).toBe(false);
  });

  it('blocks user input from reaching an official-authority sink', () => {
    const userValue = known(3, 'USER_INPUT', AT);
    expect(() => assertNotUserInput(userValue, 'authority write')).toThrow(
      /user input may not be used as official authority/,
    );
    expect(() =>
      assertNotUserInput(known(3, 'OFFICIAL_AUTHORITY', AT), 'authority write'),
    ).not.toThrow();
  });
});
