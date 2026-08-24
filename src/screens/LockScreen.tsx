import React, { useState } from 'react';
import {
  Alert,
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

  function sanitizePin(value: string): string {
    return value.replace(/\D/g, '').slice(0, 6);
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
      await enrollPin(pin);
      setPin('');
      setPinConfirmation('');
      await authContext.evaluate();
    } catch {
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
    } catch {
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
