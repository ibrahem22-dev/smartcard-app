// /src/auth/index.ts
//
// SmartCard — public authentication façade (AUTH-01).
//
// Single entry point the app shell / navigation layer uses to authenticate the
// user. It ORCHESTRATES, and owns no secret of its own:
//   • biometric prompts → expo-local-authentication (hardware/UX gate)
//   • PIN unlock/enroll  → delegated to keyVault (the sole PIN KDF + envelope owner)
//   • session + lockout  → delegated to keyVault (unlock / lock / getAuthStatus)
//
// ── KDF DECISION (AUTH-01): OPTION B ─────────────────────────────────────────
// react-native-argon2 is NOT compatible with the Expo SDK 52 *managed* workflow:
// it ships no Expo config plugin, so it cannot load in Expo Go and would require
// prebuild + a custom native build (and Argon2 is not yet in expo-crypto). That
// also contradicts keyVault's own documented rationale. So it is NOT installed
// and there is NO react-native-argon2 branch here (no null-returning dead code).
//
// There is exactly ONE PIN KDF path, and it lives in keyVault — NOT here:
// keyVault.enrollPin()/unlockWithPin() take the RAW PIN and derive the wrapping
// KEK with Argon2id (@noble/hashes, pure-JS, managed-safe) PLUS a device-bound
// pepper that never leaves keyVault. auth therefore cannot (and must not) derive
// the KEK itself: doing so would bypass that pepper (a security regression) and
// duplicate the envelope keyVault is required to own. We forward the raw PIN and
// let keyVault perform the single, approved derivation. (A PBKDF2-in-auth path
// was considered and rejected for exactly these reasons — it would be weaker
// than keyVault's Argon2id+pepper and could not be wired without weakening the
// approved keyVault contract.)
//
// SACRED-BOUNDARY (project rule): keyVault.ts owns the DEK, the PIN KDF, the
// AES-GCM PIN envelope, the device-bound pepper, and the brute-force FAILURE
// COUNTER. This file holds NO key material, runs NO KDF, and implements NO
// second counter.
//
// Lockout schedule owned by keyVault.delayForFailures().
// Terminal wipe at TERMINAL_FAILURE_COUNT (10). See keyVault.ts.
//
// PIN hash hygiene: the PIN is NEVER stored in plain MMKV (or anywhere) — only
// keyVault's SecureStore envelope exists, and only keyVault.enrollPin() ever
// touches it. No plain-text PIN or biometric template is persisted here.
//
// OFFLINE-FIRST: zero network calls in this module by construction.
//
// ─────────────────────────────────────────────────────────────────────────────
// AC-7 / SESS-3: app-switcher privacy overlay must be implemented
// in the app shell (App.tsx or RootNavigator) using AppState +
// a blur/overlay component. This file cannot implement it.
// ─────────────────────────────────────────────────────────────────────────────

import * as LocalAuthentication from 'expo-local-authentication';

import {
  keyVault,
  type AuthStatus,
  type UnlockResult,
} from '../security/keyVault';

// --- Public result/types ------------------------------------------------------

/** Re-export keyVault's tri-state so callers import a single auth surface. */
export type { AuthStatus } from '../security/keyVault';

/** Unlock outcome. Identical to keyVault's contract — auth never re-shapes it. */
export type AuthResult = UnlockResult;

/** Snapshot of the device's biometric capability (read-only, no side effects). */
export interface BiometricCapability {
  readonly hasHardware: boolean;
  readonly isEnrolled: boolean;
  readonly types: readonly LocalAuthentication.AuthenticationType[];
  /** Convenience: hardware present AND a biometric is enrolled. */
  readonly available: boolean;
}

// --- Biometric capability + unlock (expo-local-authentication) ----------------

/**
 * Probe the OS for biometric hardware + enrollment. Pure read; never prompts.
 * The UI uses this to decide whether to offer "Unlock with Face ID / Touch ID".
 */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { hasHardware, isEnrolled, types, available: hasHardware && isEnrolled };
}

/**
 * Biometric unlock:
 *   1. Confirm hardware + enrollment (device gate — NOT a credential attempt).
 *   2. OS biometric prompt via expo-local-authentication.
 *   3. On prompt success, delegate to keyVault — which actually retrieves and
 *      binds the DEK behind its own SecureStore auth gate (BIND-1).
 *
 * Lockout is NOT decided here: keyVault returns
 * { ok:false, reason:'locked_out', retryAfterMs } when its shared-counter window
 * is active (the SAME counter the PIN path increments), and we pass it through.
 */
export async function authenticateWithBiometrics(): Promise<AuthResult> {
  const capability = await getBiometricCapability();
  if (!capability.available) {
    // Device condition, not a failed credential → must not touch the counter.
    return { ok: false, reason: 'bad_credential' };
  }

  const prompt = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock SmartCard',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false, // allow OS passcode as a device-level fallback
  });

  if (!prompt.success) {
    // Cancel / timeout / OS biometric lockout: not an in-app PIN failure (AC-5).
    return { ok: false, reason: 'bad_credential' };
  }

  // keyVault is the cryptographic source of truth for the actual unlock.
  return keyVault.unlockWithBiometric();
}

// --- PIN enrollment + unlock (KDF + envelope owned entirely by keyVault) -------
//
// No KDF runs in this module (see KDF DECISION at the top). We forward the raw
// PIN; keyVault derives the KEK (Argon2id + device-bound pepper) and owns the
// salt, pepper, and AES-GCM envelope in SecureStore. The PIN is never persisted
// and never written to MMKV.

/**
 * Enroll/replace the PIN fallback. Requires an already-UNLOCKED session so
 * keyVault can wrap the in-memory DEK under the freshly PIN-derived KEK. PIN
 * hashing happens ONLY inside keyVault.enrollPin() (PIN-1).
 */
export async function enrollPin(pin: string): Promise<void> {
  await keyVault.enrollPin(pin);
}

/**
 * PIN unlock. The raw PIN is forwarded to keyVault, which runs the KDF, attempts
 * the GCM unwrap, and — crucially — owns the shared FAILURE COUNTER + escalating
 * backoff. We never pre-check or re-count: keyVault returns 'bad_credential' or
 * 'locked_out' (with retryAfterMs) and we surface it verbatim.
 *
 * Lockout schedule owned by keyVault.delayForFailures().
 * Terminal wipe at TERMINAL_FAILURE_COUNT (10). See keyVault.ts.
 */
export async function authenticateWithPin(pin: string): Promise<AuthResult> {
  return keyVault.unlockWithPin(pin);
}

// --- Lockout (counter + schedule owned ENTIRELY by keyVault) ------------------
//
// The failure counter lives ONLY in keyVault (one shared counter across the
// biometric and PIN paths); this module keeps NO local counter. The escalating
// backoff is defined by keyVault.delayForFailures() and the terminal wipe by
// keyVault's TERMINAL_FAILURE_COUNT. The sequence below is REFERENCE ONLY (not
// hardcoded here) — keyVault.ts is the single authority, and if it ever changes
// it changes there:
//
//   failures 1–4 : no delay
//   failures 5   : 30s
//   failures 6   : 60s
//   failures 7   : 5 min
//   failures 8   : 15 min
//   failures 9   : 60 min
//   failures 10  : TERMINAL WIPE — DEK destroyed, ciphertext permanently lost
//
// (Authority: keyVault.delayForFailures() + TERMINAL_FAILURE_COUNT in keyVault.ts.)

/**
 * Reset the shared lockout counter — strictly via a successful BIOMETRIC unlock.
 *
 * keyVault owns the counter and is the only thing that may clear it; it does so
 * internally (its private resetFailures()) the moment unlockWithBiometric()
 * succeeds. There is no standalone public keyVault reset, and we must not touch
 * keyVault — so the sanctioned, biometric-only reset IS a fresh successful
 * biometric unlock. A failed/cancelled prompt resets nothing, and the PIN path
 * is deliberately NOT a trigger here. On { ok: true } the counter is cleared.
 */
export async function resetLockout(): Promise<AuthResult> {
  return keyVault.unlockWithBiometric();
}

// --- Session lifecycle (delegated to keyVault) --------------------------------

/** KGEN idempotency check — does a DEK already exist for this install? */
export async function isInitialized(): Promise<boolean> {
  return keyVault.isInitialized();
}

/** KGEN + KWRAP on first launch. Idempotent — safe on every cold start. */
export async function initialize(): Promise<void> {
  await keyVault.initializeOnFirstLaunch();
}

/** Tri-state status for the navigation/auth gate. */
export async function getAuthStatus(): Promise<AuthStatus> {
  return keyVault.getAuthStatus();
}

/** Synchronous UNLOCKED check (DEK in memory AND MMKV open). */
export function isUnlocked(): boolean {
  return keyVault.isUnlocked();
}

/** ZERO: wipe the in-memory DEK and drop the MMKV handle. */
export function lock(): void {
  keyVault.lock();
}

// --- Cohesive façade ----------------------------------------------------------

/**
 * Single object the app shell depends on. Every member is a thin delegate to
 * keyVault (the §8 authority) or expo-local-authentication — no auth state, no
 * key material, no KDF, and no second lockout counter is held in this module.
 */
export const auth = {
  isInitialized,
  initialize,
  getAuthStatus,
  isUnlocked,
  getBiometricCapability,
  authenticateWithBiometrics,
  enrollPin,
  authenticateWithPin,
  resetLockout,
  lock,
} as const;

export default auth;
