export type AuthGateBranch = 'LOCK' | 'ONBOARDING' | 'AUTHENTICATED';

export interface AuthGateSnapshot {
  readonly isBootstrapping: boolean;
  readonly hasLocalVault: boolean;
  readonly isUnlocked: boolean;
  readonly isOnboardingComplete: boolean;
  readonly canMountSecureNavigator: boolean;
}

export function resolveAuthGateBranch({
  isBootstrapping,
  hasLocalVault,
  isUnlocked,
  isOnboardingComplete,
  canMountSecureNavigator,
}: AuthGateSnapshot): AuthGateBranch {
  if (
    isBootstrapping ||
    !hasLocalVault ||
    !isUnlocked ||
    !canMountSecureNavigator
  ) {
    return 'LOCK';
  }

  return isOnboardingComplete ? 'AUTHENTICATED' : 'ONBOARDING';
}

export function shouldShowPinSetup(
  isBootstrapping: boolean,
  hasLocalVault: boolean,
): boolean {
  return !isBootstrapping && !hasLocalVault;
}
