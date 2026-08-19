/**
 * DR-012 finding 2 — validated parsing for the persisted user profile.
 *
 * Kept in its own module, free of any `keyVault` import, so it is reachable
 * from tests: `keyVault` pulls in native SecureStore/MMKV bindings that do not
 * load in the Node test environment. This is the same separation that makes
 * `hydration.ts`, `authGatePolicy.ts` and `cardsEmptyState.ts` testable.
 *
 * `useUserStore.hydrate()` previously did `JSON.parse(raw) as UserProfile` — a
 * bare cast. `useProfileStore` guards the same operation with `isAppProfile()`
 * and `useCardsStore` with `assertValidObligation`; this store was the
 * outlier. The profile carries `monthlyIncome` and `currentBalance`, which
 * MVP_SCOPE §7.4 uses to judge affordability, so a corrupt record reaching the
 * engine as trusted numbers is a real financial-correctness risk.
 *
 * A record that fails the guard is treated as ABSENT, never as partially
 * trusted: `assessSnapshot` then reports the fields missing and the Purchase
 * Gate refuses rather than computing on rubbish.
 */

import type { UserProfile } from '../types/user.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

export function isUserProfile(value: unknown): value is UserProfile {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id !== '' &&
    isFiniteNumber(value.monthlyIncome) &&
    isFiniteNumber(value.currentBalance) &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt) &&
    isOptionalString(value.bankName) &&
    isOptionalString(value.phoneNumber) &&
    (value.dangerThreshold === undefined ||
      isFiniteNumber(value.dangerThreshold))
  );
}

/** Parse a stored record, returning null for anything not a valid profile. */
export function parseStoredProfile(raw: string | undefined): UserProfile | null {
  if (raw === undefined) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isUserProfile(parsed) ? parsed : null;
  } catch {
    // Malformed JSON previously threw out of hydrate() uncaught.
    return null;
  }
}
