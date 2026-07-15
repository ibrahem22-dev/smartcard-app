import { readFileSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..', '..');

function readSource(relativePath: string): string {
  return readFileSync(join(SRC_ROOT, relativePath), 'utf8');
}

function readAppSource(): string {
  return readFileSync(join(SRC_ROOT, '..', 'App.tsx'), 'utf8');
}

describe('MVP auth/vault static contract', () => {
  const mvpAuthPaths = [
    'auth/index.ts',
    'navigation/AuthGate.tsx',
    'navigation/authContext.tsx',
    'navigation/authLifecycle.ts',
    'screens/LockScreen.tsx',
    'screens/onboarding/OnboardingScreen.tsx',
    'security/keyVault.ts',
  ] as const;

  test('MVP auth/vault/onboarding paths do not import or call Supabase', () => {
    const forbidden = [
      '@supabase/supabase-js',
      'services/supabase',
      'getSupabase',
      'signInWithOtp',
      'verifyOtp',
      'supabase.auth',
    ];

    for (const relativePath of mvpAuthPaths) {
      const source = readSource(relativePath);

      for (const token of forbidden) {
        expect(source).not.toContain(token);
      }
    }
  });

  test('AuthGate MVP branch does not register remote account screens', () => {
    const source = readSource('navigation/AuthGate.tsx');

    expect(source).not.toContain('RegisterScreen');
    expect(source).not.toContain('OTPVerifyScreen');
    expect(source).not.toContain('name="Register"');
    expect(source).not.toContain('name="OTPVerify"');
  });

  test('MVP navigation does not register deferred feature screens', () => {
    // Deferred scope (DECISIONS_DEFERRED.md) must not be reachable in the MVP
    // navigation graph. Screen files may still exist, but no navigator registers
    // them: QR profile sharing (#9), loans/mortgage (#12), benefits/savings (#7).
    const settingsStack = readSource('navigation/stacks/SettingsStack.tsx');
    expect(settingsStack).not.toContain('ProfileShareScreen');
    expect(settingsStack).not.toContain('name="ProfileShare"');
    expect(settingsStack).not.toContain('LoansScreen');
    expect(settingsStack).not.toContain('name="Loans"');

    const homeStack = readSource('navigation/stacks/HomeStack.tsx');
    expect(homeStack).not.toContain('BenefitsScreen');
    expect(homeStack).not.toContain('name="Benefits"');
    expect(homeStack).not.toContain('SavingsTrackerScreen');
    expect(homeStack).not.toContain('name="SavingsTracker"');
  });

  test('MVP auth/vault paths do not resurrect unapproved session guard timers', () => {
    const forbidden = [
      'SESSION_TIMEOUT_MS',
      'startSessionGuard',
      'setTimeout',
      'setInterval',
    ];

    for (const relativePath of mvpAuthPaths) {
      const source = readSource(relativePath);

      for (const token of forbidden) {
        expect(source).not.toContain(token);
      }
    }
  });

  test('AUTH-07 locked grace window is centralized in auth lifecycle', () => {
    const source = readSource('navigation/authLifecycle.ts');

    expect(source).toContain('AUTH_07_GRACE_WINDOW_MS = 5 * 60 * 1000');
  });

  test('clean boot does not initialize a PIN-less vault', () => {
    const appSource = readAppSource();
    const keyVaultSource = readSource('security/keyVault.ts');

    expect(appSource).not.toContain('initializeOnFirstLaunch');
    expect(keyVaultSource).not.toContain('initializeOnFirstLaunch');
  });

  test('reset setup mode and secure navigator branch use current vault authority', () => {
    const authGateSource = readSource('navigation/AuthGate.tsx');
    const lockScreenSource = readSource('screens/LockScreen.tsx');
    const authContextSource = readSource('navigation/authContext.tsx');

    expect(authGateSource).toContain('keyVault.canMountSecureNavigator()');
    expect(authGateSource).not.toContain('initialParams');
    expect(lockScreenSource).toContain('shouldShowPinSetup');
    expect(lockScreenSource).not.toContain('route.params');
    expect(authContextSource).toContain('RESET_FAILURE');
    expect(authContextSource).toContain('return { ok: false }');
  });

  test('reset copy remains explicit, local-only, and non-recovery', () => {
    const source = readSource('screens/LockScreen.tsx');
    const enSource = readSource('i18n/en.ts');

    // Lock UI uses Hebrew i18n source keys; English copy lives in enBySource.
    expect(source).toContain(
      'לא ניתן לשחזר נתונים פיננסיים מוצפנים מקומיים אחרי איפוס ב-MVP',
    );
    expect(enSource).toContain(
      'Encrypted local financial data cannot be recovered',
    );
    expect(enSource).toContain('only wipes local data on this device');
    expect(enSource).toContain('there is no cloud financial data to delete');
  });

  test('biometric unlock remains development-gated in visible lock UI', () => {
    const source = readSource('screens/LockScreen.tsx');

    expect(source).toContain('__DEV__');
    expect(source).toContain("t('פתיחת נעילה לצורכי פיתוח')");
    expect(source).not.toContain('Unlock with biometric');
  });
});
