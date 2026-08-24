// /src/auth/index.ts
//
// Public authentication facade. This module orchestrates auth flows but owns no
// key material, KDF, vault state, lockout counter, or network dependency.

import * as LocalAuthentication from 'expo-local-authentication';
import { APP_NAME } from '../config/identity';

import {
  keyVault,
  type AuthStatus,
  type UnlockResult,
} from '../security/keyVault';

export type { AuthStatus } from '../security/keyVault';

export type AuthResult = UnlockResult;

export interface BiometricCapability {
  readonly hasHardware: boolean;
  readonly isEnrolled: boolean;
  readonly types: readonly LocalAuthentication.AuthenticationType[];
  readonly available: boolean;
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { hasHardware, isEnrolled, types, available: hasHardware && isEnrolled };
}

export async function authenticateWithBiometrics(): Promise<AuthResult> {
  const capability = await getBiometricCapability();
  if (!capability.available) {
    return { ok: false, reason: 'bad_credential' };
  }

  const prompt = await LocalAuthentication.authenticateAsync({
    // OD-2: the product name lives in identity.json. A biometric prompt is the worst place for
    // a stale name — it is the moment a user is asked to trust the app.
    promptMessage: `Unlock ${APP_NAME}`,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });

  if (!prompt.success) {
    return { ok: false, reason: 'bad_credential' };
  }

  return keyVault.unlockWithBiometric();
}

export async function enrollPin(pin: string): Promise<void> {
  await keyVault.initializeLocalVaultWithPin(pin);
}

export async function authenticateWithPin(pin: string): Promise<AuthResult> {
  return keyVault.unlockWithPin(pin);
}

export async function isInitialized(): Promise<boolean> {
  return keyVault.isInitialized();
}

export async function getAuthStatus(): Promise<AuthStatus> {
  return keyVault.getAuthStatus();
}

export function isUnlocked(): boolean {
  return keyVault.isUnlocked();
}

export function lock(): void {
  keyVault.lock();
}

export const auth = {
  isInitialized,
  getAuthStatus,
  isUnlocked,
  getBiometricCapability,
  authenticateWithBiometrics,
  enrollPin,
  authenticateWithPin,
  lock,
} as const;

export default auth;
