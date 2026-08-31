import React, { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../navigation/authContext';
import {
  cancelAllLocalNotifications,
  notificationsEnabled,
  requestLocalNotificationPermission,
  scheduleAnnualGlobalReminder,
  scheduleBillingReminder,
  scheduleDiscountReminders,
  setNotificationsEnabled,
} from '../services/notificationScheduler';
import {
  createEncryptedVaultBackup,
  importEncryptedVaultBackup,
} from '../services/vaultBackup';
import { hydrateSensitiveStores } from '../navigation/authLifecycle';
import { ACCENT, BORDER, ROLE_SURFACE_BG, SURFACE, TEXT } from '../theme/tokens';
import { useCardsStore } from '../store/useCardsStore';

const COPY = {
  he: {
    title: 'נתונים ופרטיות',
    local: 'הנתונים הפיננסיים שלך נשמרים בכספת מוצפנת במכשיר זה. למפעיל אין גישה מרחוק לכספת.',
    noCloud: 'אין גיבוי ענן אוטומטי, אין חשבון משתמש ואין העלאה לתמיכה.',
    notices: 'תזכורות מקומיות',
    export: 'ייצוא מוצפן',
    import: 'ייבוא מוצפן',
    pin: 'קוד העברה בן 4 ספרות',
    reset: 'איפוס מלא',
    resetBody: 'האיפוס מוחק את הכספת המקומית, ההעדפות, ההסכמות והתזכורות. הוא אינו מוחק קובצי ייצוא חיצוניים או רשומות של מערכת ההפעלה והחנות.',
  },
  ar: {
    title: 'البيانات والخصوصية',
    local: 'تُحفظ بياناتك المالية في خزنة مشفّرة على هذا الجهاز. لا يملك المشغّل وصولاً عن بُعد إلى الخزنة.',
    noCloud: 'لا يوجد نسخ احتياطي سحابي تلقائي، ولا حساب مستخدم، ولا رفع تلقائي للدعم.',
    notices: 'تذكيرات محلية',
    export: 'تصدير مشفّر',
    import: 'استيراد مشفّر',
    pin: 'رمز نقل من 4 أرقام',
    reset: 'إعادة ضبط كاملة',
    resetBody: 'تحذف إعادة الضبط الخزنة المحلية والتفضيلات والموافقات والتذكيرات. ولا تحذف ملفات التصدير الخارجية أو سجلات النظام والمتجر.',
  },
  en: {
    title: 'Data & Privacy',
    local: 'Your financial data is kept in an encrypted vault on this device. The Operator has no remote access to the vault.',
    noCloud: 'There is no automatic cloud backup, user account, or automatic support upload.',
    notices: 'Local reminders',
    export: 'Encrypted export',
    import: 'Encrypted import',
    pin: '4-digit transfer PIN',
    reset: 'Full Reset',
    resetBody: 'Full Reset deletes the local vault, preferences, consent state, and reminders. It cannot delete external exports or operating-system and store records.',
  },
} as const;

export function DataPrivacyScreen(): React.ReactElement {
  const { language } = useLanguage();
  const copy = COPY[language];
  const auth = useAuth();
  const cards = useCardsStore((state) => state.cards);
  const [transferPin, setTransferPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [noticesOn, setNoticesOn] = useState(() => notificationsEnabled());
  const [status, setStatus] = useState<string | null>(null);
  const validPin = /^\d{4}$/.test(transferPin);

  async function toggleNotices(): Promise<void> {
    const next = !noticesOn;
    setBusy(true);
    try {
      setNotificationsEnabled(next);
      if (next) {
        if (!(await requestLocalNotificationPermission())) {
          throw new Error('NOTIFICATION_PERMISSION_DENIED');
        }
        await scheduleAnnualGlobalReminder();
        for (const card of cards) {
          await scheduleBillingReminder(card);
          await scheduleDiscountReminders(card);
        }
      } else {
        await cancelAllLocalNotifications();
      }
      setNoticesOn(next);
      setStatus(next ? 'Local reminders enabled.' : 'Local reminders disabled.');
    } catch {
      setNotificationsEnabled(false);
      setNoticesOn(false);
      setStatus('Notification permission was not granted. Ordinary app features remain available.');
    } finally {
      setBusy(false);
    }
  }

  async function exportVault(): Promise<void> {
    if (!validPin) return;
    setBusy(true);
    setStatus(null);
    let temporaryUri: string | null = null;
    try {
      const encrypted = await createEncryptedVaultBackup(transferPin);
      temporaryUri = `${FileSystem.cacheDirectory}smartcard-vault-${Date.now()}.scvault`;
      await FileSystem.writeAsStringAsync(temporaryUri, encrypted, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('SHARING_UNAVAILABLE');
      }
      await Sharing.shareAsync(temporaryUri, {
        mimeType: 'application/octet-stream',
        dialogTitle: copy.export,
      });
      setStatus('Encrypted export created. The selected destination is outside the App.');
    } catch {
      setStatus('Encrypted export failed. No plaintext export was created.');
    } finally {
      if (temporaryUri !== null) {
        await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
      }
      setBusy(false);
    }
  }

  async function importVault(): Promise<void> {
    if (!validPin) return;
    setBusy(true);
    setStatus(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: 'application/octet-stream',
      });
      if (picked.canceled || picked.assets[0] === undefined) return;
      const encrypted = await FileSystem.readAsStringAsync(picked.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const result = await importEncryptedVaultBackup(encrypted, transferPin);
      if (!result.ok) {
        setStatus(`Import refused: ${result.reason}. Existing local data was preserved.`);
        return;
      }
      hydrateSensitiveStores();
      setStatus(`Encrypted import completed (${result.importedKeys} local records).`);
    } catch {
      setStatus('Import failed safely. Existing local data was preserved.');
    } finally {
      setBusy(false);
    }
  }

  function confirmReset(): void {
    Alert.alert(copy.reset, copy.resetBody, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: (): void => {
          Alert.alert(copy.reset, 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: copy.reset,
              style: 'destructive',
              onPress: (): void => {
                setBusy(true);
                void auth.resetLocalVault().then((result) => {
                  setBusy(false);
                  if (!result.ok) {
                    setStatus('Full Reset did not complete. Local data may still be present.');
                  }
                });
              },
            },
          ]);
        },
      },
    ]);
  }

  return (
    <RtlScreen className={SURFACE.page} safe>
      <RtlScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <AppText className={`text-[26px] font-extrabold ${TEXT.heading}`}>{copy.title}</AppText>
        <View className={`mt-4 gap-2 rounded-xl border p-4 ${BORDER.subtle} ${SURFACE.card}`}>
          <AppText className={`text-sm leading-6 ${TEXT.body}`}>{copy.local}</AppText>
          <AppText className={`text-sm leading-6 ${TEXT.secondary}`}>{copy.noCloud}</AppText>
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: noticesOn, disabled: busy }}
          className={`mt-4 min-h-[50px] justify-center rounded-xl border px-4 ${BORDER.hairline} ${SURFACE.card}`}
          disabled={busy}
          onPress={(): void => { void toggleNotices(); }}
          testID="privacy-notifications-toggle"
        >
          <RtlRow className="items-center justify-between">
            <AppText className={`font-bold ${TEXT.body}`}>{copy.notices}</AppText>
            <AppText className={`font-extrabold ${noticesOn ? ACCENT.text : TEXT.secondary}`}>
              {noticesOn ? 'ON' : 'OFF'}
            </AppText>
          </RtlRow>
        </Pressable>

        <TextInput
          accessibilityLabel={copy.pin}
          className={`mt-5 min-h-[50px] rounded-xl border px-4 ${BORDER.hairline} ${SURFACE.card} ${TEXT.body}`}
          keyboardType="number-pad"
          maxLength={4}
          onChangeText={setTransferPin}
          placeholder={copy.pin}
          secureTextEntry
          value={transferPin}
        />
        <RtlRow className="mt-3 gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || !validPin }}
            className={`min-h-[48px] flex-1 items-center justify-center rounded-xl px-3 ${ACCENT.surfaceStrong}`}
            disabled={busy || !validPin}
            onPress={(): void => { void exportVault(); }}
            testID="privacy-export"
          >
            <AppText className={`font-bold ${TEXT.body}`}>{copy.export}</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || !validPin }}
            className={`min-h-[48px] flex-1 items-center justify-center rounded-xl px-3 ${ACCENT.surfaceStrong}`}
            disabled={busy || !validPin}
            onPress={(): void => { void importVault(); }}
            testID="privacy-import"
          >
            <AppText className={`font-bold ${TEXT.body}`}>{copy.import}</AppText>
          </Pressable>
        </RtlRow>

        {status === null ? null : (
          <AppText className={`mt-4 text-sm leading-6 ${TEXT.secondary}`} testID="privacy-status">
            {status}
          </AppText>
        )}

        <View className={`mt-6 gap-3 rounded-xl p-4 ${ROLE_SURFACE_BG.danger}`}>
          <AppText className={`font-extrabold ${TEXT.heading}`}>{copy.reset}</AppText>
          <AppText className={`text-sm leading-6 ${TEXT.body}`}>{copy.resetBody}</AppText>
          <Pressable
            accessibilityRole="button"
            className="min-h-[48px] items-center justify-center rounded-xl border border-red-500 px-4"
            disabled={busy}
            onPress={confirmReset}
            testID="privacy-full-reset"
          >
            <AppText className="font-extrabold text-red-400">{copy.reset}</AppText>
          </Pressable>
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
