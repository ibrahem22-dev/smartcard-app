// /src/security/keyVault.ts
//
// SECURITY CONTRACT — auth gate source of truth.
//
// This is a STUB. Real biometric / PIN / secure-storage logic lands in AUTH-01.
// The interface is intentionally fixed now so the navigation layer can be built
// against it without churn later.
//
// Hard rule: any uncertainty about auth state MUST resolve to LOCKED. The vault
// never optimistically reports UNLOCKED. Callers treat anything other than the
// explicit 'UNLOCKED' value as locked.

/**
 * Tri-state auth status.
 * - 'UNLOCKED' is the ONLY value that grants access to financial screens.
 * - 'LOCKED' and 'UNKNOWN' are both treated as locked by the navigation layer.
 *   'UNKNOWN' exists so cold start / restoration can render the lock UI before
 *   the (async) evaluation resolves, without ever defaulting to UNLOCKED.
 */
export type AuthStatus = 'LOCKED' | 'UNLOCKED' | 'UNKNOWN';

export interface KeyVault {
  /**
   * Evaluate the current auth state. Implementations MUST default to 'LOCKED'
   * (never 'UNLOCKED') when state is missing, expired, or otherwise uncertain.
   */
  getAuthStatus(): Promise<AuthStatus>;

  /** Transition to UNLOCKED after a successful auth challenge. */
  unlock(): Promise<void>;

  /** Force LOCKED (e.g. on background, timeout, or explicit sign-out). */
  lock(): Promise<void>;
}

/**
 * Temporary in-memory mock. Defaults to LOCKED on every cold start because the
 * flag lives only in module memory and is re-initialized to `false`.
 * Replaced by a secure-storage backed implementation in AUTH-01.
 */
let mockUnlocked = false;

export const keyVault: KeyVault = {
  async getAuthStatus(): Promise<AuthStatus> {
    return mockUnlocked ? 'UNLOCKED' : 'LOCKED';
  },

  async unlock(): Promise<void> {
    mockUnlocked = true;
  },

  async lock(): Promise<void> {
    mockUnlocked = false;
  },
};
