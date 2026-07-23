// /src/security/keyVault.ts
//
// SmartCard ظ¤ sole owner of the Data Encryption Key (DEK).
// Implements docs/SEC-CONTRACT-001.md (SEC-CONTRACT-001 v1.0).
//
// Invariant (┬د0): without a fresh biometric/PIN success this session, the only
// thing on disk is ciphertext, and the key that decrypts it is not retrievable.
//
// Nothing outside /src/security/ touches the keychain or the DEK. Callers receive
// an EncryptedStorageHandle (API-1) ظ¤ never the raw key bytes. There are NO
// network calls in this module by construction (API-3).
//
// PIN KDF (PIN-2/PIN-3, AC-6): Argon2id via @noble/hashes ظ¤ a pure-JS
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

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { MMKV } from 'react-native-mmkv';
import { gcm } from '@noble/ciphers/aes';
import { argon2idAsync } from '@noble/hashes/argon2';

import type { UserProfile } from '../types/user.types';
import { MMKV_KEYS } from '../store/keys';
import type { LockoutCaller, LockoutState } from './keyVault.types';

// --- Public contract (SEC-CONTRACT-001 ┬د8) -----------------------------------

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
  /** Does a complete PIN-enrolled local vault exist for this install? */
  isInitialized(): Promise<boolean>;
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
  readonly timeCost: number; // t ظ¤ iterations (RFC 9106)
  readonly memoryCost: number; // m ظ¤ KiB
  readonly parallelism: number; // p ظ¤ lanes
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
// output. Re-tune (and bump KDF_VERSION) toward ~250ظô500 ms on the target device.
const KDF_PARAMS: KdfOptions = {
  algorithm: 'Argon2id',
  timeCost: 2,
  memoryCost: 19456,
  parallelism: 1,
  saltBytes: 16,
  keyBytes: 32,
};

const TRANSFER_ENVELOPE_VERSION = 1;
const TRANSFER_SALT_BYTES = 16;
const TRANSFER_NONCE_BYTES = 12;
const TRANSFER_KEY_BYTES = 32;
const TRANSFER_TAG_BYTES = 16;
const MAX_TRANSFER_PAYLOAD_BYTES = 65_536;
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const block = (first << 16) | (second << 8) | third;
    output += BASE64_ALPHABET[(block >>> 18) & 63] ?? '';
    output += BASE64_ALPHABET[(block >>> 12) & 63] ?? '';
    output +=
      index + 1 < bytes.length
        ? BASE64_ALPHABET[(block >>> 6) & 63] ?? ''
        : '=';
    output +=
      index + 2 < bytes.length ? BASE64_ALPHABET[block & 63] ?? '' : '=';
  }
  return output;
}

function base64ToBytes(value: string): Uint8Array {
  if (
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error('INVALID_TRANSFER_PAYLOAD');
  }

  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const output = new Uint8Array((value.length / 4) * 3 - padding);
  let outputIndex = 0;

  for (let index = 0; index < value.length; index += 4) {
    const chars = value.slice(index, index + 4);
    const values = chars.split('').map((char: string): number =>
      char === '=' ? 0 : BASE64_ALPHABET.indexOf(char),
    );
    const first = values[0] ?? 0;
    const second = values[1] ?? 0;
    const third = values[2] ?? 0;
    const fourth = values[3] ?? 0;
    const block = (first << 18) | (second << 12) | (third << 6) | fourth;

    if (outputIndex < output.length) {
      output[outputIndex] = (block >>> 16) & 255;
      outputIndex += 1;
    }
    if (outputIndex < output.length) {
      output[outputIndex] = (block >>> 8) & 255;
      outputIndex += 1;
    }
    if (outputIndex < output.length) {
      output[outputIndex] = block & 255;
      outputIndex += 1;
    }
  }

  return output;
}

async function deriveTransferKey(
  transferPin: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  if (!/^\d{4}$/.test(transferPin)) {
    throw new Error('INVALID_TRANSFER_PIN');
  }

  return new Uint8Array(
    await argon2idAsync(transferPin, salt, {
      t: 2,
      m: 19 * 1024,
      p: 1,
      dkLen: TRANSFER_KEY_BYTES,
      asyncTick: 16,
    }),
  );
}

export async function encryptProfileTransferPayload(
  plaintext: string,
  transferPin: string,
): Promise<string> {
  const salt = await randomBytes(TRANSFER_SALT_BYTES);
  const nonce = await randomBytes(TRANSFER_NONCE_BYTES);
  const key = await deriveTransferKey(transferPin, salt);
  const ciphertext = gcm(key, nonce).encrypt(
    new TextEncoder().encode(plaintext),
  );
  const envelope = new Uint8Array(
    1 + salt.length + nonce.length + ciphertext.length,
  );
  envelope[0] = TRANSFER_ENVELOPE_VERSION;
  envelope.set(salt, 1);
  envelope.set(nonce, 1 + salt.length);
  envelope.set(ciphertext, 1 + salt.length + nonce.length);
  key.fill(0);

  return bytesToBase64(envelope);
}

export async function decryptProfileTransferPayload(
  encodedPayload: string,
  transferPin: string,
): Promise<string> {
  if (encodedPayload.length > MAX_TRANSFER_PAYLOAD_BYTES) {
    throw {
      type: 'PAYLOAD_TOO_LARGE',
      maxBytes: MAX_TRANSFER_PAYLOAD_BYTES,
    } as const;
  }

  const envelope = base64ToBytes(encodedPayload);
  const minimumLength =
    1 + TRANSFER_SALT_BYTES + TRANSFER_NONCE_BYTES + TRANSFER_TAG_BYTES;
  if (
    envelope.length < minimumLength ||
    envelope[0] !== TRANSFER_ENVELOPE_VERSION
  ) {
    throw new Error('INVALID_TRANSFER_PAYLOAD');
  }

  const salt = envelope.slice(1, 1 + TRANSFER_SALT_BYTES);
  const nonce = envelope.slice(
    1 + TRANSFER_SALT_BYTES,
    1 + TRANSFER_SALT_BYTES + TRANSFER_NONCE_BYTES,
  );
  const ciphertext = envelope.slice(
    1 + TRANSFER_SALT_BYTES + TRANSFER_NONCE_BYTES,
  );
  const key = await deriveTransferKey(transferPin, salt);
  const plaintext = gcm(key, nonce).decrypt(ciphertext);
  key.fill(0);

  return new TextDecoder().decode(plaintext);
}

export function createSecureProfileId(): string {
  return Crypto.randomUUID();
}

const DEK_BYTES = 32; // 256-bit (KGEN-1)
const GCM_NONCE_BYTES = 12;

const MAX_BACKOFF_FAILURES = 9;
const PROFILE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MMKV_ID = 'smartcard.secure';
// CONFLICT: These legacy typed accessors retain their historical global key,
// but the task forbids modifying existing keyVault behavior. Financial stores
// no longer call them and use profile-scoped keys exclusively.
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
  wipePending: 'sc.wipePending', // fail-closed reset marker
  setupPending: 'sc.setupPending', // fail-closed first-PIN setup marker
} as const;

// KWRAP-2 + KWRAP-3: auth-required + this-device-only. expo-secure-store maps
// requireAuthentication ظْ iOS access-control (biometryCurrentSet, passcode
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

const VAULT_METADATA_ITEMS = [
  [SS.pinEnvelope, META_OPTS],
  [SS.pinSalt, META_OPTS],
  [SS.pinPepper, META_OPTS],
  [SS.keyScheme, META_OPTS],
  [SS.kdf, META_OPTS],
] as const;

const VAULT_WIPE_ITEMS = [
  [SS.dek, DEK_OPTS],
  ...VAULT_METADATA_ITEMS,
  [SS.lockout, META_OPTS],
  [SS.setupPending, META_OPTS],
] as const;

// --- Session memory (MEM-1: DEK lives here ONLY, never persisted in the clear) -

let dek: Uint8Array | null = null;
let storage: MMKV | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function normalizeClearFailures(failures: number): 0 | 1 | 2 | 3 | 4 {
  if (failures <= 0) return 0;
  if (failures === 1) return 1;
  if (failures === 2) return 2;
  if (failures === 3) return 3;
  return 4;
}

function normalizeBackoffFailures(failures: number): 5 | 6 | 7 | 8 | 9 {
  if (failures <= 5) return 5;
  if (failures === 6) return 6;
  if (failures === 7) return 7;
  if (failures === 8) return 8;
  return 9;
}

function parseLockoutState(raw: string | null): LockoutState {
  if (raw === null) {
    return {
      tier: 'clear',
      failures: 0,
      lastFailureMonotonicMs: 0,
      lastFailureWallMs: 0,
      lockedUntilMs: 0,
      isTerminalLock: false,
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {
        tier: 'clear',
        failures: 0,
        lastFailureMonotonicMs: 0,
        lastFailureWallMs: 0,
        lockedUntilMs: 0,
        isTerminalLock: false,
      };
    }

    const failures = toFiniteNumber(parsed.failures);
    const lastFailureMonotonicMs = toFiniteNumber(parsed.lastFailureMonotonicMs);
    const lastFailureWallMs = toFiniteNumber(parsed.lastFailureWallMs);
    const lockedUntilMs = toFiniteNumber(parsed.lockedUntilMs);
    const isTerminalLock = parsed.isTerminalLock === true;

    if (
      failures === null ||
      lastFailureMonotonicMs === null ||
      lastFailureWallMs === null
    ) {
      return {
        tier: 'clear',
        failures: 0,
        lastFailureMonotonicMs: 0,
        lastFailureWallMs: 0,
        lockedUntilMs: 0,
        isTerminalLock: false,
      };
    }

    if (isTerminalLock) {
      return {
        tier: 'backoff',
        failures: 9,
        lastFailureMonotonicMs,
        lastFailureWallMs,
        lockedUntilMs: 0,
        isTerminalLock: false,
      };
    }

    if (failures >= 5) {
      return {
        tier: 'backoff',
        failures: normalizeBackoffFailures(failures),
        lastFailureMonotonicMs,
        lastFailureWallMs,
        lockedUntilMs: 0,
        isTerminalLock: false,
      };
    }

    return {
      tier: 'clear',
      failures: normalizeClearFailures(failures),
      lastFailureMonotonicMs,
      lastFailureWallMs,
      lockedUntilMs: 0,
      isTerminalLock: false,
    };
  } catch {
    return {
      tier: 'clear',
      failures: 0,
      lastFailureMonotonicMs: 0,
      lastFailureWallMs: 0,
      lockedUntilMs: 0,
      isTerminalLock: false,
    };
  }
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
 * AC-6 (PIN-2/PIN-3): derive the PIN-wrapping KEK with Argon2id ظ¤ the
 * memory-hard, GPU/ASIC-resistant KDF the contract mandates. Uses the pure-JS
 * @noble/hashes implementation (managed-workflow safe) via its async variant so
 * the JS thread is not blocked for the whole derivation.
 *
 * AC-1/AC-5: the high-entropy, device-bound `pepper` is supplied as Argon2's
 * secret key (`key`) ظ¤ the canonical pepper slot (RFC 9106). It lives only in
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

// Throws if the GCM auth tag fails ظْ wrong PIN (no plaintext-comparable verifier
// is ever stored; the unwrap itself is the verification ظ¤ PIN-1).
function unwrapDek(envelope: string, kek: Uint8Array): Uint8Array {
  const sep = envelope.indexOf(':');
  const nonce = fromHex(envelope.slice(0, sep));
  const ciphertext = fromHex(envelope.slice(sep + 1));
  return gcm(kek, nonce).decrypt(ciphertext);
}

// --- Lockout (PIN-5 shared counter, PIN-6 terminal action) --------------------

async function readLockout(): Promise<LockoutState> {
  const raw = await SecureStore.getItemAsync(SS.lockout, META_OPTS);
  return parseLockoutState(raw);
}

async function writeLockout(state: LockoutState): Promise<void> {
  await SecureStore.setItemAsync(SS.lockout, JSON.stringify(state), META_OPTS);
}

// Escalating backoff from ┬د6. Persisted in the keychain so it survives restart
// and is NOT resettable by switching biometricظ¤PIN (one shared counter).
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
      return 0; // 1ظô4: allowed, no delay
  }
}

/** Returns a locked_out result if a backoff window is active, else null. */
async function activeLockout(caller: LockoutCaller): Promise<
  Extract<UnlockResult, { ok: false }> | null
> {
  const lockoutState = await readLockout();

  if (lockoutState.isTerminalLock) {
    return { ok: false, reason: 'locked_out', retryAfterMs: delayForFailures(9) };
  }

  const { failures, lastFailureMonotonicMs, lastFailureWallMs } = lockoutState;
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

/** Records a failed attempt, applying temporary escalating backoff only. */
async function recordFailure(): Promise<Extract<UnlockResult, { ok: false }>> {
  const prev = await readLockout();
  const failures = Math.min(prev.failures + 1, MAX_BACKOFF_FAILURES);

  const delay = delayForFailures(failures);
  // Stamp the failure instant in BOTH clocks; activeLockout() derives the window
  // Elapsed = max(0, min(monotonicNow()-lastFailureMonotonicMs, Date.now()-lastFailureWallMs))
  // min(monotonic, wall): attacker's forward clock-set yields the smaller monotonic value.
  // max(0, ...): clamps negative elapsed on rollback. (HIGH-01)
  await writeLockout(
    failures >= 5
      ? {
          tier: 'backoff',
          failures: normalizeBackoffFailures(failures),
          lastFailureMonotonicMs: monotonicNow(),
          lastFailureWallMs: Date.now(),
          lockedUntilMs: 0,
          isTerminalLock: false,
        }
      : {
          tier: 'clear',
          failures: normalizeClearFailures(failures),
          lastFailureMonotonicMs: monotonicNow(),
          lastFailureWallMs: Date.now(),
          lockedUntilMs: 0,
          isTerminalLock: false,
        },
  );
  return delay > 0
    ? { ok: false, reason: 'locked_out', retryAfterMs: delay }
    : { ok: false, reason: 'bad_credential' };
}

async function resetFailures(): Promise<void> {
  await writeLockout({
    tier: 'clear',
    failures: 0,
    lastFailureMonotonicMs: 0,
    lastFailureWallMs: 0,
    lockedUntilMs: 0,
    isTerminalLock: false,
  });
}

// --- Core key lifecycle -------------------------------------------------------

// AC-1 fix: react-native-mmkv (v3, AES-128) THROWS when encryptionKey is longer
// than 16 bytes, and the key is bridged to native as UTF-8. A 64-char hex DEK
// therefore both overflows the 16-byte limit (runtime crash) and, if capped,
// collapses to ~64-bit entropy. Map the first 16 DEK bytes into the single-byte
// UTF-8 range (0x01..0x7F) so the key crosses the JSظْnative bridge intact at
// exactly 16 bytes ظ¤ NUL-free, no length overflow, ~112-bit effective key (the
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
  // Never query the authentication-gated DEK here. A vault is only considered
  // initialized after the complete non-secret PIN credential metadata exists.
  const [wipePending, setupPending, ...metadata] = await Promise.all([
    SecureStore.getItemAsync(SS.wipePending, META_OPTS),
    SecureStore.getItemAsync(SS.setupPending, META_OPTS),
    ...VAULT_METADATA_ITEMS.map(([key, options]) =>
      SecureStore.getItemAsync(key, options),
    ),
  ]);
  return (
    wipePending !== null ||
    setupPending !== null ||
    metadata.every(value => value !== null)
  );
}

async function hasCompleteVaultMetadata(): Promise<boolean> {
  const metadata = await Promise.all(
    VAULT_METADATA_ITEMS.map(([key, options]) =>
      SecureStore.getItemAsync(key, options),
    ),
  );
  return metadata.every(value => value !== null);
}

function isSixDigitPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

async function deleteVaultMaterialAndVerify(): Promise<void> {
  await Promise.all(
    VAULT_WIPE_ITEMS.map(([key, options]) =>
      SecureStore.deleteItemAsync(key, options),
    ),
  );

  const remaining = await Promise.all(
    VAULT_WIPE_ITEMS.map(([key, options]) =>
      SecureStore.getItemAsync(key, options),
    ),
  );
  if (remaining.some(value => value !== null)) {
    throw new Error('LOCAL_VAULT_WIPE_VERIFICATION_FAILED');
  }
}

async function initializeLocalVaultWithPin(pin: string): Promise<void> {
  if (!isSixDigitPin(pin)) {
    throw new Error('PIN_SETUP_REQUIRES_SIX_DIGITS');
  }

  if (dek !== null) {
    await enrollPin(pin);
    await resetFailures();
    return;
  }

  if (await isInitialized()) {
    throw new Error('PIN setup requires an unlocked local vault.');
  }

  const fresh = await randomBytes(DEK_BYTES);
  let setupPepper: Uint8Array | null = null;
  try {
    const salt = await randomBytes(KDF_PARAMS.saltBytes);
    setupPepper = await randomBytes(KDF_PARAMS.saltBytes);
    const { keyHex } = await deriveKek(pin, salt, setupPepper);
    const kek = fromHex(keyHex);
    const envelope = await wrapDek(fresh, kek);
    const pepperHex = toHex(setupPepper);
    kek.fill(0);

    // A pending marker makes an interrupted first setup a locked, explicit
    // reset state instead of an apparently fresh or partially initialized vault.
    await SecureStore.setItemAsync(SS.setupPending, '1', META_OPTS);
    await resetFailures();
    await SecureStore.setItemAsync(SS.pinSalt, toHex(salt), META_OPTS);
    await SecureStore.setItemAsync(SS.pinPepper, pepperHex, META_OPTS);
    await SecureStore.setItemAsync(SS.pinEnvelope, envelope, META_OPTS);
    await SecureStore.setItemAsync(SS.dek, toHex(fresh), DEK_OPTS);
    await SecureStore.setItemAsync(SS.kdf, String(KDF_VERSION), META_OPTS);
    // This is the logical vault marker and is deliberately committed last.
    await SecureStore.setItemAsync(
      SS.keyScheme,
      String(KEY_SCHEME_VERSION),
      META_OPTS,
    );
    if (!(await hasCompleteVaultMetadata())) {
      throw new Error('PIN_SETUP_VERIFICATION_FAILED');
    }
    await SecureStore.deleteItemAsync(SS.setupPending, META_OPTS);
    if (await SecureStore.getItemAsync(SS.setupPending, META_OPTS) !== null) {
      throw new Error('PIN_SETUP_VERIFICATION_FAILED');
    }
    setupPepper.fill(0);
    setupPepper = null;
    enterUnlocked(fresh);
  } catch (error) {
    fresh.fill(0);
    setupPepper?.fill(0);
    lock();
    try {
      await deleteVaultMaterialAndVerify();
    } catch {
      throw new Error('PIN_SETUP_CLEANUP_UNCERTAIN');
    }
    throw error;
  }

}

/**
 * Enroll/replace the PIN fallback. Requires an already-UNLOCKED session so the
 * in-memory DEK can be wrapped under a fresh KDF-derived key. The PIN is never
 * stored ظ¤ only its salt and the AES-GCM-wrapped DEK envelope (PIN-1). Not part
 * of the ┬د8 interface but required so unlockWithPin has something to unwrap;
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

function enrollProfilePin(profileId: string, pinHash: string): void {
  if (!PROFILE_ID_PATTERN.test(profileId) || pinHash.length === 0) {
    throw new Error('INVALID_PROFILE_PIN_VERIFIER');
  }
  getEncryptedStorage().set(MMKV_KEYS.profilePinVerifier(profileId), pinHash);
}

function verifyProfilePin(profileId: string, candidate: string): boolean {
  if (!PROFILE_ID_PATTERN.test(profileId)) {
    return false;
  }
  const verifier = getEncryptedStorage().getString(
    MMKV_KEYS.profilePinVerifier(profileId),
  );
  return verifier !== undefined && verifier === candidate;
}

// CONFLICT: The requested profile API reuses enrollPin, which already owns the
// raw-PIN Argon2id DEK enrollment path. This overload preserves that existing
// one-argument behavior and adds the requested two-argument verifier storage.
function enrollPinDispatcher(pin: string): Promise<void>;
function enrollPinDispatcher(profileId: string, pinHash: string): void;
function enrollPinDispatcher(
  pinOrProfileId: string,
  pinHash?: string,
): Promise<void> | void {
  if (pinHash === undefined) {
    return enrollPin(pinOrProfileId);
  }
  enrollProfilePin(pinOrProfileId, pinHash);
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
  const blocked = await activeLockout('biometric');
  if (blocked !== null) {
    return blocked;
  }
  try {
    // KGET-1: the OS biometric/passcode prompt (from DEK_OPTS.requireAuthentication)
    // is the gate ظ¤ not an app boolean.
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
    // or OS lockout) MUST NOT advance the data-wipe counter ظ¤ the hardware
    // keychain already throttles biometric brute-force (KWRAP-2); the app
    // counter tracks the in-app PIN path only. No DEK material is logged
    // (MEM-1 / AC-3). recordFailure() is deliberately NOT called here.
    return isBiometricLockout(error)
      ? { ok: false, reason: 'locked_out' }
      : { ok: false, reason: 'bad_credential' };
  }
}

async function unlockWithPin(pin: string): Promise<UnlockResult> {
  const blocked = await activeLockout('pin');
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
    // PIN-7: PIN yields the same DEK as biometric ظ¤ equal scope, no backdoor.
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
    throw new Error('KeyVault is LOCKED ظ¤ unlock before accessing storage.');
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
  // instance ظ¤ the on-disk data stays encrypted and is unreadable until the
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
 * Explicit local reset. Destroying the DEK (and its PIN envelope) renders the
 * MMKV ciphertext permanently unrecoverable.
 */
async function wipeVault(): Promise<void> {
  lock();
  // Persist this first so any process death or deletion rejection stays on the
  // locked/retry branch rather than entering fresh setup against an uncertain wipe.
  await SecureStore.setItemAsync(SS.wipePending, '1', META_OPTS);
  await deleteVaultMaterialAndVerify();
  await SecureStore.deleteItemAsync(SS.wipePending, META_OPTS);
  const wipePending = await SecureStore.getItemAsync(SS.wipePending, META_OPTS);
  if (wipePending !== null) {
    throw new Error('LOCAL_VAULT_WIPE_VERIFICATION_FAILED');
  }
}

// --- AC-4 / BIND-3: cold-start & deep-link routing gate -----------------------
//
// AC-4 must not hang on the navigation layer "remembering" to check auth before
// it mounts a financial route. keyVault is the ┬د8 sole authority on the
// LOCKED/UNLOCKED state, so the routing decision originates HERE: a deep link or
// OS-restoration target that arrives while LOCKED is *captured* (held in memory,
// never auto-followed) and only released after a real unlock. The navigation
// layer becomes a thin consumer ظ¤ it asks canMountSecureNavigator() and replays
// consumePendingDeepLink() post-auth ظ¤ instead of re-deriving the security rule.

let pendingDeepLink: string | null = null;

/**
 * BIND-3 / BIND-4: the single source of truth for whether the authenticated
 * (financial) navigator may mount. True only when a DEK is in memory AND MMKV is
 * open ظ¤ exactly the UNLOCKED condition ظ¤ so the navigator and the key can never
 * diverge. The router MUST gate on this rather than an app-level boolean.
 */
function canMountSecureNavigator(): boolean {
  return dek !== null && storage !== null;
}

/**
 * AC-4 / BIND-3: register a cold-start or runtime deep link. While LOCKED the
 * link is only *remembered*, never resolved, so a deep link into a financial
 * route cannot bypass auth ظ¤ routing stays on LOCKED until a real unlock. Report
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
// The navigation layer consumes the explicit tri-state status plus explicit
// PIN/biometric unlock methods. There is intentionally no generic unlock alias:
// PIN remains the MVP primary credential and biometrics are a named optional path.

export type AuthStatus = 'LOCKED' | 'UNLOCKED' | 'UNKNOWN';

interface KeyVaultModule extends KeyVault {
  enrollPin(pin: string): Promise<void>;
  enrollPin(profileId: string, pinHash: string): void;
  initializeLocalVaultWithPin(pin: string): Promise<void>;
  verifyProfilePin(profileId: string, candidate: string): boolean;
  wipeVault(): Promise<void>;
  isUnlocked(): boolean;
  getAuthStatus(): Promise<AuthStatus>;
  // AC-4 / BIND-3 routing gate (security module is the routing authority).
  canMountSecureNavigator(): boolean;
  captureDeepLink(url: string | null): { readonly deferred: boolean };
  consumePendingDeepLink(): string | null;
}

export const keyVault: KeyVaultModule = {
  isInitialized,
  unlockWithBiometric,
  unlockWithPin,
  getEncryptedStorage,
  lock,
  enrollPin: enrollPinDispatcher,
  initializeLocalVaultWithPin,
  verifyProfilePin,
  wipeVault,
  canMountSecureNavigator,
  captureDeepLink,
  consumePendingDeepLink,
  isUnlocked: () => dek !== null && storage !== null,
  async getAuthStatus() {
    return dek !== null && storage !== null ? 'UNLOCKED' : 'LOCKED';
  },
};
