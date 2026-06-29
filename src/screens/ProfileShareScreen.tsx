import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScreen, RtlScrollView } from '../components/rtl';
import { useAppDirection } from '../hooks/useAppDirection';
import { useProfileShare } from '../hooks/useProfileShare';
import { useTranslation } from '../hooks/useTranslation';
import type { SettingsStackParamList } from '../navigation/types';
import type { ProfileShareMode } from '../types/profileShare.types';

type ProfileShareScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  'ProfileShare'
>;

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_EXPORT_INPUT: 'יש להזין PIN להעברה בן 4 ספרות.',
  EXPORT_FAILED: 'יצירת קוד ההעברה נכשלה.',
  CAMERA_PERMISSION_DENIED: 'נדרשת הרשאת מצלמה כדי לסרוק קוד QR.',
  INVALID_IMPORT_INPUT: 'יש לסרוק קוד ולהזין PIN להעברה בן 4 ספרות.',
  INVALID_PROFILE_PAYLOAD: 'קוד ההעברה אינו מכיל פרופיל תקין.',
  DECRYPT_FAILED: 'לא ניתן לפענח את הקוד. בדוק את ה-PIN להעברה.',
  PREVIEW_REQUIRED: 'יש לפענח ולהציג את הפרופיל לפני הייבוא.',
  IMPORT_FAILED: 'ייבוא הפרופיל נכשל.',
};

export function ProfileShareScreen({
  navigation,
}: ProfileShareScreenProps): React.ReactElement {
  const { t } = useTranslation();
  const { textAlign, writingDirection } = useAppDirection();
  const share = useProfileShare();
  const errorMessage =
    share.error === null
      ? null
      : ERROR_MESSAGES[share.error] ?? 'הפעולה נכשלה.';

  function handleModeChange(mode: ProfileShareMode): void {
    share.setMode(mode);
  }

  async function handleCopy(): Promise<void> {
    if (share.encodedPayload === null) {
      return;
    }
    await Clipboard.setStringAsync(share.encodedPayload);
    Alert.alert(t('הקוד הועתק'));
  }

  async function handleImport(): Promise<void> {
    const languagePreference =
      share.activeProfile?.languagePreference ?? 'he';
    try {
      await share.importProfile(languagePreference);
      Alert.alert(t('הפרופיל יובא בהצלחה'));
      navigation.navigate('SettingsRoot');
    } catch {
      // The hook exposes a translated error state; no financial data is logged.
    }
  }

  return (
    <RtlScreen safe className="bg-slate-50 dark:bg-app-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <RtlScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="min-h-full w-full p-5">
            <AppText className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">
              {t('שיתוף פרופיל')}
            </AppText>
            <AppText className="mt-2 text-base leading-6 text-slate-600 dark:text-slate-300">
              {t('השיתוף מוצפן ומתבצע ישירות בין המכשירים, ללא ענן.')}
            </AppText>

            <RtlRow
              accessibilityRole="tablist"
              className="mt-5 gap-2 rounded-lg bg-slate-200 p-1 dark:bg-neutral-800"
            >
              {(['export', 'import'] as const).map(
                (mode: ProfileShareMode): React.ReactElement => {
                  const isSelected = share.mode === mode;
                  return (
                    <Pressable
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isSelected }}
                      className={`min-h-[46px] flex-1 items-center justify-center rounded-md ${
                        isSelected
                          ? 'bg-white shadow-sm dark:bg-neutral-700'
                          : ''
                      }`}
                      key={mode}
                      onPress={(): void => handleModeChange(mode)}
                    >
                      <AppText
                        className={`text-center font-extrabold ${
                          isSelected
                            ? 'text-blue-700 dark:text-blue-200'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {t(mode === 'export' ? 'ייצוא' : 'ייבוא')}
                      </AppText>
                    </Pressable>
                  );
                },
              )}
            </RtlRow>

            <AppText className="mb-2 mt-5 text-sm font-extrabold text-slate-700 dark:text-slate-200">
              {t(
                share.mode === 'export'
                  ? 'צור PIN להעברה'
                  : 'הזן PIN להעברה',
              )}
            </AppText>
            <TextInput
              accessibilityLabel={t('PIN להעברה בן 4 ספרות')}
              className="min-h-[52px] rounded-lg border border-slate-300 bg-white px-4 text-xl text-slate-900 dark:border-neutral-700 dark:bg-dark-surface dark:text-slate-50"
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={share.setTransferPin}
              placeholder="••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              style={{ textAlign, writingDirection }}
              value={share.transferPin}
            />
            <AppText className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t('זהו PIN זמני ונפרד מה-PIN של האפליקציה.')}
            </AppText>

            {share.mode === 'export' ? (
              <View className="mt-5">
                <Pressable
                  accessibilityRole="button"
                  className="min-h-[50px] items-center justify-center rounded-lg bg-blue-600 px-4"
                  disabled={share.isBusy}
                  onPress={(): void => {
                    // SEC: pinHash exclusion enforced in profileShareCodec.ts — see Agent 5 traceability
                    void share.generateExport();
                  }}
                >
                  <AppText className="text-center text-base font-extrabold text-white">
                    {t('צור קוד QR')}
                  </AppText>
                </Pressable>

                {share.encodedPayload !== null ? (
                  <View className="mt-5 items-center rounded-lg border border-slate-300 bg-white p-5 shadow-sm dark:border-neutral-700">
                    <QRCode
                      backgroundColor="#FFFFFF"
                      color="#0F172A"
                      ecl="M"
                      size={230}
                      value={share.encodedPayload}
                    />
                    <Pressable
                      accessibilityRole="button"
                      className="mt-4 min-h-[46px] w-full items-center justify-center rounded-lg border border-blue-300 bg-blue-50 px-4 dark:border-blue-800 dark:bg-blue-950"
                      onPress={(): void => {
                        void handleCopy();
                      }}
                    >
                      <AppText className="text-center font-extrabold text-blue-700 dark:text-blue-200">
                        {t('העתק קוד')}
                      </AppText>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : (
              <View className="mt-5">
                {!share.cameraPermissionGranted &&
                share.scannedPayload === null ? (
                  <Pressable
                    accessibilityRole="button"
                    className="min-h-[50px] items-center justify-center rounded-lg bg-blue-600 px-4"
                    onPress={(): void => {
                      void share.requestCamera();
                    }}
                  >
                    <AppText className="text-center text-base font-extrabold text-white">
                      {t('פתח מצלמה וסרוק QR')}
                    </AppText>
                  </Pressable>
                ) : null}

                {share.cameraPermissionGranted ? (
                  <View className="h-72 overflow-hidden rounded-lg border border-slate-300 shadow-sm dark:border-neutral-700">
                    <CameraView
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      className="flex-1"
                      facing="back"
                      onBarcodeScanned={(
                        result: BarcodeScanningResult,
                      ): void => share.acceptScannedPayload(result.data)}
                    />
                  </View>
                ) : null}

                {share.scannedPayload !== null ? (
                  <Pressable
                    accessibilityRole="button"
                    className="min-h-[50px] items-center justify-center rounded-lg bg-blue-600 px-4"
                    disabled={share.isBusy}
                    onPress={(): void => {
                      void share.decryptImport();
                    }}
                  >
                    <AppText className="text-center text-base font-extrabold text-white">
                      {t('פענח והצג פרופיל')}
                    </AppText>
                  </Pressable>
                ) : null}

                {share.preview !== null ? (
                  <View className="mt-5 rounded-lg border border-green-200 bg-green-50 p-5 shadow-sm dark:border-green-900 dark:bg-green-950">
                    <AppText className="text-lg font-extrabold text-green-900 dark:text-green-100">
                      {share.preview.displayName}
                    </AppText>
                    <AppText className="mt-2 text-green-800 dark:text-green-200">
                      {t('בנק: {{bankName}}', {
                        bankName: share.preview.bankName,
                      })}
                    </AppText>
                    <AppText className="mt-1 text-green-800 dark:text-green-200">
                      {t('{{count}} כרטיסים', {
                        count: share.preview.cards.length,
                      })}
                    </AppText>
                    <Pressable
                      accessibilityRole="button"
                      className="mt-4 min-h-[48px] items-center justify-center rounded-lg bg-green-700 px-4"
                      disabled={share.isBusy}
                      onPress={(): void => {
                        void handleImport();
                      }}
                    >
                      <AppText className="text-center font-extrabold text-white">
                        {t('ייבא פרופיל')}
                      </AppText>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}

            {errorMessage !== null ? (
              <AppText className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950 dark:text-red-200">
                {t(errorMessage)}
              </AppText>
            ) : null}
          </View>
        </RtlScrollView>
      </KeyboardAvoidingView>
    </RtlScreen>
  );
}
