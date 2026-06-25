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
// - Leaving the foreground drops back to 'UNKNOWN' (locked), so restoration
//   always re-evaluates and never resumes UNLOCKED implicitly.

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

export interface AuthContextValue {
  readonly status: AuthStatus;
  /** True ONLY when status is the explicit 'UNLOCKED'. */
  readonly isUnlocked: boolean;
  readonly isOnboardingComplete: boolean;
  /** Re-evaluate auth state via the key vault (defaults to LOCKED on failure). */
  readonly evaluate: () => Promise<void>;
  /** TEMP: debug-only unlock — stripped from production builds. */
  readonly debugUnlock?: () => Promise<void>;
  /** Force lock (background, timeout, sign-out). */
  readonly lock: () => Promise<void>;
  readonly completeOnboarding: () => void;
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
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(
    () => onboardingStorage.getBoolean('onboarding_complete') ?? false,
  );

  const evaluate = useCallback(async (): Promise<void> => {
    try {
      const next = await keyVault.getAuthStatus();
      setStatus(next);
    } catch {
      // Any failure is treated as locked -- never optimistically unlock.
      setStatus('LOCKED');
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
    await keyVault.lock();
    setStatus('LOCKED');
  }, []);

  const completeOnboarding = useCallback((): void => {
    onboardingStorage.set('onboarding_complete', true);
    setIsOnboardingComplete(true);
  }, []);

  // Evaluate on mount (cold start / deep link entry / restoration).
  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  // Re-evaluate on foreground; re-lock (to UNKNOWN) when leaving foreground so
  // restoration always passes back through the gate before showing finances.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next === 'active') {
          void evaluate();
        } else {
          setStatus('UNKNOWN');
        }
      },
    );
    return () => subscription.remove();
  }, [evaluate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isUnlocked: status === 'UNLOCKED',
      isOnboardingComplete,
      evaluate,
      ...(__DEV__ ? { debugUnlock } : {}),
      lock,
      completeOnboarding,
    }),
    [
      status,
      isOnboardingComplete,
      evaluate,
      debugUnlock,
      lock,
      completeOnboarding,
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
