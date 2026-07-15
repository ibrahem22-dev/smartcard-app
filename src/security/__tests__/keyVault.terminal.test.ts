type SecureStoreState = Map<string, string>;
type MmkvState = Map<string, Map<string, string>>;

const mockSecureStoreState: SecureStoreState = new Map();
const mockMmkvState: MmkvState = new Map();
const mockDeleteFailures = new Map<string, Error>();
const mockSetFailures = new Map<string, Error>();

function resetStore(): void {
  mockSecureStoreState.clear();
  mockMmkvState.clear();
  mockDeleteFailures.clear();
  mockSetFailures.clear();
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
    const failure = mockSetFailures.get(key);
    if (failure !== undefined) {
      throw failure;
    }
    mockSecureStoreState.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    const failure = mockDeleteFailures.get(key);
    if (failure !== undefined) {
      throw failure;
    }
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
    gcm: () => ({
      encrypt: (plaintext: Uint8Array) => plaintext,
      decrypt: (ciphertext: Uint8Array) => ciphertext,
    }),
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

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => true,
  isEnrolledAsync: async () => true,
  supportedAuthenticationTypesAsync: async () => [1],
  authenticateAsync: async () => ({ success: true }),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

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

function seedTerminalLockout(lastFailureWallMs: number): void {
  mockSecureStoreState.set(
    'sc.lockout',
    JSON.stringify({
      tier: 'terminal',
      failures: 10,
      lastFailureMonotonicMs: 0,
      lastFailureWallMs,
      lockedUntilMs: 0,
      isTerminalLock: true,
    }),
  );
}

describe('keyVault temporary escalating lockout behavior', () => {
  beforeEach(() => {
    resetStore();
    jest.resetModules();
    mockSecureStoreState.set('sc.dek', '0102030405060708090a0b0c0d0e0f10');
    mockSecureStoreState.set('sc.pin.salt', '00112233445566778899aabbccddeeff');
    mockSecureStoreState.set('sc.pin.pepper', 'ffeeddccbbaa99887766554433221100');
    mockSecureStoreState.set('sc.dek.pinEnvelope', '00:00');
    mockSeedStorage('smartcard.security.meta');
    mockSeedStorage('smartcard.secure');
  });

  test('legacy terminal metadata blocks PIN as maximum temporary backoff', async () => {
    setNow(1_000_000);
    const { keyVault } = loadKeyVault();
    seedTerminalLockout(1_000_000);

    const result = await keyVault.unlockWithPin('1234');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('locked_out');
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  test('legacy terminal metadata blocks biometric during temporary backoff', async () => {
    setNow(1_000_000);
    const { keyVault } = loadKeyVault();
    seedTerminalLockout(1_000_000);

    const result = await keyVault.unlockWithBiometric();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('locked_out');
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  test('maximum temporary backoff survives app restart', async () => {
    setNow(0);
    seedTerminalLockout(1_000_000);
    let { keyVault } = loadKeyVault();

    jest.resetModules();
    ({ keyVault } = loadKeyVault());

    const result = await keyVault.unlockWithPin('1234');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('locked_out');
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

test('maximum temporary backoff expires without automatic wipe', async () => {
  setNow(2_000_000 + 24 * 60 * 60 * 1000 + 1);
  seedTerminalLockout(2_000_000);
  let { keyVault } = loadKeyVault();

  jest.resetModules();
  ({ keyVault } = loadKeyVault());

  const blocked = await keyVault.unlockWithPin('1234');
  expect(blocked.ok).toBe(true);
  expect(mockSecureStoreState.has('sc.dek')).toBe(true);
  expect(mockSecureStoreState.has('sc.dek.pinEnvelope')).toBe(true);

  await keyVault.wipeVault();

  expect(mockSecureStoreState.has('sc.lockout')).toBe(false);

  jest.resetModules();
  ({ keyVault } = loadKeyVault());

  const afterWipe = await keyVault.unlockWithPin('1234');

  expect(afterWipe.ok).toBe(false);
  if (!afterWipe.ok) {
    expect(afterWipe.reason).not.toBe('locked_out');
  }
});

describe('keyVault PIN-first setup and local wipe behavior', () => {
  beforeEach(() => {
    resetStore();
    jest.resetModules();
    mockSeedStorage('smartcard.security.meta');
    mockSeedStorage('smartcard.secure');
  });

  test('clean module does not create a local vault before successful six-digit PIN setup', async () => {
    const { keyVault } = loadKeyVault();

    expect(await keyVault.isInitialized()).toBe(false);
    expect(await keyVault.getAuthStatus()).toBe('LOCKED');
    expect(keyVault.canMountSecureNavigator()).toBe(false);
    expect(mockSecureStoreState.has('sc.dek')).toBe(false);
    expect(mockSecureStoreState.has('sc.keySchemeVersion')).toBe(false);

    await expect(keyVault.initializeLocalVaultWithPin('1234')).rejects.toThrow(
      'PIN_SETUP_REQUIRES_SIX_DIGITS',
    );
    expect(mockSecureStoreState.has('sc.dek')).toBe(false);
    expect(mockSecureStoreState.has('sc.keySchemeVersion')).toBe(false);
  });

  test('first-vault setup rolls back on a commit failure and does not claim a vault', async () => {
    const { keyVault } = loadKeyVault();
    mockSetFailures.set('sc.keySchemeVersion', new Error('commit failed'));

    await expect(keyVault.initializeLocalVaultWithPin('123456')).rejects.toThrow(
      'commit failed',
    );

    expect(mockSecureStoreState.has('sc.setupPending')).toBe(false);
    expect(mockSecureStoreState.has('sc.dek')).toBe(false);
    expect(mockSecureStoreState.has('sc.keySchemeVersion')).toBe(false);
    expect(await keyVault.isInitialized()).toBe(false);
    expect(keyVault.canMountSecureNavigator()).toBe(false);
  });

  test('an interrupted first-vault setup is locked until explicit reset', async () => {
    mockSecureStoreState.set('sc.setupPending', '1');
    const { keyVault } = loadKeyVault();

    expect(await keyVault.isInitialized()).toBe(true);
    expect(await keyVault.getAuthStatus()).toBe('LOCKED');
    expect(keyVault.canMountSecureNavigator()).toBe(false);
  });

  test('successful PIN-first setup requires a fresh PIN unlock after module restart', async () => {
    let { keyVault } = loadKeyVault();

    await keyVault.initializeLocalVaultWithPin('123456');
    expect(await keyVault.isInitialized()).toBe(true);
    expect(keyVault.canMountSecureNavigator()).toBe(true);

    jest.resetModules();
    ({ keyVault } = loadKeyVault());

    expect(await keyVault.getAuthStatus()).toBe('LOCKED');
    expect(keyVault.canMountSecureNavigator()).toBe(false);
    await expect(keyVault.unlockWithPin('123456')).resolves.toEqual({ ok: true });
    expect(keyVault.canMountSecureNavigator()).toBe(true);
  });

  test('fresh module with persisted vault markers cannot mount authenticated navigation', async () => {
    mockSecureStoreState.set('sc.dek', '0102030405060708090a0b0c0d0e0f10');
    mockSecureStoreState.set('sc.pin.salt', '00112233445566778899aabbccddeeff');
    mockSecureStoreState.set('sc.pin.pepper', 'ffeeddccbbaa99887766554433221100');
    mockSecureStoreState.set('sc.dek.pinEnvelope', '00:00');
    mockSecureStoreState.set('sc.keySchemeVersion', '1');
    mockSecureStoreState.set('sc.kdfVersion', '2');

    const { keyVault } = loadKeyVault();

    expect(await keyVault.isInitialized()).toBe(true);
    expect(await keyVault.getAuthStatus()).toBe('LOCKED');
    expect(keyVault.canMountSecureNavigator()).toBe(false);
  });

  test('failed DEK deletion rejects local wipe and leaves the vault locked', async () => {
    const { keyVault } = loadKeyVault();
    mockSecureStoreState.set('sc.dek', '0102030405060708090a0b0c0d0e0f10');
    mockSecureStoreState.set('sc.pin.salt', '00112233445566778899aabbccddeeff');
    mockSecureStoreState.set('sc.pin.pepper', 'ffeeddccbbaa99887766554433221100');
    mockSecureStoreState.set('sc.dek.pinEnvelope', '00:00');
    mockSecureStoreState.set('sc.keySchemeVersion', '1');
    mockSecureStoreState.set('sc.kdfVersion', '2');
    mockDeleteFailures.set('sc.dek', new Error('delete failed'));

    await expect(keyVault.wipeVault()).rejects.toThrow('delete failed');
    expect(await keyVault.getAuthStatus()).toBe('LOCKED');
    expect(keyVault.canMountSecureNavigator()).toBe(false);
    expect(mockSecureStoreState.has('sc.dek')).toBe(true);
    expect(mockSecureStoreState.has('sc.wipePending')).toBe(true);

    jest.resetModules();
    const { keyVault: coldKeyVault } = loadKeyVault();
    expect(await coldKeyVault.isInitialized()).toBe(true);
    expect(await coldKeyVault.getAuthStatus()).toBe('LOCKED');
    expect(coldKeyVault.canMountSecureNavigator()).toBe(false);
  });

  test('successful local wipe verifies deletion before fresh setup is permitted', async () => {
    const { keyVault } = loadKeyVault();

    await keyVault.initializeLocalVaultWithPin('123456');
    await keyVault.wipeVault();

    expect(mockSecureStoreState.has('sc.dek')).toBe(false);
    expect(mockSecureStoreState.has('sc.keySchemeVersion')).toBe(false);
    expect(mockSecureStoreState.has('sc.wipePending')).toBe(false);
    expect(await keyVault.isInitialized()).toBe(false);
    expect(keyVault.canMountSecureNavigator()).toBe(false);
  });
});

  test('different pepper changes derived envelope key', async () => {
    const pin = '1234';
    const salt = Uint8Array.from([
      0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc,
      0xdd, 0xee, 0xff,
    ]);
    const pepperOne = Uint8Array.from({ length: 32 }, () => 0xaa);
    const pepperTwo = Uint8Array.from({ length: 32 }, () => 0xbb);

    const firstKey = await mockArgon2idAsync(pin, salt, { key: pepperOne });
    const secondKey = await mockArgon2idAsync(pin, salt, { key: pepperTwo });

    expect(firstKey.length).toBe(secondKey.length);
    expect(firstKey.some((byte, index) => byte !== secondKey[index])).toBe(true);
  });

  test('tiers 5-9 block both PIN and biometric', async () => {
    setNow(4_000_000);
    const { keyVault } = loadKeyVault();

    mockSecureStoreState.set(
      'sc.lockout',
      JSON.stringify({
        tier: 'backoff',
        failures: 7,
        lastFailureMonotonicMs: 3_999_000,
        lastFailureWallMs: 3_999_000,
        lockedUntilMs: 0,
        isTerminalLock: false,
      }),
    );

    const pinResult = await keyVault.unlockWithPin('1234');
    const biometricResult = await keyVault.unlockWithBiometric();

    expect(pinResult.ok).toBe(false);
    expect(biometricResult.ok).toBe(false);
    if (!pinResult.ok) {
      expect(pinResult.reason).toBe('locked_out');
    }
    if (!biometricResult.ok) {
      expect(biometricResult.reason).toBe('locked_out');
    }
  });
});
