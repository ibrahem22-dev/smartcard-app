import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlScrollView, RtlScreen } from '../components/rtl';
import { useAppDirection } from '../hooks/useAppDirection';
import { useTranslation } from '../hooks/useTranslation';
import {
  createEncryptedVaultExport,
  importEncryptedVaultExport,
  type VaultImportFailureReason,
} from '../services/vaultExportImport';
import { useProfileStore } from '../store/useProfileStore';
import { ACCENT, BORDER, SURFACE, TEXT } from '../theme/tokens';

export const VAULT_TRANSFER_PROTECTION_TEXT =
  'הסיסמה מגינה על כל הנתונים הפיננסיים המיוצאים מהכספת. בלעדיה אי אפשר לפענח את הגיבוי, ואי אפשר לשחזר אותה.';

const importFailureText: Readonly<Record<VaultImportFailureReason, string>> = {
  PASSPHRASE_TOO_SHORT: 'הסיסמה קצרה מ-12 תווים. הכספת לא השתנתה.',
  INVALID_BASE64: 'הגיבוי אינו אריזת Base64 תקינה. הכספת לא השתנתה.',
  TRUNCATED_ENVELOPE: 'הגיבוי המוצפן נקטע. הכספת לא השתנתה.',
  PAYLOAD_TOO_LARGE: 'הגיבוי גדול מהמגבלה המותרת. הכספת לא השתנתה.',
  UNSUPPORTED_ENVELOPE_VERSION:
    'גיבוי בגרסת הצפנה 1 אינו נתמך. הכספת לא השתנתה.',
  CRYPTOGRAPHIC_VALIDATION_FAILED:
    'האימות ההצפנתי נכשל. הסיסמה שגויה או שהאריזה המוצפנת שונתה. הכספת לא השתנתה.',
  MALFORMED_BACKUP: 'מבנה הגיבוי אינו תקין. הכספת לא השתנתה.',
  UNSUPPORTED_SCHEMA: 'סוג הגיבוי אינו נתמך. הכספת לא השתנתה.',
  UNSUPPORTED_VERSION: 'גרסת מבנה הגיבוי אינה נתמכת. הכספת לא השתנתה.',
  APPLY_FAILED_NO_MUTATION: 'הייבוא נכשל לפני כתיבה. הכספת לא השתנתה.',
  APPLY_FAILED_ROLLED_BACK:
    'הייבוא נכשל ותמונת המצב הקודמת שוחזרה ואומתה.',
  APPLY_FAILED_ROLLBACK_FAILED:
    'הייבוא והשחזור נכשלו. יש להפסיק להשתמש באפליקציה ולפנות לתמיכה.',
};

export function VaultExportImportScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { textAlign, writingDirection } = useAppDirection();
  const [passphrase, setPassphrase] = useState('');
  const [encryptedExport, setEncryptedExport] = useState('');
  const [importEnvelope, setImportEnvelope] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function createExport(): Promise<void> {
    setIsWorking(true);
    setStatus(null);
    try {
      const envelope = await createEncryptedVaultExport(passphrase);
      setEncryptedExport(envelope);
      setStatus(
        t('נוצר גיבוי מוצפן. רק האריזה המוצפנת מוצגת להעתקה.'),
      );
    } catch (error) {
      setStatus(
        t(
          error instanceof Error &&
            error.message === 'TRANSFER_PASSPHRASE_TOO_SHORT'
            ? 'הסיסמה קצרה מ-12 תווים. לא נוצר גיבוי.'
            : 'יצירת הגיבוי נכשלה. לא יוצאו נתונים.',
        ),
      );
    } finally {
      setPassphrase('');
      setIsWorking(false);
    }
  }

  async function importExport(): Promise<void> {
    setIsWorking(true);
    setStatus(null);
    try {
      const result = await importEncryptedVaultExport(
        importEnvelope,
        passphrase,
      );
      if (result.ok) {
        useProfileStore.getState().hydrate();
        setImportEnvelope('');
        setStatus(
          t('הייבוא הושלם ואומתו {{count}} מפתחות כספת.', {
            count: result.importedKeys,
          }),
        );
      } else {
        setStatus(t(importFailureText[result.reason]));
      }
    } finally {
      setPassphrase('');
      setIsWorking(false);
    }
  }

  const inputStyle = { textAlign, writingDirection } as const;

  return (
    <RtlScreen safe className={SURFACE.page}>
      <RtlScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <AppText className={`mb-3 text-2xl font-extrabold ${TEXT.heading}`}>
          {t('ייצוא וייבוא כספת')}
        </AppText>

        <View className={`mb-4 rounded-xl border p-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}>
          <AppText className={`mb-2 text-base font-extrabold ${ACCENT.text}`}>
            {t(VAULT_TRANSFER_PROTECTION_TEXT)}
          </AppText>
          <AppText className={`text-sm ${TEXT.body}`}>
            {t(
              'יש לבחור סיסמה בת 12 תווים לפחות. אין לשמור אותה יחד עם הגיבוי המוצפן.',
            )}
          </AppText>
        </View>

        <AppText className={`mb-2 text-base font-extrabold ${TEXT.body}`}>
          {t('סיסמת העברה')}
        </AppText>
        <TextInput
          accessibilityLabel={t('סיסמת העברה')}
          autoCapitalize="none"
          autoCorrect={false}
          className={`mb-4 min-h-[52px] rounded-lg border px-4 ${BORDER.hairline} ${SURFACE.card} ${TEXT.body}`}
          editable={!isWorking}
          onChangeText={setPassphrase}
          placeholder={t('12 תווים לפחות')}
          secureTextEntry
          style={inputStyle}
          value={passphrase}
        />

        <Pressable
          accessibilityRole="button"
          className={`mb-3 min-h-[50px] items-center justify-center rounded-lg ${SURFACE.inverse}`}
          disabled={isWorking}
          onPress={(): void => {
            void createExport();
          }}
          testID="create-encrypted-vault-export"
        >
          <AppText className={`text-base font-extrabold ${TEXT.inverse}`}>
            {t('יצירת גיבוי מוצפן')}
          </AppText>
        </Pressable>

        <AppText className={`mb-2 mt-3 text-base font-extrabold ${TEXT.body}`}>
          {t('אריזה מוצפנת להעתקה')}
        </AppText>
        <TextInput
          accessibilityLabel={t('אריזה מוצפנת להעתקה')}
          className={`mb-5 min-h-[112px] rounded-lg border p-3 ${BORDER.hairline} ${SURFACE.card} ${TEXT.body}`}
          editable={false}
          multiline
          placeholder={t('לא נוצר עדיין גיבוי מוצפן.')}
          selectTextOnFocus
          style={inputStyle}
          value={encryptedExport}
        />

        <AppText className={`mb-2 text-base font-extrabold ${TEXT.body}`}>
          {t('אריזה מוצפנת לייבוא')}
        </AppText>
        <TextInput
          accessibilityLabel={t('אריזה מוצפנת לייבוא')}
          autoCapitalize="none"
          autoCorrect={false}
          className={`mb-3 min-h-[112px] rounded-lg border p-3 ${BORDER.hairline} ${SURFACE.card} ${TEXT.body}`}
          editable={!isWorking}
          multiline
          onChangeText={setImportEnvelope}
          placeholder={t('הדביקו כאן רק את האריזה המוצפנת.')}
          style={inputStyle}
          value={importEnvelope}
        />

        <AppText className={`mb-3 text-sm ${TEXT.muted}`}>
          {t(
            'הייבוא משתמש בתמונת מצב, כתיבה, אימות ושחזור במקרה של כשל. זו אינה עסקה אטומית, וקריסה באמצע כתיבה עלולה למנוע שחזור.',
          )}
        </AppText>

        <Pressable
          accessibilityRole="button"
          className={`mb-4 min-h-[50px] items-center justify-center rounded-lg border ${ACCENT.borderSubtle} ${ACCENT.surface}`}
          disabled={isWorking}
          onPress={(): void => {
            void importExport();
          }}
          testID="import-encrypted-vault-export"
        >
          <AppText className={`text-base font-extrabold ${ACCENT.text}`}>
            {t('ייבוא גיבוי מוצפן')}
          </AppText>
        </Pressable>

        {status !== null ? (
          <AppText
            accessibilityLiveRegion="polite"
            className={`rounded-lg border p-3 text-sm ${BORDER.hairline} ${SURFACE.card} ${TEXT.body}`}
            testID="vault-export-import-status"
          >
            {status}
          </AppText>
        ) : null}
      </RtlScrollView>
    </RtlScreen>
  );
}
