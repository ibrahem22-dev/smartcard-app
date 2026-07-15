// /src/navigation/authContext.tsx
//
// Auth state provider/hook, extracted from AuthGate so that LockScreen can
// consume auth state WITHOUT importing AuthGate (which would create a require
// cycle: AuthGate -> LockScreen -> AuthGate). This module imports only React +
// keyVault, so it sits cleanly below both AuthGate and LockScreen.
//
// Defaulting to LOCKED:
// - Initial status is 'UNKNOWN' (treated as locked by isUnlocked).
// - keyVault.getAuthStatus() is evaluated on mount (cold start / deep link /
//   restoration) and whenever the app returns to the foreground.
// - Leaving the foreground hides protected UI and starts the locked AUTH-07
//   in-process grace window only from a known-valid unlocked session.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { MMKV as MmkvStorage } from 'react-native-mmkv';

import { keyVault, type AuthStatus } from '../security/keyVault';
import { useProfileStore } from '../store/useProfileStore';
import {
  beginAuth07InProcessGraceOrLock,
  clearInMemoryStores,
  hydrateSensitiveStores,
  preLockClearAndLockVault,
  resolveAuth07ForegroundGrace,
} from './authLifecycle';
import { recordAuthRuntimeSnapshot } from './authRuntimeDiagnostics';

export type LocalVaultResetResult =
  | { readonly ok: true }
  | { readonly ok: false };

export interface AuthContextValue {
  readonly status: AuthStatus;
  /** True ONLY when status is the explicit 'UNLOCKED'. */
  readonly isUnlocked: boolean;
  readonly isBootstrapping: boolean;
  readonly hasLocalVault: boolean;
  readonly isOnboardingComplete: boolean;
  /** Re-evaluate auth state via the key vault (defaults to LOCKED on failure). */
  readonly evaluate: () => Promise<void>;
  /** TEMP: debug-only unlock — stripped from production builds. */
  readonly debugUnlock?: () => Promise<void>;
  /** Force lock (background, timeout, sign-out). */
  readonly lock: () => Promise<void>;
  readonly completeOnboarding: () => void;
  readonly resetLocalVault: () => Promise<LocalVaultResetResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const onboardingStorage = new MmkvStorage({ id: 'onboarding-temp' });

export function AuthProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  // Cold start defaults to LOCKED via 'UNKNOWN' (never 'UNLOCKED').
  const [status, setStatus] = useState<AuthStatus>('UNKNOWN');
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  const [hasLocalVault, setHasLocalVault] = useState<boolean>(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(
    () => onboardingStorage.getBoolean('onboarding_complete') ?? false,
  );

  const evaluate = useCallback(async (): Promise<void> => {
    try {
      const initialized = await keyVault.isInitialized();
      setHasLocalVault(initialized);
      const reportedStatus = await keyVault.getAuthStatus();
      const canMountSecureNavigator = keyVault.canMountSecureNavigator();
      const next =
        initialized &&
        reportedStatus === 'UNLOCKED' &&
        canMountSecureNavigator
          ? 'UNLOCKED'
          : 'LOCKED';
      if (next !== 'UNLOCKED') {
        clearInMemoryStores();
      } else {
        hydrateSensitiveStores();
        // Fresh vault after wipe/re-enroll can leave a stale onboarding-temp
        // flag (unencrypted MMKV). Without profiles, resume onboarding.
        const profilesEmpty =
          useProfileStore.getState().allProfiles.length === 0;
        if (
          profilesEmpty &&
          (onboardingStorage.getBoolean('onboarding_complete') ?? false)
        ) {
          onboardingStorage.delete('onboarding_complete');
          setIsOnboardingComplete(false);
        }
      }
      setStatus(next);
      recordAuthRuntimeSnapshot('EVALUATE', {
        status: next,
        hasLocalVault: initialized,
        canMountSecureNavigator,
      });
    } catch {
      // Any failure is treated as locked -- never optimistically unlock.
      clearInMemoryStores();
      setStatus('LOCKED');
      recordAuthRuntimeSnapshot('EVALUATE', {
        status: 'LOCKED',
        hasLocalVault: false,
        canMountSecureNavigator: false,
      });
    } finally {
      setIsBootstrapping(false);
    }
  }, []);

  const debugUnlock = useCallback(async (): Promise<void> => {
    if (!__DEV__) {
      return;
    }
    await keyVault.unlockWithBiometric();
    await evaluate();
  }, [evaluate]);
  
  const lock = useCallback(async (): Promise<void> => {
    preLockClearAndLockVault();
    setStatus('LOCKED');
  }, []);

  const completeOnboarding = useCallback((): void => {
    onboardingStorage.set('onboarding_complete', true);
    setIsOnboardingComplete(true);
  }, []);

  const resetLocalVault = useCallback(async (): Promise<LocalVaultResetResult> => {
    clearInMemoryStores();
    try {
      await keyVault.wipeVault();
      if (
        (await keyVault.isInitialized()) ||
        keyVault.canMountSecureNavigator()
      ) {
        throw new Error('LOCAL_VAULT_RESET_VERIFICATION_FAILED');
      }
      onboardingStorage.delete('onboarding_complete');
      setIsOnboardingComplete(false);
      setHasLocalVault(false);
      setStatus('LOCKED');
      setIsBootstrapping(false);
      recordAuthRuntimeSnapshot('RESET_SUCCESS', {
        status: 'LOCKED',
        hasLocalVault: false,
        canMountSecureNavigator: false,
      });
      return { ok: true };
    } catch {
      keyVault.lock();
      clearInMemoryStores();
      // A failed wipe must not transition into fresh setup. Keep the locked
      // branch visible so the user can retry the explicit local reset.
      setHasLocalVault(true);
      setStatus('LOCKED');
      recordAuthRuntimeSnapshot('RESET_FAILURE', {
        status: 'LOCKED',
        hasLocalVault: true,
        canMountSecureNavigator: false,
      });
      return { ok: false };
    }
  }, []);

  // Evaluate on mount (cold start / deep link entry / restoration).
  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  const handleAppStateChange = useCallback(
    async (next: AppStateStatus): Promise<void> => {
      if (next === 'active') {
        const graceResult = resolveAuth07ForegroundGrace();
        if (graceResult === 'RESTORE_UNLOCKED') {
          const initialized = await keyVault.isInitialized();
          const canMountSecureNavigator = keyVault.canMountSecureNavigator();
          if (!canMountSecureNavigator) {
            preLockClearAndLockVault();
            setHasLocalVault(initialized);
            setStatus('LOCKED');
            setIsBootstrapping(false);
            recordAuthRuntimeSnapshot('AUTH07_FOREGROUND_LOCK', {
              status: 'LOCKED',
              hasLocalVault: initialized,
              canMountSecureNavigator: false,
            });
            return;
          }
          if (!(await keyVault.isInitialized())) {
            preLockClearAndLockVault();
            setHasLocalVault(false);
            setStatus('LOCKED');
            setIsBootstrapping(false);
            recordAuthRuntimeSnapshot('AUTH07_FOREGROUND_LOCK', {
              status: 'LOCKED',
              hasLocalVault: false,
              canMountSecureNavigator: false,
            });
            return;
          }
          setHasLocalVault(initialized);
          setStatus('UNLOCKED');
          setIsBootstrapping(false);
          recordAuthRuntimeSnapshot('AUTH07_FOREGROUND_RESTORE', {
            status: 'UNLOCKED',
            hasLocalVault: initialized,
            canMountSecureNavigator,
          });
          return;
        }

        if (graceResult === 'LOCKED') {
          const initialized = await keyVault.isInitialized();
          setHasLocalVault(initialized);
          setStatus('LOCKED');
          setIsBootstrapping(false);
          recordAuthRuntimeSnapshot('AUTH07_FOREGROUND_LOCK', {
            status: 'LOCKED',
            hasLocalVault: initialized,
            canMountSecureNavigator: false,
          });
          return;
        }

        await evaluate();
        return;
      }

      const backgroundResult = beginAuth07InProcessGraceOrLock(
        status === 'UNLOCKED',
      );
      const nextStatus =
        backgroundResult === 'GRACE_STARTED' ? 'UNKNOWN' : 'LOCKED';
      setStatus(nextStatus);
      recordAuthRuntimeSnapshot('AUTH07_BACKGROUND', {
        status: nextStatus,
        hasLocalVault,
        canMountSecureNavigator: keyVault.canMountSecureNavigator(),
      });
    },
    [evaluate, hasLocalVault, status],
  );

  // Re-evaluate on foreground unless a valid in-process AUTH-07 grace restore is
  // available. Leaving foreground always hides protected UI immediately.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        void handleAppStateChange(next);
      },
    );
    return () => subscription.remove();
  }, [handleAppStateChange]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isUnlocked: status === 'UNLOCKED',
      isBootstrapping,
      hasLocalVault,
      isOnboardingComplete,
      evaluate,
      ...(__DEV__ ? { debugUnlock } : {}),
      lock,
      completeOnboarding,
      resetLocalVault,
    }),
    [
      status,
      isBootstrapping,
      hasLocalVault,
      isOnboardingComplete,
      evaluate,
      debugUnlock,
      lock,
      completeOnboarding,
      resetLocalVault,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
