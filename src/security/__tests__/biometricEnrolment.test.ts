/**
 * OQ-001 — the enrolment gate refuses the states the device actually refuses.
 *
 * The failure this guards against is not a crash; it is a gate that reports READY on a device where
 * `SecureStore` is about to throw, putting the user back in the "Try again" loop the device lane
 * spent an afternoon inside. So every branch is asserted, including the two that are easy to get
 * wrong on purpose:
 *
 *   · `SECRET` — a lock-screen PIN. `isEnrolledAsync()` says true; `canAuthenticate(BIOMETRIC_STRONG)`
 *     says no. This is the exact state that produced the original failure.
 *   · a THROWING probe — which must refuse, not wave through.
 */
const platform = { OS: 'android' as string };
const sentIntents: string[] = [];
let openSettingsCalls = 0;
let sendIntentImpl: (action: string) => Promise<void> = async (action) => {
  sentIntents.push(action);
};

jest.mock('react-native', () => ({
  get Platform() { return platform; },
  Linking: {
    sendIntent: (action: string) => sendIntentImpl(action),
    openSettings: async () => { openSettingsCalls += 1; },
  },
}));

const auth = {
  hasHardware: true,
  level: 3,
  throws: null as Error | null,
};

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => {
    if (auth.throws !== null) throw auth.throws;
    return auth.hasHardware;
  },
  getEnrolledLevelAsync: async () => auth.level,
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));

// The failure reporter writes to console.error by design; silenced so the suite output stays
// readable, and asserted on where it matters.
const reported: string[] = [];
jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
  reported.push(args.map(String).join(' '));
});

import {
  checkVaultEnrolmentReadiness,
  isFixableInSettings,
  openBiometricEnrolmentSettings,
} from '../biometricEnrolment';

beforeEach(() => {
  platform.OS = 'android';
  auth.hasHardware = true;
  auth.level = 3;
  auth.throws = null;
  sentIntents.length = 0;
  reported.length = 0;
  openSettingsCalls = 0;
  sendIntentImpl = async (action) => { sentIntents.push(action); };
});

describe('checkVaultEnrolmentReadiness', () => {
  it('is ready with a STRONG biometric — the only level secure-store accepts', async () => {
    auth.level = 3;
    expect(await checkVaultEnrolmentReadiness()).toEqual({ ready: true });
  });

  it('refuses a lock-screen PIN only — the state that produced the device failure', async () => {
    auth.level = 1; // SECRET
    expect(await checkVaultEnrolmentReadiness()).toEqual({
      ready: false, reason: 'device_credential_only',
    });
  });

  it('refuses a WEAK biometric, which canAuthenticate(BIOMETRIC_STRONG) also refuses', async () => {
    auth.level = 2;
    expect(await checkVaultEnrolmentReadiness()).toEqual({ ready: false, reason: 'weak_only' });
  });

  it('refuses when nothing is enrolled', async () => {
    auth.level = 0;
    expect(await checkVaultEnrolmentReadiness()).toEqual({ ready: false, reason: 'not_enrolled' });
  });

  it('refuses when there is no sensor, and says so distinctly from "not enrolled"', async () => {
    auth.hasHardware = false;
    auth.level = 0;
    const result = await checkVaultEnrolmentReadiness();
    expect(result).toEqual({ ready: false, reason: 'no_hardware' });
    // The distinction is what stops the UI sending someone into Settings to enrol on a device with
    // nothing to enrol on.
    expect(isFixableInSettings('no_hardware')).toBe(false);
  });

  it('FAILS CLOSED when the probe itself throws, and reports the reason', async () => {
    auth.throws = new Error('native module unavailable');
    expect(await checkVaultEnrolmentReadiness()).toEqual({ ready: false, reason: 'probe_failed' });
    expect(reported.join(' ')).toContain('native module unavailable');
  });

  it('does not block on iOS, where a device passcode is an accepted fallback', async () => {
    platform.OS = 'ios';
    auth.hasHardware = false;
    auth.level = 0;
    // Same inputs that refuse on Android. The asymmetry is real and deliberate — see the module
    // header — and this asserts the gate follows the constraint rather than a tidy uniform rule.
    expect(await checkVaultEnrolmentReadiness()).toEqual({ ready: true });
  });
});

describe('isFixableInSettings', () => {
  it('is true exactly for the states a user can resolve by enrolling', () => {
    expect(isFixableInSettings('not_enrolled')).toBe(true);
    expect(isFixableInSettings('weak_only')).toBe(true);
    expect(isFixableInSettings('device_credential_only')).toBe(true);
    expect(isFixableInSettings('no_hardware')).toBe(false);
    expect(isFixableInSettings('probe_failed')).toBe(false);
  });
});

describe('openBiometricEnrolmentSettings', () => {
  it('asks for the biometric enrolment screen first', async () => {
    expect(await openBiometricEnrolmentSettings()).toBe(true);
    expect(sentIntents).toEqual(['android.settings.BIOMETRIC_ENROLL']);
  });

  it('falls back to security settings on API < 30, where that action does not exist', async () => {
    sendIntentImpl = async (action) => {
      if (action === 'android.settings.BIOMETRIC_ENROLL') {
        throw new Error('No Activity found to handle Intent');
      }
      sentIntents.push(action);
    };
    expect(await openBiometricEnrolmentSettings()).toBe(true);
    expect(sentIntents).toEqual(['android.settings.SECURITY_SETTINGS']);
  });

  it('reports false when nothing opened, so the UI can say so', async () => {
    sendIntentImpl = async () => { throw new Error('no activity'); };
    expect(await openBiometricEnrolmentSettings()).toBe(false);
  });

  it('uses the app settings screen off Android', async () => {
    platform.OS = 'ios';
    expect(await openBiometricEnrolmentSettings()).toBe(true);
    expect(openSettingsCalls).toBe(1);
    expect(sentIntents).toEqual([]);
  });
});
