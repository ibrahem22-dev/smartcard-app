/**
 * DR-012 findings 1 and 2 — onboarding persistence.
 *
 * `useUserStore` holds `monthlyIncome` and `currentBalance`, the two values
 * MVP_SCOPE §7.4 uses to judge whether a purchase is affordable. It previously
 * parsed them with a bare `JSON.parse(raw) as UserProfile` cast and had no
 * hydration state, so a corrupt record became a trusted profile and an
 * unloaded store was indistinguishable from a user with no financial state.
 */

// Imported from the pure module, not from useUserStore: that store pulls in
// keyVault -> native SecureStore/MMKV bindings, which do not load under Node.
import { isUserProfile, parseStoredProfile } from '../userProfileParsing';
import { assessSnapshot } from '../../authority/profileSnapshot';
import type { UserProfile } from '../../types/user.types';

const VALID: UserProfile = {
  id: 'user-1',
  monthlyIncome: 12_000,
  currentBalance: 4_500,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

describe('DR-012.2 stored profile parsing', () => {
  it('accepts a well-formed profile', () => {
    const parsed = parseStoredProfile(JSON.stringify(VALID));
    expect(parsed).toEqual(VALID);
    expect(isUserProfile(VALID)).toBe(true);
  });

  it('accepts the documented optional fields', () => {
    const withOptionals: UserProfile = {
      ...VALID,
      bankName: 'Leumi',
      phoneNumber: '0500000000',
      dangerThreshold: 500,
    };
    expect(parseStoredProfile(JSON.stringify(withOptionals))).toEqual(
      withOptionals,
    );
  });

  it('returns null for malformed JSON instead of throwing', () => {
    // This previously threw out of hydrate() uncaught.
    expect(parseStoredProfile('{"id":"user-1",')).toBeNull();
    expect(parseStoredProfile('not json at all')).toBeNull();
  });

  it('rejects a record missing monthly income — that is not a stored profile', () => {
    const { monthlyIncome: _dropped, ...withoutIncome } = VALID;
    expect(parseStoredProfile(JSON.stringify(withoutIncome))).toBeNull();
    expect(isUserProfile(withoutIncome)).toBe(false);
  });

  it('accepts income and payday without inventing a balance', () => {
    const incomeOnly: UserProfile = {
      id: 'user-1',
      monthlyIncome: 12_000,
      payday: { kind: 'day', day: 15 },
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    };
    expect(parseStoredProfile(JSON.stringify(incomeOnly))).toEqual(incomeOnly);
  });

  it('rejects non-finite or wrongly-typed financial values', () => {
    for (const bad of ['12000', null, {}, [], true]) {
      expect(
        isUserProfile({ ...VALID, monthlyIncome: bad as number }),
      ).toBe(false);
    }
    // NaN and Infinity survive a cast but are not usable money.
    expect(isUserProfile({ ...VALID, currentBalance: NaN })).toBe(false);
    expect(isUserProfile({ ...VALID, currentBalance: Infinity })).toBe(false);
  });

  it('rejects a wrongly-typed optional field rather than ignoring it', () => {
    expect(isUserProfile({ ...VALID, bankName: 42 })).toBe(false);
    expect(isUserProfile({ ...VALID, dangerThreshold: 'high' })).toBe(false);
  });

  it('treats an undefined record as absent, not as an error', () => {
    expect(parseStoredProfile(undefined)).toBeNull();
  });

  it('accepts a genuine zero balance — entered, not absent', () => {
    expect(isUserProfile({ ...VALID, currentBalance: 0 })).toBe(true);
  });

  it('a rejected record makes the Purchase Gate refuse, not miscompute', () => {
    // The seam that matters: a corrupt profile must not reach §7.4 as usable
    // numbers. It parses to null, so assessSnapshot reports both fields
    // missing and the gate refuses instead of judging affordability on junk.
    const corrupt = parseStoredProfile('{"id":"u","monthlyIncome":"lots"}');
    expect(corrupt).toBeNull();

    const snapshot = assessSnapshot(corrupt);
    expect(snapshot.complete).toBe(false);
    if (!snapshot.complete) {
      expect(snapshot.missing).toEqual(['currentBalance', 'monthlyIncome']);
    }
  });
});
