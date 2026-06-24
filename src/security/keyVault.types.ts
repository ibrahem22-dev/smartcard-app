// /src/security/keyVault.types.ts
//
// Shared auth + lockout types for SmartCard security primitives.

export interface EncryptedStorageHandle {
  getString(key: string): string | undefined;
  set(key: string, value: string | number | boolean): void;
  delete(key: string): void;
  getAllKeys(): readonly string[];
  getUserProfile(): import('../types/user.types').UserProfile | undefined;
  setUserProfile(profile: import('../types/user.types').UserProfile): void;
}

export type AuthStatus = 'LOCKED' | 'UNLOCKED' | 'UNKNOWN';

export type UnlockResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: 'bad_credential' | 'locked_out';
      readonly retryAfterMs?: number;
    };

export type BiometricUnlockResult = UnlockResult;

export interface KeyVault {
  isInitialized(): Promise<boolean>;
  initializeOnFirstLaunch(): Promise<void>;
  unlockWithBiometric(): Promise<BiometricUnlockResult>;
  unlockWithPin(pin: string): Promise<UnlockResult>;
  getEncryptedStorage(): EncryptedStorageHandle;
  lock(): void;
}

export interface KdfOptions {
  readonly algorithm: 'Argon2id';
  readonly timeCost: number;
  readonly memoryCost: number;
  readonly parallelism: number;
  readonly saltBytes: number;
  readonly keyBytes: number;
}

export interface KdfResult {
  readonly keyHex: string;
}

export type LockoutCaller = 'pin' | 'biometric';

export interface ClearLockoutState {
  readonly tier: 'clear';
  readonly failures: 0 | 1 | 2 | 3 | 4;
  readonly lastFailureMonotonicMs: number;
  readonly lastFailureWallMs: number;
  readonly lockedUntilMs: 0;
  readonly isTerminalLock: false;
}

export interface BackoffLockoutState {
  readonly tier: 'backoff';
  readonly failures: 5 | 6 | 7 | 8 | 9;
  readonly lastFailureMonotonicMs: number;
  readonly lastFailureWallMs: number;
  readonly lockedUntilMs: 0;
  readonly isTerminalLock: false;
}

export interface TerminalLockoutState {
  readonly tier: 'terminal';
  readonly failures: number;
  readonly lastFailureMonotonicMs: number;
  readonly lastFailureWallMs: number;
  readonly lockedUntilMs: number;
  readonly isTerminalLock: true;
}

export type LockoutState =
  | ClearLockoutState
  | BackoffLockoutState
  | TerminalLockoutState;
