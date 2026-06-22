// /src/auth/index.ts
//
// SmartCard — public authentication façade (AUTH-01 scaffold).
//
// Single entry point the app shell / navigation layer uses to authenticate the
// user. It ORCHESTRATES three concerns and owns no secret of its own:
//   • biometric prompts  → expo-local-authentication (hardware/UX gate)
//   • PIN unlock + KDF    → Argon2id (react-native-argon2) with a PBKDF2/
//                           expo-crypto (100k) fallback; the authoritative
//                           DEK envelope + unwrap is performed by keyVault.
//   • session + lockout   → delegated to keyVault (unlock / lock / getAuthStatus)
//
// SACRED-BOUNDARY (project rule: engines/security are owned by their module):
//   keyVault.ts owns the DEK, the AES-GCM PIN envelope, the device-bound pepper,
//   and the brute-force FAILURE COUNTER. This file holds NO key material and
//   implements NO second counter — it forwards the raw PIN to keyVault and
//   surfaces keyVault's UnlockResult verbatim.
//
// OFFLINE-FIRST: zero network calls in this module by construction.
// NO plain-text storage of the PIN (never persisted) or biometric data
// (templates never leave the OS secure enclave).
//
// ─────────────────────────────────────────────────────────────────────────────
// AC-7 / SESS-3: app-switcher privacy overlay must be implemented
// in the app shell (App.tsx or RootNavigator) using AppState +
// a blur/overlay component. This file cannot implement it.
// ─────────────────────────────────────────────────────────────────────────────
//
// PIN KDF backend (N1): keyVault currently derives the PIN-wrapping KEK with
// Argon2id via @noble/hashes (pure-JS, managed-workflow safe; it deliberately
// AVOIDS react-native-argon2 per its own header rationale). This file scaffolds
// the requested react-native-argon2 → PBKDF2(100k) strategy as a capability
// layer, but the AUTHORITATIVE wrap/unwrap stays in keyVault. Consolidating
// "which KDF backend" must happen INSIDE keyVault, not by wrapping a 2nd here.
//
// Lockout schedule owned by keyVault.delayForFailures().
// Terminal wipe at TERMINAL_FAILURE_COUNT (10). See keyVault.ts.

import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';

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

/** PIN key-derivation backend actually in use on this device. */
export type PinKdfBackend =
  | 'argon2id' // primary — react-native-argon2 (native, custom dev client)
  | 'pbkdf2-100k'; // fallback — PBKDF2/SHA-256, 100_000 iters via expo-crypto

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
 *   3. On prompt success, delegate to keyVault — which is what actually retrieves
 *      and binds the DEK behind its own SecureStore auth gate (BIND-1).
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

// --- PIN KDF strategy (Argon2id → PBKDF2 fallback) ----------------------------
//
// The PBKDF2 fallback is fully implemented below; the Argon2id (native) path is
// still scaffolded (loadNativeArgon2 returns null until the dev client wires it).
// The derived KEK is consumed by keyVault's PIN envelope (authoritative); this
// layer only chooses HOW the KEK is derived, never where the DEK is wrapped (N1).

/** RFC 9106-ish Argon2id parameters (mirror keyVault's KDF_PARAMS next block). */
const ARGON2_PARAMS = {
  iterations: 2, // t
  memory: 19456, // m (KiB)
  parallelism: 1, // p
  hashLengthBytes: 32, // dkLen
} as const;

/** PBKDF2 fallback strength mandated by the contract. */
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BYTES = 32;
const PBKDF2_DIGEST = Crypto.CryptoDigestAlgorithm.SHA256;
const SHA256_BLOCK_BYTES = 64; // HMAC block size B
const SHA256_OUTPUT_BYTES = 32; // hLen

// --- Byte + digest primitives (PBKDF2 building blocks) ------------------------
// All pure/local: no network, no persistence. The PIN bytes live only on the JS
// stack for the duration of the derivation and are never logged (PIN-1).

function utf8Bytes(input: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let code = input.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate: combine with the following low surrogate.
      const low = input.charCodeAt(i + 1);
      i += 1;
      code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      out.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(out);
}

function fromHex(hex: string): Uint8Array {
  const length = Math.floor(hex.length / 2);
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** SHA-256 over raw bytes via expo-crypto's native digest (no string mangling). */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await Crypto.digest(PBKDF2_DIGEST, data);
  return new Uint8Array(digest);
}

/** HMAC-SHA256 (RFC 2104) built on the native SHA-256 primitive above. */
async function hmacSha256(
  key: Uint8Array,
  message: Uint8Array,
): Promise<Uint8Array> {
  let blockKey =
    key.length > SHA256_BLOCK_BYTES ? await sha256(key) : key;
  if (blockKey.length < SHA256_BLOCK_BYTES) {
    const padded = new Uint8Array(SHA256_BLOCK_BYTES);
    padded.set(blockKey);
    blockKey = padded;
  }
  const innerPad = new Uint8Array(SHA256_BLOCK_BYTES);
  const outerPad = new Uint8Array(SHA256_BLOCK_BYTES);
  for (let i = 0; i < SHA256_BLOCK_BYTES; i += 1) {
    const k = blockKey[i] ?? 0;
    innerPad[i] = k ^ 0x36;
    outerPad[i] = k ^ 0x5c;
  }
  const inner = await sha256(concatBytes(innerPad, message));
  return sha256(concatBytes(outerPad, inner));
}

/**
 * PBKDF2-HMAC-SHA256 (RFC 8018) over expo-crypto digests.
 *
 * NOTE: each HMAC = 2 native digest calls, so `iterations` × 2 bridge round-trips
 * per derived block — measurable cost at 100k. This is the FALLBACK only; the
 * preferred path is the native Argon2id backend (loadNativeArgon2). Run off any
 * UI-blocking path. dkLen here is 32 → a single block, no concat needed.
 */
async function pbkdf2Sha256(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  keyBytes: number,
): Promise<Uint8Array> {
  const blocks = Math.ceil(keyBytes / SHA256_OUTPUT_BYTES);
  const derived = new Uint8Array(blocks * SHA256_OUTPUT_BYTES);
  for (let blockIndex = 1; blockIndex <= blocks; blockIndex += 1) {
    const blockSuffix = Uint8Array.from([
      (blockIndex >>> 24) & 0xff,
      (blockIndex >>> 16) & 0xff,
      (blockIndex >>> 8) & 0xff,
      blockIndex & 0xff,
    ]);
    let u = await hmacSha256(password, concatBytes(salt, blockSuffix));
    const accumulator = u.slice();
    for (let iteration = 1; iteration < iterations; iteration += 1) {
      u = await hmacSha256(password, u);
      for (let j = 0; j < SHA256_OUTPUT_BYTES; j += 1) {
        accumulator[j] = (accumulator[j] ?? 0) ^ (u[j] ?? 0);
      }
    }
    derived.set(accumulator, (blockIndex - 1) * SHA256_OUTPUT_BYTES);
  }
  return derived.slice(0, keyBytes);
}

/** react-native-argon2 call shape (declared locally; module is optional). */
type NativeArgon2Hash = (
  password: string,
  salt: string,
  config: {
    iterations: number;
    memory: number;
    parallelism: number;
    hashLength: number;
    mode: 'argon2id';
  },
) => Promise<{ readonly rawHash: string; readonly encoded: string }>;

/**
 * Detect the react-native-argon2 native module.
 *
 * SCAFFOLD: returns null (→ PBKDF2 fallback) because react-native-argon2 is a
 * native module absent from the managed/Expo Go workflow; a static import would
 * break the Metro bundle. Next block wires a Metro-safe guarded require behind
 * the custom dev client (expo-dev-client) and returns its default export.
 */
function loadNativeArgon2(): NativeArgon2Hash | null {
  // TODO(next block): guarded optional require under the custom dev client.
  return null;
}

/** Which backend will derive the PIN KEK on this device right now. */
export function getPinKdfBackend(): PinKdfBackend {
  return loadNativeArgon2() !== null ? 'argon2id' : 'pbkdf2-100k';
}

/**
 * Derive the PIN-wrapping KEK (lowercase hex).
 *   • argon2id    → react-native-argon2 with ARGON2_PARAMS (SCAFFOLD: native
 *                   module not yet wired — loadNativeArgon2() returns null).
 *   • pbkdf2-100k → PBKDF2(HMAC-SHA256, 100_000 iters) on expo-crypto digests.
 * The PIN is never logged and never persisted (PIN-1).
 */
export async function derivePinKek(pin: string, saltHex: string): Promise<string> {
  const native = loadNativeArgon2();
  if (native !== null) {
    const { rawHash } = await native(pin, saltHex, {
      iterations: ARGON2_PARAMS.iterations,
      memory: ARGON2_PARAMS.memory,
      parallelism: ARGON2_PARAMS.parallelism,
      hashLength: ARGON2_PARAMS.hashLengthBytes,
      mode: 'argon2id',
    });
    return rawHash;
  }
  // PBKDF2 fallback (expo-crypto). Password = UTF-8(PIN), salt = bytes(saltHex).
  const derived = await pbkdf2Sha256(
    utf8Bytes(pin),
    fromHex(saltHex),
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_BYTES,
  );
  return toHex(derived);
}

// --- PIN enrollment + unlock (envelope owned by keyVault) ---------------------

/**
 * Enroll/replace the PIN fallback. Requires an already-UNLOCKED session so the
 * in-memory DEK can be wrapped. The PIN is never stored — keyVault persists only
 * salt, device-bound pepper, and the AES-GCM envelope (PIN-1). The KDF backend
 * (see derivePinKek) is keyVault's concern next block; today we delegate.
 */
export async function enrollPin(pin: string): Promise<void> {
  await keyVault.enrollPin(pin);
}

/**
 * PIN unlock. The raw PIN is forwarded to keyVault, which runs the KDF, attempts
 * the GCM unwrap, and — crucially — owns the shared FAILURE COUNTER + escalating
 * backoff. We never pre-check or re-count: keyVault returns 'bad_credential' or
 * 'locked_out' (with retryAfterMs) and we surface it.
 *
 * Lockout schedule owned by keyVault.delayForFailures().
 * Terminal wipe at TERMINAL_FAILURE_COUNT (10). See keyVault.ts.
 */
export async function authenticateWithPin(pin: string): Promise<AuthResult> {
  return keyVault.unlockWithPin(pin);
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
 * key material, and no second lockout counter is held in this module.
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
  getPinKdfBackend,
  derivePinKek,
  lock,
} as const;

export default auth;
