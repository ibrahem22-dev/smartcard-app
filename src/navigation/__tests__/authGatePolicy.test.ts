import {
  resolveAuthGateBranch,
  shouldShowPinSetup,
} from '../authGatePolicy';

describe('AuthGate vault authority policy', () => {
  test('fails closed when stale UI unlock state lacks vault mount authority', () => {
    const branch = resolveAuthGateBranch({
      isBootstrapping: false,
      hasLocalVault: true,
      isUnlocked: true,
      isOnboardingComplete: true,
      canMountSecureNavigator: false,
    });

    expect(branch).toBe('LOCK');
  });

  test('permits authenticated registration only with known unlocked vault authority', () => {
    const branch = resolveAuthGateBranch({
      isBootstrapping: false,
      hasLocalVault: true,
      isUnlocked: true,
      isOnboardingComplete: true,
      canMountSecureNavigator: true,
    });

    expect(branch).toBe('AUTHENTICATED');
  });

  test('drives fresh PIN setup from current vault state rather than route params', () => {
    expect(shouldShowPinSetup(false, false)).toBe(true);
    expect(shouldShowPinSetup(false, true)).toBe(false);
    expect(shouldShowPinSetup(true, false)).toBe(false);
  });
});
