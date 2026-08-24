/**
 * KWRAP-2 — THE DEK IS NEVER WRITTEN WITHOUT `requireAuthentication: true`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS TEST EXISTS, AND WHY IT DID NOT BEFORE
 *
 * The Owner's OQ-001 ruling ends: **"No unauthenticated DEK fallback is permitted."**
 *
 * That prohibition was, at the moment it was written, guarded by nothing. `DEK_OPTS` carried the
 * flag and a long comment explained why — but no test asserted it, and neither did the B1
 * `vault-crypto` gate. Deleting `requireAuthentication: true` would have produced a green
 * typecheck, a green lint, a green suite and a green ladder, and shipped a vault that opens without
 * the user being present.
 *
 * The pressure to delete it is real and will recur: with the flag, a user with no enrolled
 * biometric cannot create a vault at all, and "just make it work on more devices" is a one-line
 * change. This test is what makes that line cost a conversation.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * IT ASSERTS ON THE CALL, NOT ON THE SOURCE
 *
 * A grep for the string `requireAuthentication: true` would pass while the constant was used for
 * metadata and the DEK written with something else. So the SecureStore mock RECORDS the options of
 * every call, enrolment is run for real, and the recorded write for the DEK key is inspected.
 *
 * The negative control at the bottom removes the flag from the recording and shows the assertion
 * going red — because a test that has only ever been watched to pass is not a test.
 */
type Recorded = {
  readonly op: 'set' | 'get' | 'delete';
  readonly key: string;
  readonly options: Record<string, unknown> | undefined;
};

const calls: Recorded[] = [];
const store = new Map<string, string>();
const mmkv = new Map<string, Map<string, string>>();

/** The SecureStore key the DEK lives under. Duplicated deliberately — see the assertion below. */
const DEK_KEY = 'sc.dek';

async function mockArgon2idAsync(
  pin: string,
  salt: Uint8Array,
  options: { readonly key: Uint8Array },
): Promise<Uint8Array> {
  const out = new Uint8Array(32);
  const pinBytes = Array.from(pin, (char) => char.charCodeAt(0));
  for (let index = 0; index < out.length; index += 1) {
    const saltByte = salt[index % salt.length] ?? 0;
    const pinByte = pinBytes[index % pinBytes.length] ?? 0;
    const keyByte = options.key[index % options.key.length] ?? 0;
    out[index] = (saltByte ^ pinByte ^ keyByte ^ index) & 0xff;
  }
  return out;
}

jest.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string, options?: Record<string, unknown>) => {
    calls.push({ op: 'get', key, options });
    return store.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string, options?: Record<string, unknown>) => {
    calls.push({ op: 'set', key, options });
    store.set(key, value);
  },
  deleteItemAsync: async (key: string, options?: Record<string, unknown>) => {
    calls.push({ op: 'delete', key, options });
    store.delete(key);
  },
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (size: number) => new Uint8Array(size),
}));

jest.mock('react-native-mmkv', () => {
  class MMKV {
    private readonly s: Map<string, string>;

    constructor(options?: { id?: string }) {
      const id = options?.id ?? 'default';
      const existing = mmkv.get(id);
      if (existing === undefined) {
        this.s = new Map<string, string>();
        mmkv.set(id, this.s);
      } else {
        this.s = existing;
      }
    }

    getString(key: string): string | undefined { return this.s.get(key); }
    set(key: string, value: string | number | boolean): void { this.s.set(key, String(value)); }
    delete(key: string): void { this.s.delete(key); }
    getAllKeys(): readonly string[] { return Array.from(this.s.keys()); }
  }
  return { MMKV };
});

jest.mock(
  '@noble/ciphers/aes.js',
  () => ({
    gcm: () => ({
      encrypt: (plaintext: Uint8Array) => plaintext,
      decrypt: (ciphertext: Uint8Array) => ciphertext,
    }),
  }),
  { virtual: true },
);

jest.mock(
  '@noble/hashes/argon2.js',
  () => ({ argon2idAsync: mockArgon2idAsync }),
  { virtual: true },
);

jest.mock('../../types/user.types', () => ({}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => true,
  isEnrolledAsync: async () => true,
  getEnrolledLevelAsync: async () => 3,
  supportedAuthenticationTypesAsync: async () => [1],
  authenticateAsync: async () => ({ success: true }),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));

/** True when these options would make the OS demand user presence before releasing the item. */
const isAuthGated = (options: Record<string, unknown> | undefined): boolean =>
  options !== undefined && options.requireAuthentication === true;

describe('KWRAP-2 · the DEK is auth-gated at every touch (OQ-001)', () => {
  beforeEach(() => {
    calls.length = 0;
    store.clear();
    mmkv.clear();
    jest.resetModules();
  });

  it('writes the DEK with requireAuthentication: true', async () => {
    const { keyVault } = require('../keyVault') as typeof import('../keyVault');
    await keyVault.initializeLocalVaultWithPin('123456');

    const dekWrites = calls.filter((c) => c.op === 'set' && c.key === DEK_KEY);

    // NOT VACUOUS. If enrolment stopped writing the DEK — or the key were renamed — `every()` on an
    // empty array is `true` and this suite would pass while asserting nothing about anything.
    expect(dekWrites.length).toBeGreaterThan(0);
    for (const write of dekWrites) {
      expect(isAuthGated(write.options)).toBe(true);
    }
  });

  /**
   * THE BIOMETRIC PATH IS THE ONE THAT TOUCHES THE GATED ITEM.
   *
   * This test was first written against `unlockWithPin` and failed with zero reads — which is
   * correct behaviour and a fact about the design worth stating rather than a bug: a PIN unlock
   * never reads `sc.dek` at all. It derives a KEK from the PIN and decrypts `sc.dek.pinEnvelope`,
   * which is ciphertext and needs no OS gate. Only `unlockWithBiometric` asks the keystore to
   * release the raw DEK, and that is the call the OS prompt hangs off (KGET-1).
   *
   * Asserting on the PIN path would therefore have been asserting on a path that cannot fail this
   * way, which is the vacuous check this campaign keeps finding.
   */
  it('reads the DEK with requireAuthentication: true on the biometric path', async () => {
    const { keyVault } = require('../keyVault') as typeof import('../keyVault');
    await keyVault.initializeLocalVaultWithPin('123456');
    calls.length = 0;
    await keyVault.unlockWithBiometric();

    const dekReads = calls.filter((c) => c.op === 'get' && c.key === DEK_KEY);
    expect(dekReads.length).toBeGreaterThan(0);
    for (const read of dekReads) {
      expect(isAuthGated(read.options)).toBe(true);
    }
  });

  /** The corollary, asserted so the claim above is not just a comment. */
  it('a PIN unlock never touches the gated DEK item — it decrypts the envelope', async () => {
    const { keyVault } = require('../keyVault') as typeof import('../keyVault');
    await keyVault.initializeLocalVaultWithPin('123456');
    calls.length = 0;
    await keyVault.unlockWithPin('123456');

    expect(calls.filter((c) => c.key === DEK_KEY)).toHaveLength(0);
    expect(calls.map((c) => c.key)).toContain('sc.dek.pinEnvelope');
  });

  it('binds the DEK to this device only, so no backup can carry it off', async () => {
    const { keyVault } = require('../keyVault') as typeof import('../keyVault');
    await keyVault.initializeLocalVaultWithPin('123456');

    const dekWrites = calls.filter((c) => c.op === 'set' && c.key === DEK_KEY);
    expect(dekWrites.length).toBeGreaterThan(0);
    for (const write of dekWrites) {
      expect(write.options?.keychainAccessible).toBe('WHEN_UNLOCKED_THIS_DEVICE_ONLY');
    }
  });

  /**
   * THE KEY NAME IS DUPLICATED IN THIS FILE, SO IT IS COMPARED RATHER THAN TRUSTED.
   *
   * `DEK_KEY` above is a copy of a private constant in `keyVault.ts`. If someone renames it there,
   * every filter in this suite silently matches nothing and — but for the `toBeGreaterThan(0)`
   * guards — the whole file would go green while the DEK went unwatched. Those guards are what
   * catch it, and this test says out loud that they are load-bearing.
   */
  it('the DEK key this suite watches is a key enrolment actually writes', async () => {
    const { keyVault } = require('../keyVault') as typeof import('../keyVault');
    await keyVault.initializeLocalVaultWithPin('123456');
    expect(calls.map((c) => c.key)).toContain(DEK_KEY);
  });

  /**
   * NEGATIVE CONTROL. The assertion above is shown going red against options that lack the flag —
   * which is exactly the shape of the "just make it work on more devices" edit the ruling forbids.
   */
  it('the assertion can fail: an unauthenticated DEK write is refused', () => {
    const unauthenticated = {
      keychainService: 'sc',
      keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    };
    expect(isAuthGated(unauthenticated)).toBe(false);
    expect(isAuthGated(undefined)).toBe(false);
    expect(isAuthGated({ requireAuthentication: false })).toBe(false);
    // and the true case is not accidental
    expect(isAuthGated({ requireAuthentication: true })).toBe(true);
  });
});
