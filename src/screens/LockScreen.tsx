import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authenticateWithPin, enrollPin } from '../auth';
import { reportVaultFailure } from '../security/vaultFailure';
import {
  checkVaultEnrolmentReadiness,
  isFixableInSettings,
  openBiometricEnrolmentSettings,
  type EnrolmentBlockReason,
  type VaultEnrolmentReadiness,
} from '../security/biometricEnrolment';
import { AppText } from '../components/AppText';
import { useAppDirection } from '../hooks/useAppDirection';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../navigation/authContext';
import { shouldShowPinSetup } from '../navigation/authGatePolicy';
import { CHROME } from '../theme/tokens';
import { APP_NAME } from '../config/identity';

/**
 * Lock / PIN-setup uses StyleSheet (not NativeWind) for critical surfaces.
 * Device smoke (T-15) showed NativeWind title/input styles failing to paint
 * on this screen while other screens were fine.
 */
export function LockScreen(): React.ReactElement {
  const { t } = useTranslation();
  const authContext = useAuth();
  const { isRTL, textAlign, writingDirection } = useAppDirection();
  const [pin, setPin] = useState('');
  const [pinConfirmation, setPinConfirmation] = useState('');
  const [unlockPin, setUnlockPin] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const isPinSetup = shouldShowPinSetup(
    authContext.isBootstrapping,
    authContext.hasLocalVault,
  );

  /**
   * OQ-001: CAN THIS DEVICE CREATE THE VAULT AT ALL?
   *
   * `null` means "not asked yet", and it is a third state rather than an optimistic default: the
   * setup form must not flash into view and then be pulled away, and it must not be usable during
   * the probe. See `src/security/biometricEnrolment.ts` for what the device proved and why the
   * Owner's ruling requires a refusal here rather than a fallback.
   */
  const [enrolment, setEnrolment] = useState<VaultEnrolmentReadiness | null>(null);
  const [isOpeningSettings, setIsOpeningSettings] = useState(false);

  const probeEnrolment = useCallback(async (): Promise<VaultEnrolmentReadiness> => {
    const result = await checkVaultEnrolmentReadiness();
    setEnrolment(result);
    return result;
  }, []);

  /**
   * Probed on entry, and again every time the app comes back to the foreground.
   *
   * The foreground re-probe is the *"then retry"* half of the ruling. The user is sent to Settings,
   * enrols a fingerprint, and returns — and if nothing re-asked, they would come back to the same
   * refusal and conclude the app is broken. A manual retry button exists too, because relying on an
   * `AppState` transition that some launchers do not deliver would put the user in a dead end.
   */
  useEffect((): (() => void) | undefined => {
    if (!isPinSetup) return undefined;
    void probeEnrolment();
    const subscription = AppState.addEventListener('change', (next): void => {
      if (next === 'active') void probeEnrolment();
    });
    return (): void => subscription.remove();
  }, [isPinSetup, probeEnrolment]);

  function sanitizePin(value: string): string {
    return value.replace(/\D/g, '').slice(0, 6);
  }

  /** What the user must actually do, per reason. One sentence, no error codes. */
  function enrolmentMessage(reason: EnrolmentBlockReason): string {
    if (reason === 'no_hardware') {
      return t(
        'במכשיר זה אין חיישן ביומטרי, ולכן לא ניתן ליצור כספת מקומית מאובטחת. {{app}} דורש טביעת אצבע או זיהוי פנים חזק כדי להגן על מפתח ההצפנה.',
        { app: APP_NAME },
      );
    }
    if (reason === 'weak_only') {
      return t(
        'זיהוי הפנים במכשיר זה מוגדר כאבטחה חלשה, ואינו מספיק להגנה על מפתח ההצפנה. הוסף טביעת אצבע או זיהוי פנים חזק בהגדרות ונסה שוב.',
      );
    }
    if (reason === 'device_credential_only') {
      return t(
        'קוד הנעילה של המכשיר אינו מספיק. {{app}} מגן על מפתח ההצפנה בעזרת טביעת אצבע או זיהוי פנים חזק — הוסף אחד מהם בהגדרות ונסה שוב.',
        { app: APP_NAME },
      );
    }
    if (reason === 'probe_failed') {
      return t(
        'לא הצלחנו לבדוק את הגדרות האבטחה של המכשיר. ודא שטביעת אצבע או זיהוי פנים מוגדרים בהגדרות ונסה שוב.',
      );
    }
    return t(
      'כדי ליצור כספת מקומית מאובטחת יש להגדיר תחילה טביעת אצבע או זיהוי פנים במכשיר. {{app}} משתמש בהם כדי להגן על מפתח ההצפנה.',
      { app: APP_NAME },
    );
  }

  async function goEnrol(): Promise<void> {
    setIsOpeningSettings(true);
    try {
      const opened = await openBiometricEnrolmentSettings();
      if (!opened) {
        setSetupError(t('לא הצלחנו לפתוח את ההגדרות. פתח אותן ידנית והוסף טביעת אצבע או זיהוי פנים.'));
      }
    } finally {
      setIsOpeningSettings(false);
    }
  }

  async function savePin(): Promise<void> {
    if (pin.length !== 6 || pinConfirmation.length !== 6) {
      setSetupError(t('הזן PIN בן 6 ספרות.'));
      return;
    }

    if (pin !== pinConfirmation) {
      setSetupError(t('ערכי ה-PIN אינם תואמים.'));
      return;
    }

    setSetupError(null);
    setIsSaving(true);

    try {
      /**
       * RE-ASKED HERE, not trusted from the render.
       *
       * The screen's probe can be minutes old, and a user can remove their fingerprint in Settings
       * between the two moments. This costs one cheap call and turns a keystore rejection the user
       * cannot read into the same actionable screen they would have seen on entry.
       *
       * It is not a substitute for the enrolment path's own error handling — a pre-check can never
       * be the last word on what the keystore will accept — which is why the `catch` below stays.
       */
      const readiness = await probeEnrolment();
      if (!readiness.ready) {
        setSetupError(enrolmentMessage(readiness.reason));
        return;
      }

      await enrollPin(pin);
      setPin('');
      setPinConfirmation('');
      await authContext.evaluate();
    } catch (error) {
      /**
       * THE CAUSE IS REPORTED, NOT SWALLOWED.
       *
       * This was a bare `catch {}`. On a device it produced "Try again" forever with nothing
       * anywhere saying why — the P2 device lane hit exactly that and could not diagnose a failing
       * vault enrolment, because the only record of the reason was discarded at the moment it was
       * created.
       *
       * The USER still reads the same sentence: a keystore failure is not something they can act
       * on. What changes is that the reason reaches the log, where a developer or a support
       * conversation can find it. **The message only** — never the PIN, never key material, and
       * never the error object, which can carry the value that was attempted.
       */
      reportVaultFailure('enrollPin', error);
      setSetupError(t('לא הצלחנו לשמור את ה-PIN המקומי. נסה שוב.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function unlockWithPin(): Promise<void> {
    if (unlockPin.length !== 6) {
      setUnlockError(t('הזן את ה-PIN בן 6 הספרות שלך.'));
      return;
    }

    setUnlockError(null);
    setIsUnlocking(true);

    try {
      const result = await authenticateWithPin(unlockPin);
      if (!result.ok) {
        const retrySeconds =
          result.retryAfterMs === undefined
            ? null
            : Math.ceil(result.retryAfterMs / 1000);
        setUnlockError(
          result.reason === 'locked_out' && retrySeconds !== null
            ? t('נסה שוב בעוד {{seconds}} שניות.', {
                seconds: retrySeconds,
              })
            : t('PIN שגוי.'),
        );
        return;
      }

      setUnlockPin('');
      await authContext.evaluate();
    } catch (error) {
      // Same reasoning as the enrolment path above: the sentence a user reads is unchanged, and
      // the reason stops being destroyed.
      reportVaultFailure('unlockWithPin', error);
      setUnlockError(t('לא הצלחנו לפתוח את הכספת המקומית. נסה שוב.'));
    } finally {
      setIsUnlocking(false);
    }
  }

  function confirmLocalReset(): void {
    Alert.alert(
      t('לאפס את הכספת המקומית?'),
      t(
        'לא ניתן לשחזר נתונים פיננסיים מוצפנים מקומיים אחרי איפוס ב-MVP. פעולה זו מוחקת רק נתונים מקומיים במכשיר זה; אין נתונים פיננסיים בענן למחיקה.',
      ),
      [
        { text: t('ביטול'), style: 'cancel' },
        {
          text: t('איפוס'),
          style: 'destructive',
          onPress: (): void => {
            void resetLocalVault();
          },
        },
      ],
    );
  }

  async function resetLocalVault(): Promise<void> {
    setResetError(null);
    const result = await authContext.resetLocalVault();
    if (!result.ok) {
      setResetError(t('לא הצלחנו לאפס את הכספת המקומית. נסה שוב.'));
    }
  }

  if (authContext.isBootstrapping) {
    return <SafeAreaView style={styles.root} />;
  }

  /**
   * OQ-001 — THE VAULT CANNOT BE CREATED ON THIS DEVICE YET, AND THE USER IS TOLD SO.
   *
   * This screen replaces the setup form; it does not sit beside it. Leaving the PIN fields
   * reachable would invite the user to type a credential into something that is going to refuse
   * them, which is the loop the device lane spent an afternoon inside.
   *
   * The button is the fix, not an acknowledgement. Returning from Settings re-probes automatically
   * (see the `AppState` listener above) and the manual retry is there for the launchers that never
   * deliver that transition.
   */
  if (isPinSetup && enrolment !== null && !enrolment.ready) {
    const fixable = isFixableInSettings(enrolment.reason);
    return (
      <SafeAreaView
        key={isRTL ? 'enrol-rtl' : 'enrol-ltr'}
        style={styles.root}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.form}>
            <View style={styles.copyBlock}>
              <AppText style={styles.title}>
                {t('נדרשת הגדרת אימות ביומטרי')}
              </AppText>
              <AppText style={[styles.subtitle, { textAlign, writingDirection }]}>
                {enrolmentMessage(enrolment.reason)}
              </AppText>
            </View>

            {setupError !== null ? (
              <AppText style={styles.error}>{setupError}</AppText>
            ) : null}

            {fixable ? (
              <Pressable
                accessibilityRole="button"
                disabled={isOpeningSettings}
                onPress={(): void => {
                  void goEnrol();
                }}
                style={styles.primaryButton}
              >
                <AppText style={styles.primaryButtonText}>
                  {isOpeningSettings ? t('פותח…') : t('פתח הגדרות')}
                </AppText>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={(): void => {
                void probeEnrolment();
              }}
              style={styles.secondaryButton}
            >
              <AppText style={styles.secondaryButtonText}>{t('בדוק שוב')}</AppText>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /**
   * The probe has not answered yet. A blank screen for a fraction of a second, rather than a setup
   * form that may be about to disappear — and, more importantly, rather than PIN fields that are
   * live before anyone has established the vault can be created at all.
   */
  if (isPinSetup && enrolment === null) {
    return <SafeAreaView key="enrol-probing" style={styles.root} />;
  }

  if (isPinSetup) {
    return (
      <SafeAreaView
        key={isRTL ? 'pin-setup-rtl' : 'pin-setup-ltr'}
        style={styles.root}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.form}>
              <View style={styles.copyBlock}>
                <AppText style={styles.title}>{t('צור PIN מקומי')}</AppText>
                <AppText style={styles.subtitle}>
                  {t('ה-PIN הוא אימות הגישה העיקרי לכספת {{app}} המקומית שלך.', { app: APP_NAME })}
                </AppText>
              </View>

              <TextInput
                accessibilityLabel={t('PIN')}
                autoFocus
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value): void => setPin(sanitizePin(value))}
                placeholder={t('PIN')}
                placeholderTextColor={CHROME.subtle}
                secureTextEntry
                style={[
                  styles.input,
                  { textAlign, writingDirection },
                ]}
                value={pin}
              />

              <TextInput
                accessibilityLabel={t('אימות PIN')}
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value): void =>
                  setPinConfirmation(sanitizePin(value))
                }
                placeholder={t('אימות PIN')}
                placeholderTextColor={CHROME.subtle}
                secureTextEntry
                style={[
                  styles.input,
                  { textAlign, writingDirection },
                ]}
                value={pinConfirmation}
              />

              {setupError !== null ? (
                <AppText style={styles.error}>{setupError}</AppText>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => {
                  void savePin();
                }}
                style={styles.primaryButton}
              >
                <AppText style={styles.primaryButtonText}>
                  {isSaving ? t('שומר…') : t('שמור PIN')}
                </AppText>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      key={isRTL ? 'lock-rtl' : 'lock-ltr'}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <AppText align="center" style={styles.title}>
            {t('פתיחת {{app}}', { app: APP_NAME })}
          </AppText>

          <TextInput
            accessibilityLabel={t('PIN')}
            autoFocus
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(value): void => setUnlockPin(sanitizePin(value))}
            placeholder={t('PIN')}
            placeholderTextColor={CHROME.subtle}
            secureTextEntry
            style={[styles.input, styles.inputCentered]}
            value={unlockPin}
          />

          {unlockError !== null ? (
            <AppText align="center" style={styles.error}>
              {unlockError}
            </AppText>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isUnlocking}
            onPress={() => {
              void unlockWithPin();
            }}
            style={styles.primaryButton}
          >
            <AppText style={styles.primaryButtonText}>
              {isUnlocking ? t('פותח…') : t('פתח עם PIN')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={confirmLocalReset}
            style={styles.secondaryButton}
          >
            <AppText align="center" style={styles.secondaryButtonText}>
              {t('שכחת PIN או אפס כספת מקומית')}
            </AppText>
          </Pressable>

          {resetError !== null ? (
            <AppText align="center" style={styles.error}>
              {resetError}
            </AppText>
          ) : null}

          {__DEV__ && authContext.debugUnlock !== undefined ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void authContext.debugUnlock?.();
              }}
              style={styles.devButton}
            >
              <AppText align="center" style={styles.primaryButtonText}>
                {t('פתיחת נעילה לצורכי פיתוח')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CHROME.ink,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 32,
  },
  form: {
    width: '100%',
    gap: 20,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  copyBlock: {
    gap: 8,
  },
  title: {
    color: CHROME.white,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: CHROME.hairline,
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CHROME.inkDark,
    backgroundColor: CHROME.surfaceDark,
    paddingHorizontal: 16,
    fontSize: 20,
    letterSpacing: 8,
    color: CHROME.white,
  },
  inputCentered: {
    textAlign: 'center',
  },
  error: {
    color: CHROME.dangerSoft,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: CHROME.accent,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: CHROME.white,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: CHROME.hairline,
    fontSize: 14,
    fontWeight: '700',
  },
  devButton: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: CHROME.inkMuted,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
});
