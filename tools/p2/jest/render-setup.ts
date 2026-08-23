/**
 * SETUP FOR THE `render` JEST PROJECT.
 *
 * Only what a screen genuinely cannot mount without, and only NATIVE modules — things backed by a
 * real device API that does not exist in a test process. Nothing here mocks application code: a
 * screen whose own logic has to be stubbed out to render has not been shown to render, and E2 would
 * then be measuring the stubs.
 *
 * The mocked list is checked against what is installed, below, so a mock for a package that has
 * been removed cannot sit here forever pretending to do something.
 */
// @testing-library/react-native v13 builds its matchers in; the old extend-expect entry point
// was removed in that release, so importing it would fail rather than add anything.

// Reanimated ships its own test shim. Without it every animated component throws on mount.
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const mock = require('react-native-reanimated/mock');
  return { ...mock, default: mock };
});

/**
 * Encrypted key-value storage backed by a native module. The vault's real behaviour is criteria
 * B1/B3/B4 and is proven by their own gates against the real implementation; here it exists only so
 * a screen that reads a setting can mount.
 */
jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string | number | boolean>();
  class MMKV {
    set(k: string, v: string | number | boolean) { store.set(k, v); }
    getString(k: string) { return store.get(k) as string | undefined; }
    getNumber(k: string) { return store.get(k) as number | undefined; }
    getBoolean(k: string) { return store.get(k) as boolean | undefined; }
    delete(k: string) { store.delete(k); }
    clearAll() { store.clear(); }
    getAllKeys() { return [...store.keys()]; }
    contains(k: string) { return store.has(k); }
    addOnValueChangedListener() { return { remove() { /* no-op */ } }; }
  }
  return { MMKV, useMMKVString: () => [undefined, () => { /* no-op */ }] };
});

/**
 * Hardware-backed secure storage. Same reasoning as MMKV — and it has to actually STORE.
 *
 * The first version of this mock returned null from every read. The real vault verifies its own
 * setup by writing metadata and reading it back, so it correctly refused with
 * PIN_SETUP_VERIFICATION_FAILED. That refusal was the vault working. A mock that cannot be read
 * back is not a mock of storage; it is a mock of a broken device, and it would have made every
 * vault-touching screen look unrenderable for a reason that was the harness fault.
 */
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    deleteItemAsync: jest.fn(async (k: string) => { store.delete(k); }),
    isAvailableAsync: jest.fn(async () => true),
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  };
});

/** Biometrics — there is no sensor in a test process. */
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  authenticateAsync: jest.fn(async () => ({ success: false })),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
}));

/**
 * THE MOCK LIST IS CHECKED AGAINST WHAT IS INSTALLED.
 *
 * A mock for a package no longer in the tree is dead weight that still reads as deliberate — and
 * this campaign is about to REMOVE packages (criterion B9 archives Supabase and RevenueCat and
 * deletes expo-camera and react-native-qrcode-svg). When one of those goes, a stale mock here
 * should say so rather than sit quietly.
 */
const MOCKED_NATIVE_MODULES = [
  'react-native-reanimated',
  'react-native-mmkv',
  'expo-secure-store',
  'expo-local-authentication',
] as const;

beforeAll(() => {
  const missing = MOCKED_NATIVE_MODULES.filter((m) => {
    try { require.resolve(m); return false; } catch { return true; }
  });
  if (missing.length > 0) {
    throw new Error(
      'render-setup mocks ' + missing.length + ' package(s) that are not installed: '
      + missing.join(', ') + '. Remove the mock, or restore the dependency. A mock for a package '
      + 'that is gone is a stub nothing uses, and it hides the fact that nothing uses it.',
    );
  }
});

/**
 * THE VAULT IS UNLOCKED WITH THE REAL IMPLEMENTATION, NOT MOCKED AWAY.
 *
 * `keyVault.getEncryptedStorage()` throws "KeyVault is LOCKED" by design (AUTH-07), and a screen
 * that reads user storage cannot mount against a locked vault. That is a runtime PRECONDITION, in
 * exactly the same category as being inside AuthProvider — production unlocks the vault before
 * those screens are reachable.
 *
 * It is initialised through the REAL keyVault, running its real key-derivation and storage logic
 * against the mocked NATIVE modules underneath. Mocking the vault itself would have been easier and
 * would have made every vault-touching screen render against a stub — which is precisely what E2
 * must not measure. Criteria B1, B3 and B4 test the vault properly; this only opens it.
 */
beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { keyVault } = require('../../../src/security/keyVault');
  if (!keyVault.isUnlocked()) {
    await keyVault.initializeLocalVaultWithPin('000000');
  }
  if (!keyVault.isUnlocked()) {
    throw new Error(
      'the vault did not unlock in setup. Screens that read user storage cannot mount, and the '
      + 'render harness would under-report by that many screens without saying why.',
    );
  }
});
