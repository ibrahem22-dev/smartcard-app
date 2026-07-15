import type { AuthStatus } from '../security/keyVault';

type AuthRuntimeEvent =
  | 'AUTH_GATE_LOCK'
  | 'AUTH_GATE_ONBOARDING'
  | 'AUTH_GATE_AUTHENTICATED'
  | 'EVALUATE'
  | 'RESET_FAILURE'
  | 'RESET_SUCCESS'
  | 'AUTH07_FOREGROUND_LOCK'
  | 'AUTH07_FOREGROUND_RESTORE'
  | 'AUTH07_BACKGROUND';

interface AuthRuntimeSnapshot {
  readonly status: AuthStatus;
  readonly hasLocalVault: boolean;
  readonly canMountSecureNavigator: boolean;
}

/** Development-only, non-secret branch evidence for QA-AUTH07-DEVICE-001. */
export function recordAuthRuntimeSnapshot(
  event: AuthRuntimeEvent,
  snapshot: AuthRuntimeSnapshot,
): void {
  if (!__DEV__) {
    return;
  }

  console.info(
    '[AUTH07_DEVICE]',
    JSON.stringify({ event, ...snapshot }),
  );
}
