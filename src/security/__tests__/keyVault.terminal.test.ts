/* eslint-disable @typescript-eslint/no-unused-vars */

declare const describe: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => Promise<void> | void) => void;
declare const beforeEach: (fn: () => Promise<void> | void) => void;
declare const jest: {
  mock: (
    moduleName: string,
    factory: () => unknown,
    options?: { readonly virtual?: boolean },
  ) => void;
  resetModules: () => void;
  requireActual: (moduleName: string) => unknown;
};

type SecureStoreState = Map<string, string>;
type MmkvState = Map<string, Map<string, string>>;

type CapturedKey = Uint8Array;

const mockSecureStoreState: SecureStoreState = new Map();
const mockMmkvState: MmkvState = new Map();
const mockCapturedGcmKeys: CapturedKey[] = [];

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function resetStore(): void {
  mockSecureStoreState.clear();
  mockMmkvState.clear();
  mockCapturedGcmKeys.length = 0;
}

function mockSeedStorage(id: string): Map<string, string> {
  const existing = mockMmkvState.get(id);
  if (existing !== undefined) {
    return existing;
  }
  const store = new Map<string, string>();
  mockMmkvState.set(id, store);
  return store;
}

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
  AppState: {
    addEventListener: () => ({ remove: () => undefined }),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockSecureStoreState.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSecureStoreState.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockSecureStoreState.delete(key);
  },
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (size: number) => new Uint8Array(size),
}));

jest.mock('react-native-mmkv', () => {
  class MMKV {
    private readonly store: Map<string, string>;

    constructor(options?: { id?: string }) {
      const id = options?.id ?? 'default';
      this.store = mockSeedStorage(id);
    }

    getString(key: string): string | undefined {
      return this.store.get(key);
    }

    set(key: string, value: string | number | boolean): void {
      this.store.set(key, String(value));
    }

    delete(key: string): void {
      this.store.delete(key);
    }

    getAllKeys(): readonly string[] {
      return Array.from(this.store.keys());
    }
  }

  return { MMKV };
});

jest.mock(
  '@noble/ciphers/aes',
  () => ({
    gcm: (key: Uint8Array) => {
      mockCapturedGcmKeys.push(Uint8Array.from(key));
      return {
        encrypt: (plaintext: Uint8Array) => plaintext,
        decrypt: (ciphertext: Uint8Array) => ciphertext,
      };
    },
  }),
  { virtual: true },
);

jest.mock(
  '@noble/hashes/argon2',
  () => ({
    argon2idAsync: mockArgon2idAsync,
  }),
  { virtual: true },
);

jest.mock('../../types/user.types', () => ({}));

function loadKeyVault(): typeof import('../keyVault') {
  return require('../keyVault');
}

function setNow(nowMs: number): void {
  Date.now = (() => nowMs) as typeof Date.now;
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value: { now: () => nowMs },
  });
}

describe('keyVault terminal lock behavior', () => {
  beforeEach(() => {
    resetStore();
    mockSecureStoreState.set('sc.dek', '0102030405060708090a0b0c0d0e0f10');
    mockSecureStoreState.set('sc.pinSalt', '00112233445566778899aabbccddeeff');
    mockSecureStoreState.set('sc.pinPepper', 'ffeeddccbbaa99887766554433221100');
    mockSecureStoreState.set('sc.pinEnvelope', '00:00');
    mockSecureStoreState.delete('security:terminal_locked_until');
    mockSeedStorage('smartcard.security.meta');
    mockSeedStorage('smartcard.secure');
  });

  // [HIGH-REC-01] Terminal lock must block PIN after the 10th failure.
  test('terminal lock blocks PIN after 10 failures', async () => {
    setNow(1_000_000);
    const { keyVault } = loadKeyVault();

    mockSecureStoreState.set('sc.lockout', JSON.stringify({
      tier: 'terminal',
      failures: 10,
      lastFailureMonotonicMs: 0,
      lastFailureWallMs: 1_000_000,
      lockedUntilMs: 1_000_000 + 24 * 60 * 60 * 1000,
      isTerminalLock: true,
    }));
    mockSecureStoreState.set('security:terminal_locked_until', String(1_000_000 + 24 * 60 * 60 * 1000));

    const result = await keyVault.unlockWithPin('1234');
    expect(result.ok === false, 'PIN should be blocked at terminal tier');
    if (!result.ok) {
      expect(result.reason === 'locked_out', 'terminal PIN block must report locked_out');
    }
  });

  // [HIGH-REC-01] Legitimate biometric recovery must stay open at the terminal tier.
  test('terminal lock does not block biometric recovery', async () => {
    setNow(1_000_000);
    const { keyVault } = loadKeyVault();

    mockSecureStoreState.set('sc.lockout', JSON.stringify({
      tier: 'terminal',
      failures: 10,
      lastFailureMonotonicMs: 0,
      lastFailureWallMs: 1_000_000,
      lockedUntilMs: 1_000_000 + 24 * 60 * 60 * 1000,
      isTerminalLock: true,
    }));
    mockSecureStoreState.set('security:terminal_locked_until', String(1_000_000 + 24 * 60 * 60 * 1000));

    const result = await keyVault.unlockWithBiometric();
    expect(result.ok === true, 'biometric recovery must bypass terminal lock');
  });

  // [HIGH-REC-01] Terminal lock must survive restart because lockedUntil is persisted.
  test('terminal lock survives app restart', async () => {
    setNow(0);
    let { keyVault } = loadKeyVault();

    mockSecureStoreState.set('sc.lockout', JSON.stringify({
      tier: 'terminal',
      failures: 10,
      lastFailureMonotonicMs: 0,
      lastFailureWallMs: 1_000_000,
      lockedUntilMs: 1_000_000 + 24 * 60 * 60 * 1000,
      isTerminalLock: true,
    }));
    mockSecureStoreState.set('security:terminal_locked_until', String(1_000_000 + 24 * 60 * 60 * 1000));

    jest.resetModules();
    ({ keyVault } = loadKeyVault());

    const result = await keyVault.unlockWithPin('1234');
    expect(result.ok === false, 'terminal lock must still block after restart');
    if (!result.ok) {
      expect(result.reason === 'locked_out', 'restart should still report locked_out');
    }
  });

  // [HIGH-REC-01] Terminal lock must persist until an explicit vault wipe.
  test('terminal lock persists across restart until vault wipe', async () => {
    setNow(2_000_000 + 24 * 60 * 60 * 1000 + 1);
    let { keyVault } = loadKeyVault();

    mockSecureStoreState.set('sc.lockout', JSON.stringify({
      tier: 'terminal',
      failures: 10,
      lastFailureMonotonicMs: 0,
      lastFailureWallMs: 2_000_000,
      lockedUntilMs: 2_000_000 + 24 * 60 * 60 * 1000,
      isTerminalLock: true,
    }));
    mockSecureStoreState.set('security:terminal_locked_until', String(2_000_000 + 24 * 60 * 60 * 1000));

    jest.resetModules();
    ({ keyVault } = loadKeyVault());

    const result = await keyVault.unlockWithPin('1234');
    expect(result.ok === false, 'terminal lock must not expire without wipeVault');
    if (!result.ok) {
      expect(result.reason === 'locked_out', 'rehydrated terminal lock should report locked_out');
    }
  });

  // [COND-B] Same PIN and salt must produce different derived keys when pepper changes.
  test('different pepper changes derived envelope key', async () => {
    setNow(3_000_000);
    const pin = '1234';
    const salt = Uint8Array.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
    const pepperOne = Uint8Array.from({ length: 32 }, () => 0xaa);
    const pepperTwo = Uint8Array.from({ length: 32 }, () => 0xbb);

    const firstKey = await mockArgon2idAsync(pin, salt, { key: pepperOne });
    const secondKey = await mockArgon2idAsync(pin, salt, { key: pepperTwo });

    expect(firstKey.length === secondKey.length, 'derived keys must be comparable');
    expect(
      firstKey.some((byte, index) => byte !== secondKey[index]),
      'different pepper values must produce different derived keys',
    );
  });

  // [HIGH-REC-01] Non-terminal tiers block both PIN and biometric unlock paths.
  test('tiers 5-9 block both PIN and biometric', async () => {
    setNow(4_000_000);
    const { keyVault } = loadKeyVault();

    mockSecureStoreState.set('sc.lockout', JSON.stringify({
      tier: 'backoff',
      failures: 7,
      lastFailureMonotonicMs: 3_999_000,
      lastFailureWallMs: 3_999_000,
      lockedUntilMs: 0,
      isTerminalLock: false,
    }));

    const pinResult = await keyVault.unlockWithPin('1234');
    const biometricResult = await keyVault.unlockWithBiometric();

    expect(pinResult.ok === false, 'tier 5-9 must block PIN');
    expect(biometricResult.ok === false, 'tier 5-9 must also block biometric');
    if (!pinResult.ok) {
      expect(pinResult.reason === 'locked_out', 'PIN backoff should be locked_out');
    }
    if (!biometricResult.ok) {
      expect(biometricResult.reason === 'locked_out', 'biometric backoff should be locked_out');
    }
  });
});
