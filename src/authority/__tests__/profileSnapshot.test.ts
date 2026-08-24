/**
 * MVP_SCOPE §4 "App does not invent missing financial values" —
 * regression proof for the `?? 0` fabrication in the Purchase Gate input.
 */

import {
  REQUIRED_SNAPSHOT_FIELDS,
  assessSnapshot,
  profileFieldToAuthority,
  snapshotMissingLabelKeys,
} from '../profileSnapshot';
import { isCurrentAuthority } from '../authorityValue';

const AT = '2026-08-15T00:00:00Z';

describe('profile financial snapshot completeness', () => {
  it('is complete only when both required fields are usable numbers', () => {
    const snapshot = assessSnapshot({ currentBalance: 1200, monthlyIncome: 9000 });
    expect(snapshot.complete).toBe(true);
    if (snapshot.complete) {
      expect(snapshot.currentBalance).toBe(1200);
      expect(snapshot.monthlyIncome).toBe(9000);
    }
  });

  it('never substitutes zero for a missing field', () => {
    // The exact former bug: `profile?.currentBalance ?? 0`.
    const snapshot = assessSnapshot({ monthlyIncome: 9000 });
    expect(snapshot.complete).toBe(false);
    if (!snapshot.complete) {
      expect(snapshot.missing).toEqual(['currentBalance']);
    }
    // And there is no field on the incomplete result that could be read as 0.
    expect('currentBalance' in snapshot).toBe(false);
  });

  it('names every missing field', () => {
    const snapshot = assessSnapshot(null);
    expect(snapshot.complete).toBe(false);
    if (!snapshot.complete) {
      expect(snapshot.missing).toEqual([...REQUIRED_SNAPSHOT_FIELDS]);
      expect(snapshotMissingLabelKeys(snapshot.missing)).toEqual([
        'profile.missing.currentBalance',
        'profile.missing.monthlyIncome',
      ]);
    }
  });

  it('rejects non-finite and non-numeric values rather than coercing them', () => {
    for (const bad of [undefined, null, NaN, Infinity, -Infinity]) {
      const snapshot = assessSnapshot({ currentBalance: bad as number, monthlyIncome: 1 });
      expect(snapshot.complete).toBe(false);
    }
  });

  it('accepts a genuine zero balance as entered data, not as absence', () => {
    // A user who really has ₪0 is different from a user who entered nothing.
    const snapshot = assessSnapshot({ currentBalance: 0, monthlyIncome: 9000 });
    expect(snapshot.complete).toBe(true);
  });

  it('treats profile financials as user input, never official authority', () => {
    const value = profileFieldToAuthority(9000, 'monthlyIncome', AT);
    expect(value.state).toBe('KNOWN');
    if (value.state === 'KNOWN') {
      expect(value.provenance).toBe('USER');
    }
    expect(isCurrentAuthority(value)).toBe(false);
  });

  it('maps an unentered field to UNKNOWN carrying the field name', () => {
    const value = profileFieldToAuthority(undefined, 'currentBalance', AT);
    expect(value.state).toBe('UNKNOWN');
    if (value.state === 'UNKNOWN') {
      expect(value.reason).toContain('currentBalance');
    }
    expect('value' in value).toBe(false);
  });
});
