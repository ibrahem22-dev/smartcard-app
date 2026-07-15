import { keyVault } from '../security/keyVault';
import { useCardsStore } from '../store/useCardsStore';
import { useLoansStore } from '../store/useLoansStore';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';

export const AUTH_07_GRACE_WINDOW_MS = 5 * 60 * 1000;

export type Auth07BackgroundResult = 'GRACE_STARTED' | 'LOCKED';
export type Auth07ForegroundResult =
  | 'RESTORE_UNLOCKED'
  | 'LOCKED'
  | 'NO_GRACE';

let inactiveSinceMs: number | null = null;
let graceSessionKnownValid = false;

export function clearInMemoryStores(): void {
  useUserStore.getState().clearProfile();
  useCardsStore.getState().clearCards();
  useLoansStore.getState().clearLoans();
  useProfileStore.getState().clearProfiles();
}

export function hydrateSensitiveStores(): void {
  useProfileStore.getState().hydrate();
}

export function preLockClearAndLockVault(): void {
  keyVault.lock();
  clearInMemoryStores();
}

function isValidTimestamp(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function resetInProcessGrace(): void {
  inactiveSinceMs = null;
  graceSessionKnownValid = false;
}

export function beginAuth07InProcessGraceOrLock(
  sessionKnownValid: boolean,
  nowMs: number = Date.now(),
): Auth07BackgroundResult {
  if (
    !sessionKnownValid &&
    graceSessionKnownValid &&
    inactiveSinceMs !== null &&
    isValidTimestamp(inactiveSinceMs) &&
    keyVault.canMountSecureNavigator()
  ) {
    clearInMemoryStores();
    return 'GRACE_STARTED';
  }

  const canStartGrace =
    sessionKnownValid &&
    keyVault.canMountSecureNavigator() &&
    isValidTimestamp(nowMs);

  if (!canStartGrace) {
    resetInProcessGrace();
    preLockClearAndLockVault();
    return 'LOCKED';
  }

  inactiveSinceMs = nowMs;
  graceSessionKnownValid = true;
  clearInMemoryStores();
  return 'GRACE_STARTED';
}

export function resolveAuth07ForegroundGrace(
  nowMs: number = Date.now(),
): Auth07ForegroundResult {
  if (inactiveSinceMs === null && !graceSessionKnownValid) {
    return 'NO_GRACE';
  }

  const startedAtMs = inactiveSinceMs;
  const elapsedMs =
    startedAtMs === null || !isValidTimestamp(startedAtMs)
      ? Number.POSITIVE_INFINITY
      : nowMs - startedAtMs;

  const canRestore =
    graceSessionKnownValid &&
    startedAtMs !== null &&
    isValidTimestamp(nowMs) &&
    elapsedMs >= 0 &&
    elapsedMs <= AUTH_07_GRACE_WINDOW_MS &&
    keyVault.canMountSecureNavigator();

  if (!canRestore) {
    resetInProcessGrace();
    preLockClearAndLockVault();
    return 'LOCKED';
  }

  resetInProcessGrace();
  hydrateSensitiveStores();
  return 'RESTORE_UNLOCKED';
}

export function __resetAuth07GraceForTests(): void {
  resetInProcessGrace();
}

export function __setAuth07GraceForTests(state: {
  readonly inactiveSinceMs: number | null;
  readonly sessionKnownValid: boolean;
}): void {
  inactiveSinceMs = state.inactiveSinceMs;
  graceSessionKnownValid = state.sessionKnownValid;
}
