/**
 * CAN THIS DEVICE CREATE THE VAULT AT ALL? — asked BEFORE the vault is attempted.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE DEVICE FOUND
 *
 * P2's first run on real hardware watched PIN enrolment fail three times and could not say why,
 * because `LockScreen` discarded the reason in a bare `catch {}`. With the reason reported, it
 * named itself immediately:
 *
 *   [vault] enrollPin failed: Call to function 'ExpoSecureStore.setValueWithKeyAsync' has been
 *   rejected.  Caused by: Could not Authenticate the user: No biometrics are currently enrolled
 *
 * `expo-secure-store`'s `AuthenticationHelper.assertBiometricsSupport()` calls
 * `canAuthenticate(BIOMETRIC_STRONG)`. **`DEVICE_CREDENTIAL` is not in that call**, so on Android
 * there is no passcode fallback: a lock-screen PIN does not satisfy it. Every Android user who has
 * never enrolled a fingerprint or a strong face unlock **cannot create this app's only credential**,
 * and until the device proved otherwise `keyVault.ts` carried a comment saying they could.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE OWNER'S RULING (OQ-001, 2026-08-24) — this module is that ruling, in code
 *
 *   "Keep requireAuthentication:true. If no supported biometric is enrolled, block vault setup and
 *    guide the user to Android Settings to enroll biometric authentication, then retry.
 *    **No unauthenticated DEK fallback is permitted.**"
 *
 * So: ask first, refuse honestly, send them somewhere that fixes it, and re-check on return.
 * Nothing here weakens `DEK_OPTS`, and nothing here writes a key by another route — the failure
 * mode this must never have is a "graceful degradation" that silently produces a vault a thief can
 * open, varying by handset with nothing in the product saying so.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE BLOCK IS ANDROID-ONLY, WHICH IS NOT A LOOPHOLE
 *
 * `requireAuthentication` is **not symmetric across the platforms**. On iOS it maps to keychain
 * access control where a device passcode IS an accepted fallback, so an iOS user with a passcode
 * and no Face ID can create the vault perfectly well. Blocking them would refuse a user the OS was
 * willing to serve, on the strength of an Android limitation.
 *
 * The refusal therefore follows the actual constraint rather than a tidy cross-platform rule. On
 * iOS this reports `ready` and the enrolment attempt itself remains the authority — as it must,
 * since a pre-check can never be the last word on what the keystore will accept.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A PRE-CHECK IS ADVICE, NEVER A GUARANTEE
 *
 * Between this probe and `SecureStore.setItemAsync` the user can walk into Settings and delete
 * their fingerprint. The enrolment path keeps its own error handling and keeps reporting through
 * `reportVaultFailure`. This module exists to turn *"Try again"* into a sentence that names the
 * cause and a button that fixes it — not to replace the failure path.
 */
import { Linking, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import { reportVaultFailure } from './vaultFailure';

/**
 * Why the vault cannot be created, in terms of what the user must DO about it.
 *
 * The reasons are distinguished because the advice differs and getting it wrong wastes the user's
 * time: sending someone with no fingerprint sensor into Settings to enrol one is a dead end, and
 * telling someone who has a weak face unlock that they have "no biometrics" contradicts what their
 * own Settings screen shows them.
 */
export type EnrolmentBlockReason =
  /** No biometric sensor on this device. Settings cannot help; nothing the user does will fix it. */
  | 'no_hardware'
  /** Hardware exists, nothing enrolled. This is the common case and the one Settings fixes. */
  | 'not_enrolled'
  /** Only a WEAK biometric (e.g. 2D image face unlock). `canAuthenticate(BIOMETRIC_STRONG)` refuses it. */
  | 'weak_only'
  /** Only a lock-screen PIN/pattern/password. The exact case that produced the device failure. */
  | 'device_credential_only'
  /** The probe itself failed. Reported, and treated as blocking — see below. */
  | 'probe_failed';

export type VaultEnrolmentReadiness =
  | { readonly ready: true }
  | { readonly ready: false; readonly reason: EnrolmentBlockReason };

const READY: VaultEnrolmentReadiness = { ready: true };

/**
 * Can this device's keystore accept the DEK the vault needs?
 *
 * ON A FAILED PROBE THIS REFUSES, AND THAT DIRECTION IS DELIBERATE.
 *
 * The tempting alternative is to treat an unreadable probe as "probably fine, let the enrolment
 * decide". That trades a clear refusal the user can act on for the exact silent failure this whole
 * module exists to end — `enrollPin` throwing into a "Try again" with no cause. Failing closed here
 * costs a user with a broken probe one honest screen; failing open costs them the loop.
 */
export async function checkVaultEnrolmentReadiness(): Promise<VaultEnrolmentReadiness> {
  // iOS accepts a device passcode for this flag. See the header: the constraint is Android's.
  if (Platform.OS !== 'android') return READY;

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return { ready: false, reason: 'no_hardware' };

    /**
     * `getEnrolledLevelAsync`, NOT `isEnrolledAsync`.
     *
     * `isEnrolledAsync()` answers "is SOMETHING enrolled", and on Android that includes a
     * lock-screen PIN — which is precisely the credential `canAuthenticate(BIOMETRIC_STRONG)`
     * rejects. A gate built on it would report ready and then watch the vault fail, which is the
     * bug with an extra step.
     *
     * The level is compared against `BIOMETRIC_STRONG` because that is the literal argument
     * expo-secure-store passes. This check mirrors the library's own condition rather than
     * approximating it.
     */
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) return READY;
    if (level === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK) {
      return { ready: false, reason: 'weak_only' };
    }
    if (level === LocalAuthentication.SecurityLevel.SECRET) {
      return { ready: false, reason: 'device_credential_only' };
    }
    return { ready: false, reason: 'not_enrolled' };
  } catch (error) {
    reportVaultFailure('enrollPin', error);
    return { ready: false, reason: 'probe_failed' };
  }
}

/** Whether sending the user to Settings can actually resolve this reason. */
export function isFixableInSettings(reason: EnrolmentBlockReason): boolean {
  return reason === 'not_enrolled' || reason === 'weak_only' || reason === 'device_credential_only';
}

/**
 * Open the Android screen where a biometric is enrolled.
 *
 * `android.settings.BIOMETRIC_ENROLL` is API 30+. Below that it does not exist and the intent
 * throws, so the security settings screen is the fallback — one more tap for the user, rather than
 * a button that does nothing on older devices.
 *
 * Returns whether anything opened, so the caller can say so instead of leaving the user looking at
 * a screen that did not change.
 */
export async function openBiometricEnrolmentSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    try {
      await Linking.openSettings();
      return true;
    } catch (error) {
      reportVaultFailure('enrollPin', error);
      return false;
    }
  }

  try {
    await Linking.sendIntent('android.settings.BIOMETRIC_ENROLL');
    return true;
  } catch {
    // Not an error worth reporting on its own: on API < 30 this action simply is not there, which
    // is expected rather than exceptional. The fallback is the real attempt.
    try {
      await Linking.sendIntent('android.settings.SECURITY_SETTINGS');
      return true;
    } catch (error) {
      reportVaultFailure('enrollPin', error);
      return false;
    }
  }
}
