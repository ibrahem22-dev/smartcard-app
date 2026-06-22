// /src/security/keyVault.ts
//
// SmartCard — sole owner of the Data Encryption Key (DEK).
// Implements docs/SEC-CONTRACT-001.md (SEC-CONTRACT-001 v1.0).
//
// Invariant (§0): without a fresh biometric/PIN success this session, the only
// thing on disk is ciphertext, and the key that decrypts it is not retrievable.
//
// Nothing outside /src/security/ touches the keychain or the DEK. Callers receive
// an EncryptedStorageHandle (API-1) — never the raw key bytes. There are NO
// network calls in this module by construction (API-3).
//
// PIN KDF (PIN-2/PIN-3, AC-6): Argon2id via @noble/hashes — a pure-JS
// implementation that runs in the Expo SDK 52 managed workflow with no native
// module (react-native-argon2 would violate project Rule 6). RFC 9106 params are
// recorded in KDF_PARAMS and the device-bound pepper is passed as Argon2's
// secret key. Bump KDF_VERSION when params change to re-wrap the PIN envelope.
//
// Required runtime dependencies (all Expo SDK 52 managed-workflow compatible):
//   expo-secure-store        hardware keychain (DEK / salt / pepper / counters)
//   expo-crypto              CSPRNG (getRandomBytesAsync)
//   react-native-mmkv        encrypted at-rest storage, keyed by the DEK
//   @noble/ciphers           AES-256-GCM envelope for the PIN-wrapped DEK (pure JS)
//   @noble/hashes            Argon2id PIN KDF (pure JS)

import { AppState, type AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { MMKV } from 'react-native-mmkv';
import { gcm } from '@noble/ciphers/aes';
import { argon2idAsync } from '@noble/hashes/argon2';

import type { UserProfile } from '../types/user.types';

// --- Public contract (SEC-CONTRACT-001 §8) -----------------------------------

export type UnlockResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'bad_credential' | 'locked_out';
      readonly retryAfterMs?: number;
    };

/**
 * Opaque storage handle returned to callers. Wraps the encrypted MMKV instance;
 * the raw DEK never crosses this boundary (API-1).
 */
export interface EncryptedStorageHandle {
  getString(key: string): string | undefined;
  set(key: string, value: string | number | boolean): void;
  delete(key: string): void;
  getAllKeys(): readonly string[];
  /** Typed convenience accessors for the persisted user profile. */
  getUserProfile(): UserProfile | undefined;
  setUserProfile(profile: UserProfile): void;
}

export interface KeyVault {
  /** Does a DEK exist for this install? (KGET/KGEN idempotency check.) */
  isInitialized(): Promise<boolean>;
  /** KGEN + KWRAP + KVER. Idempotent — safe to call on every cold start. */
  initializeOnFirstLaunch(): Promise<void>;
  unlockWithBiometric(): Promise<UnlockResult>;
  /** PIN-1..PIN-7 enforced here (KDF unwrap + shared-counter lockout). */
  unlockWithPin(pin: string): Promise<UnlockResult>;
  /** Throws while LOCKED. Returns a handle, never the key. */
  getEncryptedStorage(): EncryptedStorageHandle;
  /** ZERO: wipe DEK from memory, drop the MMKV handle. */
  lock(): void;
}

// --- KDF types (project-owned; renamed off the old argon2 interfaces) ----------

interface KdfOptions {
  readonly algorithm: 'Argon2id';
  readonly timeCost: number; // t — iterations (RFC 9106)
  readonly memoryCost: number; // m — KiB
  readonly parallelism: number; // p — lanes
  readonly saltBytes: number;
  readonly keyBytes: number; // dkLen
}

interface KdfResult {
  /** Derived key, lowercase hex (`keyBytes` long). */
  readonly keyHex: string;
}

// --- Versioning & tunables (AC-8: keySchemeVersion + kdfVersion recorded) -----

const KEY_SCHEME_VERSION = 1; // KWRAP-5
const KDF_VERSION = 2; // 2 = Argon2id (1 = pre-prod SHA-256 stretch); bump on change

// PIN-3 starting point: Argon2id m=19 MiB, t=2, p=1, 16-byte salt, 32-byte
// output. Re-tune (and bump KDF_VERSION) toward ~250–500 ms on the target device.
const KDF_PARAMS: KdfOptions = {
  algorithm: 'Argon2id',
  timeCost: 2,
  memoryCost: 19456,
  parallelism: 1,
  saltBytes: 16,
  keyBytes: 32,
};

const DEK_BYTES = 32; // 256-bit (KGEN-1)
const GCM_NONCE_BYTES = 12;

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // SESS-1
const TERMINAL_FAILURE_COUNT = 10; // PIN-6
const MMKV_ID = 'smartcard.secure';
const PROFILE_KEY = 'user.profile';
const KEYCHAIN_SERVICE = 'smartcard.keyvault.v1';

// SecureStore item names.
const SS = {
  dek: 'sc.dek', // DEK, biometric/passcode gated (KWRAP-2)
  pinEnvelope: 'sc.dek.pinEnvelope', // AES-GCM(DEK) under PIN-derived KEK
  pinSalt: 'sc.pin.salt', // KDF salt (PIN-4)
  pinPepper: 'sc.pin.pepper', // AC-1/AC-5 fix: device-bound KDF pepper

  keyScheme: 'sc.keySchemeVersion',
  kdf: 'sc.kdfVersion',
  lockout: 'sc.lockout', // shared failure counter (PIN-5)
} as const;

// KWRAP-2 + KWRAP-3: auth-required + this-device-only. expo-secure-store maps
// requireAuthentication → iOS access-control (biometryCurrentSet, passcode
// fallback) / Android setUserAuthenticationRequired(true); WHEN_UNLOCKED_THIS_
// DEVICE_ONLY blocks iCloud/Android backup sync of the DEK.
const DEK_OPTS: SecureStore.SecureStoreOptions = {
  keychainService: KEYCHAIN_SERVICE,
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  authenticationPrompt: 'Unlock SmartCard',
};

// Non-secret / ciphertext metadata: this-device-only, but no OS auth gate (the
// PIN itself is the gate for the envelope; the envelope is useless ciphertext).
const META_OPTS: SecureStore.SecureStoreOptions = {
  keychainService: KEYCHAIN_SERVICE,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// --- Session memory (MEM-1: DEK lives here ONLY, never persisted in the clear) -

let dek: Uint8Array | null = null;
let storage: MMKV | null = null;
let backgroundedAtMonotonicMs: number | null = null;
// HIGH-03 fix: a wall-clock companion to the monotonic background stamp. The
// monotonic source (performance.now) may not advance while the process is
// suspended in the background, which would fail OPEN (no timeout → stays
// unlocked). Recording Date.now() too lets the resume path take max(deltas).
let backgroundedAtWallMs: number | null = null;
// AC-7: holds the live AppState subscription so the session guard self-wires
// (see module-load call at the bottom) instead of depending on the app shell.
let sessionGuardUnsubscribe: (() => void) | null = null;

interface LockoutState {
  readonly failures: number;
  // HIGH-01 fix: persist the attempt count (the backoff *authority*) plus the
  // last-failure instant in BOTH clocks. The remaining window is derived from
  // `failures` via delayForFailures(), and elapsed time is the MAX of the
  // monotonic and wall-clock deltas — so advancing the device clock cannot skip
  // the lockout, and a frozen/reset monotonic clock cannot suppress it either.
  readonly lastFailureMonotonicMs: number;
  readonly lastFailureWallMs: number;
}

// --- Low-level helpers --------------------------------------------------------

function toHex(bytes: Uint8Array): string {
  // Array.from's map callback yields each byte value directly, so there is no
  // unchecked indexed access (noUncheckedIndexedAccess-safe).
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function randomBytes(n: number): Promise<Uint8Array> {
  // KGEN-1 / PIN-4: platform CSPRNG. No low-entropy / device-derived material.
  return Crypto.getRandomBytesAsync(n);
}

// SESS-2: prefer a monotonic source so wall-clock manipulation can't shrink the
// background timer. Falls back to Date.now() where performance.now is absent.
function monotonicNow(): number {
  const perf = (globalThis as { performance?: { now?: () => number } })
    .performance;
  return perf?.now ? perf.now() : Date.now();
}

// --- KDF + AES-GCM envelope (PIN fallback) ------------------------------------

/**
 * AC-6 (PIN-2/PIN-3): derive the PIN-wrapping KEK with Argon2id — the
 * memory-hard, GPU/ASIC-resistant KDF the contract mandates. Uses the pure-JS
 * @noble/hashes implementation (managed-workflow safe) via its async variant so
 * the JS thread is not blocked for the whole derivation.
 *
 * AC-1/AC-5: the high-entropy, device-bound `pepper` is supplied as Argon2's
 * secret key (`key`) — the canonical pepper slot (RFC 9106). It lives only in
 * the hardware keychain as a this-device-only item (no cloud/Android backup), so
 * the PIN envelope cannot be brute-forced from an exfiltrated backup or a copied
 * (Keystore-encrypted) sandbox: recovery needs a secret that never leaves the
 * device, not just the low-entropy PIN plus a public salt. The PIN is never
 * logged.
 */
async function deriveKek(
  pin: string,
  salt: Uint8Array,
  pepper: Uint8Array,
): Promise<KdfResult> {
  const key = await argon2idAsync(pin, salt, {
    t: KDF_PARAMS.timeCost,
    m: KDF_PARAMS.memoryCost,
    p: KDF_PARAMS.parallelism,
    dkLen: KDF_PARAMS.keyBytes,
    key: pepper, // Argon2 secret ("pepper"): device-bound, never in backups
    asyncTick: 16, // yield to the JS thread periodically during derivation
  });
  return { keyHex: toHex(key) };
}

async function wrapDek(dekBytes: Uint8Array, kek: Uint8Array): Promise<string> {
  const nonce = await randomBytes(GCM_NONCE_BYTES);
  const ciphertext = gcm(kek, nonce).encrypt(dekBytes);
  return `${toHex(nonce)}:${toHex(ciphertext)}`;
}

// Throws if the GCM auth tag fails → wrong PIN (no plaintext-comparable verifier
// is ever stored; the unwrap itself is the verification — PIN-1).
function unwrapDek(envelope: string, kek: Uint8Array): Uint8Array {
  const sep = envelope.indexOf(':');
  const nonce = fromHex(envelope.slice(0, sep));
  const ciphertext = fromHex(envelope.slice(sep + 1));
  return gcm(kek, nonce).decrypt(ciphertext);
}

// --- Lockout (PIN-5 shared counter, PIN-6 terminal action) --------------------

async function readLockout(): Promise<LockoutState> {
  const raw = await SecureStore.getItemAsync(SS.lockout, META_OPTS);
  if (raw === null) {
    return { failures: 0, lastFailureMonotonicMs: 0, lastFailureWallMs: 0 };
  }
  return JSON.parse(raw) as LockoutState;
}

async function writeLockout(state: LockoutState): Promise<void> {
  await SecureStore.setItemAsync(SS.lockout, JSON.stringify(state), META_OPTS);
}

// Escalating backoff from §6. Persisted in the keychain so it survives restart
// and is NOT resettable by switching biometric↔PIN (one shared counter).
function delayForFailures(failures: number): number {
  switch (failures) {
    case 5:
      return 30 * 1000;
    case 6:
      return 60 * 1000;
    case 7:
      return 5 * 60 * 1000;
    case 8:
      return 15 * 60 * 1000;
    case 9:
      return 60 * 60 * 1000;
    default:
      return 0; // 1–4: allowed, no delay
  }
}

/** Returns a locked_out result if a backoff window is active, else null. */
async function activeLockout(): Promise<
  Extract<UnlockResult, { ok: false }> | null
> {
  const { failures, lastFailureMonotonicMs, lastFailureWallMs } =
    await readLockout();
  // HIGH-01 fix: the backoff duration comes from the persisted *count*, not from
  // a stored "unlock at" wall-clock deadline an attacker could outrun by setting
  // the clock forward. Elapsed time is the MIN of the monotonic and wall-clock
  // deltas, clamped to >= 0: for lockout we must UNDERESTIMATE elapsed (err toward
  // staying locked). min() means a forward wall-clock jump cannot outrun the
  // (un-jumpable) monotonic delta to skip the window; max(0, ...) clamps the
  // negative delta a monotonic reset (e.g. across a restart) would produce.
  const requiredDelayMs = delayForFailures(failures);
  if (requiredDelayMs <= 0) {
    return null;
  }
  const monotonicDelta = monotonicNow() - lastFailureMonotonicMs;
  const wallClockDelta = Date.now() - lastFailureWallMs;
  const elapsed = Math.max(0, Math.min(monotonicDelta, wallClockDelta));
  const remaining = requiredDelayMs - elapsed;
  if (remaining > 0) {
    return { ok: false, reason: 'locked_out', retryAfterMs: remaining };
  }
  return null;
}

/** Records a failed attempt, applying backoff or the terminal action. */
async function recordFailure(): Promise<Extract<UnlockResult, { ok: false }>> {
  const prev = await readLockout();
  const failures = prev.failures + 1;

  if (failures >= TERMINAL_FAILURE_COUNT) {
    // PIN-6 terminal action: destroy the DEK → on-disk ciphertext is now
    // permanently unrecoverable. Stronger than an app-level extended lock.
    await wipeVault();
    return { ok: false, reason: 'locked_out' };
  }

  const delay = delayForFailures(failures);
  // Stamp the failure instant in BOTH clocks; activeLockout() derives the window
  // from `failures` and measures elapsed time as max(monotonic, wall) (HIGH-01).
  await writeLockout({
    failures,
    lastFailureMonotonicMs: monotonicNow(),
    lastFailureWallMs: Date.now(),
  });
  return delay > 0
    ? { ok: false, reason: 'locked_out', retryAfterMs: delay }
    : { ok: false, reason: 'bad_credential' };
}

async function resetFailures(): Promise<void> {
  await writeLockout({
    failures: 0,
    lastFailureMonotonicMs: 0,
    lastFailureWallMs: 0,
  });
}

// --- Core key lifecycle -------------------------------------------------------

// AC-1 fix: react-native-mmkv (v3, AES-128) THROWS when encryptionKey is longer
// than 16 bytes, and the key is bridged to native as UTF-8. A 64-char hex DEK
// therefore both overflows the 16-byte limit (runtime crash) and, if capped,
// collapses to ~64-bit entropy. Map the first 16 DEK bytes into the single-byte
// UTF-8 range (0x01..0x7F) so the key crosses the JS→native bridge intact at
// exactly 16 bytes — NUL-free, no length overflow, ~112-bit effective key (the
// practical ceiling for an AES-128 key delivered over a UTF-8 string).
function deriveMmkvKey(dekBytes: Uint8Array): string {
  return Array.from(dekBytes.subarray(0, 16), (b) =>
    String.fromCharCode(1 + (b % 0x7f)),
  ).join('');
}

function openStorage(dekBytes: Uint8Array): MMKV {
  // KGET-2: MMKV is opened ONLY here, with the retrieved DEK as its key.
  return new MMKV({ id: MMKV_ID, encryptionKey: deriveMmkvKey(dekBytes) });
}

function enterUnlocked(dekBytes: Uint8Array): void {
  dek = dekBytes;
  storage = openStorage(dekBytes);
}

async function isInitialized(): Promise<boolean> {
  // keySchemeVersion is the non-auth marker, so this never triggers a biometric
  // prompt just to answer "is there a key?".
  const scheme = await SecureStore.getItemAsync(SS.keyScheme, META_OPTS);
  return scheme !== null;
}

async function initializeOnFirstLaunch(): Promise<void> {
  if (await isInitialized()) {
    return; // KGEN-3: generated exactly once per install; idempotent thereafter.
  }
  const fresh = await randomBytes(DEK_BYTES);
  // KWRAP-1/2/3: DEK into the hardware keychain under auth-required flags.
  await SecureStore.setItemAsync(SS.dek, toHex(fresh), DEK_OPTS);
  // KVER / KWRAP-5: record scheme + KDF versions for future migration.
  await SecureStore.setItemAsync(
    SS.keyScheme,
    String(KEY_SCHEME_VERSION),
    META_OPTS,
  );
  await SecureStore.setItemAsync(SS.kdf, String(KDF_VERSION), META_OPTS);
}

/**
 * Enroll/replace the PIN fallback. Requires an already-UNLOCKED session so the
 * in-memory DEK can be wrapped under a fresh KDF-derived key. The PIN is never
 * stored — only its salt and the AES-GCM-wrapped DEK envelope (PIN-1). Not part
 * of the §8 interface but required so unlockWithPin has something to unwrap;
 * callers run this once during onboarding (after the first unlock).
 */
async function enrollPin(pin: string): Promise<void> {
  if (dek === null) {
    throw new Error('enrollPin requires an unlocked vault.');
  }
  const salt = await randomBytes(KDF_PARAMS.saltBytes);
  const pepper = await randomBytes(KDF_PARAMS.saltBytes); // device-bound secret
  await SecureStore.setItemAsync(SS.pinSalt, toHex(salt), META_OPTS); // PIN-4
  await SecureStore.setItemAsync(SS.pinPepper, toHex(pepper), META_OPTS);
  const { keyHex } = await deriveKek(pin, salt, pepper);
  const kek = fromHex(keyHex);
  const envelope = await wrapDek(dek, kek);
  kek.fill(0);
  pepper.fill(0);
  await SecureStore.setItemAsync(SS.pinEnvelope, envelope, META_OPTS);
}

// AC-5 fix: classify the OS-lockout case so it can be surfaced accurately. A
// biometric prompt can reject for reasons that are NOT a credential attempt
// (user cancel/dismiss, timeout, no enrollment, hardware unavailable) and also
// when the OS has locked out biometry after too many real failures. We only
// need to tell the lockout case apart; none of these advance the wipe counter.
function isBiometricLockout(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  return (
    message.includes('lockout') ||
    message.includes('too many') ||
    message.includes('biometric_error_lockout')
  );
}

async function unlockWithBiometric(): Promise<UnlockResult> {
  // Shared-lockout pre-check stays: a PIN-induced lockout window also blocks the
  // biometric path, so an attacker cannot switch methods to evade it (PIN-5).
  const blocked = await activeLockout();
  if (blocked !== null) {
    return blocked;
  }
  try {
    // KGET-1: the OS biometric/passcode prompt (from DEK_OPTS.requireAuthentication)
    // is the gate — not an app boolean.
    const hex = await SecureStore.getItemAsync(SS.dek, DEK_OPTS);
    if (hex === null) {
      // No DEK for this install, or the key was invalidated by a biometric
      // enrollment change (SESS-4). Neither is a failed credential attempt, so
      // it MUST NOT advance the data-wipe counter (AC-5).
      return { ok: false, reason: 'bad_credential' };
    }
    enterUnlocked(fromHex(hex)); // BIND-1: auth success is what unwraps the DEK.
    await resetFailures();
    return { ok: true };
  } catch (error) {
    // AC-5 fix: a biometric prompt rejection (cancel/dismiss/timeout/unavailable
    // or OS lockout) MUST NOT advance the data-wipe counter — the hardware
    // keychain already throttles biometric brute-force (KWRAP-2); the app
    // counter tracks the in-app PIN path only. No DEK material is logged
    // (MEM-1 / AC-3). recordFailure() is deliberately NOT called here.
    return isBiometricLockout(error)
      ? { ok: false, reason: 'locked_out' }
      : { ok: false, reason: 'bad_credential' };
  }
}

async function unlockWithPin(pin: string): Promise<UnlockResult> {
  const blocked = await activeLockout();
  if (blocked !== null) {
    return blocked;
  }
  const [saltHex, envelope, pepperHex] = await Promise.all([
    SecureStore.getItemAsync(SS.pinSalt, META_OPTS),
    SecureStore.getItemAsync(SS.pinEnvelope, META_OPTS),
    SecureStore.getItemAsync(SS.pinPepper, META_OPTS),
  ]);
  if (saltHex === null || envelope === null || pepperHex === null) {
    return recordFailure(); // PIN not enrolled (or pepper missing/tampered).
  }
  const { keyHex } = await deriveKek(
    pin,
    fromHex(saltHex),
    fromHex(pepperHex),
  ); // KDF stretch, device-bound pepper
  const kek = fromHex(keyHex);
  try {
    const unwrapped = unwrapDek(envelope, kek); // throws on wrong PIN
    kek.fill(0);
    // PIN-7: PIN yields the same DEK as biometric — equal scope, no backdoor.
    enterUnlocked(unwrapped);
    await resetFailures();
    return { ok: true };
  } catch {
    kek.fill(0);
    return recordFailure(); // shared counter (PIN-5)
  }
}

function getEncryptedStorage(): EncryptedStorageHandle {
  if (storage === null || dek === null) {
    throw new Error('KeyVault is LOCKED — unlock before accessing storage.');
  }
  const mmkv = storage;
  return {
    getString: (key) => mmkv.getString(key),
    set: (key, value) => mmkv.set(key, value),
    delete: (key) => mmkv.delete(key),
    getAllKeys: () => mmkv.getAllKeys(),
    getUserProfile: () => {
      const raw = mmkv.getString(PROFILE_KEY);
      return raw === undefined ? undefined : (JSON.parse(raw) as UserProfile);
    },
    setUserProfile: (profile) => mmkv.set(PROFILE_KEY, JSON.stringify(profile)),
  };
}

function lock(): void {
  // ZERO-1: clear the KEY (not just a flag). Overwrite the DEK bytes so the
  // secret is gone from JS memory, then drop the only JS handle to the MMKV
  // instance — the on-disk data stays encrypted and is unreadable until the
  // next auth re-supplies the DEK.
  //
  // LIMITATION: react-native-mmkv v3 exposes no close()/clearMemoryCache() (the
  // surface is set/get*/contains/delete/getAllKeys/clearAll/recrypt/trim only),
  // and the native core caches one decrypted instance per id. So we cannot evict
  // the already-decrypted mmap from native memory; it is reclaimed on process
  // death. Zeroing the DEK + dropping the handle is the strongest eviction the
  // managed-workflow library allows, and getEncryptedStorage() hard-refuses all
  // access once `storage`/`dek` are null, so no plaintext is reachable post-lock.
  if (dek !== null) {
    dek.fill(0);
    dek = null;
  }
  storage = null;
}

/**
 * PIN-6 terminal action. Destroying the DEK (and its PIN envelope) renders the
 * MMKV ciphertext permanently unrecoverable.
 */
async function wipeVault(): Promise<void> {
  lock();
  await Promise.all([
    SecureStore.deleteItemAsync(SS.dek, DEK_OPTS).catch(() => undefined),
    SecureStore.deleteItemAsync(SS.pinEnvelope, META_OPTS).catch(
      () => undefined,
    ),
    SecureStore.deleteItemAsync(SS.pinSalt, META_OPTS).catch(() => undefined),
    SecureStore.deleteItemAsync(SS.pinPepper, META_OPTS).catch(() => undefined),
    SecureStore.deleteItemAsync(SS.keyScheme, META_OPTS).catch(() => undefined),
    SecureStore.deleteItemAsync(SS.kdf, META_OPTS).catch(() => undefined),
    SecureStore.deleteItemAsync(SS.lockout, META_OPTS).catch(() => undefined),
  ]);
}

/**
 * SESS-1/SESS-2/ZERO-1: AppState guard. On backgrounding, stamp a monotonic
 * timestamp; on foreground, if > 5 min elapsed, run ZERO (wipe in-memory DEK,
 * drop MMKV) so a re-auth is forced. Returns an unsubscribe fn.
 *
 * AC-7: this guard self-wires at module load (see the call at the bottom of the
 * file), so the 5-minute timeout no longer depends on the app shell remembering
 * to call it. The call is idempotent — invoking it again (e.g. from a test or
 * the app shell) returns the existing unsubscribe instead of double-registering.
 *
 * NOTE: the privacy/blur overlay for the app-switcher snapshot (SESS-3 / AC-7)
 * is the one remaining piece that CANNOT live here — it is a React render (plus,
 * on iOS, a native overlay window) and must be owned by the app shell. This
 * module owns all of the non-UI session/zeroization logic.
 */
function startSessionGuard(): () => void {
  if (sessionGuardUnsubscribe !== null) {
    return sessionGuardUnsubscribe;
  }
  const subscription = AppState.addEventListener(
    'change',
    (next: AppStateStatus) => {
      if (next === 'active') {
        // HIGH-03 fix: take the LARGER of the two elapsed measurements. The
        // monotonic delta defends against wall-clock manipulation; the
        // wall-clock delta defends against a monotonic clock that was frozen
        // during background suspension (the fail-open case). If either says we
        // exceeded the timeout, ZERO the session and force a re-auth.
        if (
          backgroundedAtMonotonicMs !== null &&
          backgroundedAtWallMs !== null
        ) {
          const monotonicDelta = monotonicNow() - backgroundedAtMonotonicMs;
          const wallClockDelta = Date.now() - backgroundedAtWallMs;
          if (Math.max(monotonicDelta, wallClockDelta) > SESSION_TIMEOUT_MS) {
            lock();
          }
        }
        backgroundedAtMonotonicMs = null;
        backgroundedAtWallMs = null;
      } else {
        backgroundedAtMonotonicMs = monotonicNow();
        backgroundedAtWallMs = Date.now();
      }
    },
  );
  sessionGuardUnsubscribe = () => {
    subscription.remove();
    sessionGuardUnsubscribe = null;
  };
  return sessionGuardUnsubscribe;
}

// --- AC-4 / BIND-3: cold-start & deep-link routing gate -----------------------
//
// AC-4 must not hang on the navigation layer "remembering" to check auth before
// it mounts a financial route. keyVault is the §8 sole authority on the
// LOCKED/UNLOCKED state, so the routing decision originates HERE: a deep link or
// OS-restoration target that arrives while LOCKED is *captured* (held in memory,
// never auto-followed) and only released after a real unlock. The navigation
// layer becomes a thin consumer — it asks canMountSecureNavigator() and replays
// consumePendingDeepLink() post-auth — instead of re-deriving the security rule.

let pendingDeepLink: string | null = null;

/**
 * BIND-3 / BIND-4: the single source of truth for whether the authenticated
 * (financial) navigator may mount. True only when a DEK is in memory AND MMKV is
 * open — exactly the UNLOCKED condition — so the navigator and the key can never
 * diverge. The router MUST gate on this rather than an app-level boolean.
 */
function canMountSecureNavigator(): boolean {
  return dek !== null && storage !== null;
}

/**
 * AC-4 / BIND-3: register a cold-start or runtime deep link. While LOCKED the
 * link is only *remembered*, never resolved, so a deep link into a financial
 * route cannot bypass auth — routing stays on LOCKED until a real unlock. Report
 * whether the link was deferred (LOCKED) vs. safe to follow now (already
 * UNLOCKED), so the caller never navigates into protected UI ahead of the key.
 */
function captureDeepLink(url: string | null): { readonly deferred: boolean } {
  if (url === null || canMountSecureNavigator()) {
    return { deferred: false };
  }
  pendingDeepLink = url;
  return { deferred: true };
}

/**
 * AC-4: after a successful unlock the router calls this once to retrieve and
 * clear any link it was forced to defer, then navigates to it INSIDE the now-
 * mounted authenticated navigator. Returns null when nothing was deferred.
 */
function consumePendingDeepLink(): string | null {
  const url = pendingDeepLink;
  pendingDeepLink = null;
  return url;
}

// --- Backward-compatible auth surface -----------------------------------------
//
// The navigation layer (authContext/AuthGate, ref STR-H01) consumes a tri-state
// status plus unlock/lock. Kept here so that layer compiles and continues to use
// REAL auth — `unlock` delegates to the biometric path (no debug backdoor; BIND-1
// holds). Migrate the navigation to the §8 methods, then remove this block.

export type AuthStatus = 'LOCKED' | 'UNLOCKED' | 'UNKNOWN';

interface KeyVaultModule extends KeyVault {
  enrollPin(pin: string): Promise<void>;
  wipeVault(): Promise<void>;
  startSessionGuard(): () => void;
  isUnlocked(): boolean;
  getAuthStatus(): Promise<AuthStatus>;
  unlock(): Promise<void>;
  // AC-4 / BIND-3 routing gate (security module is the routing authority).
  canMountSecureNavigator(): boolean;
  captureDeepLink(url: string | null): { readonly deferred: boolean };
  consumePendingDeepLink(): string | null;
}

export const keyVault: KeyVaultModule = {
  isInitialized,
  initializeOnFirstLaunch,
  unlockWithBiometric,
  unlockWithPin,
  getEncryptedStorage,
  lock,
  enrollPin,
  wipeVault,
  startSessionGuard,
  canMountSecureNavigator,
  captureDeepLink,
  consumePendingDeepLink,
  isUnlocked: () => dek !== null && storage !== null,
  async getAuthStatus() {
    return dek !== null && storage !== null ? 'UNLOCKED' : 'LOCKED';
  },
  async unlock() {
    await unlockWithBiometric();
  },
};

// AC-7: self-wire the session/zeroization guard on import so the inactivity
// timeout is active regardless of whether the app shell calls it. Idempotent, so
// an explicit keyVault.startSessionGuard() elsewhere is still safe.
startSessionGuard();
