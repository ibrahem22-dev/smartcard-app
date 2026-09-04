import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScrollView, RtlScreen } from '../components/rtl';
import { ProfileSwitcher } from '../components/ProfileSwitcher';
import { useAppDirection } from '../hooks/useAppDirection';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { MoreStackParamList } from '../navigation/types';
import {
  useLanguageStore,
  type LanguageChoice,
} from '../store/useLanguageStore';
import { useProfileStore } from '../store/useProfileStore';
import type { AppProfile } from '../types/profile.types';
import { ACCENT, BORDER, CHROME, PROMO, ROLE_SURFACE_BG, ROLE_TEXT, SURFACE, TEXT } from '../theme/tokens';

type SettingsScreenProps = NativeStackScreenProps<
  MoreStackParamList,
  'MoreRoot'
>;

const LANGUAGE_OPTIONS: readonly {
  readonly preference: LanguageChoice;
  readonly labelKey: string;
}[] = [
  { preference: 'auto', labelKey: 'שפת המכשיר אוטומטי' },
  { preference: 'he', labelKey: 'עברית' },
  { preference: 'ar', labelKey: 'العربية' },
  { preference: 'en', labelKey: 'English' },
];

function withOpacity(color: string, opacity: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const alpha = Math.round(opacity * 255)
      .toString(16)
      .padStart(2, '0');
    return `${color}${alpha}`;
  }
  if (color.startsWith('hsl(') && color.endsWith(')')) {
    return `hsla(${color.slice(4, -1)}, ${opacity})`;
  }
  return color;
}

export function SettingsScreen({
  navigation,
}: SettingsScreenProps): React.ReactElement {
  const theme = useTheme();
  const { languageChoice } = useLanguage();
  const setLanguageChoice = useLanguageStore(state => state.setLanguageChoice);
  const { t } = useTranslation();
  const activeProfile = useProfileStore(state => state.activeProfile);
  const deleteProfile = useProfileStore(state => state.deleteProfile);
  const { isRTL, textAlign, writingDirection } = useAppDirection();
  const [isPromoModalVisible, setIsPromoModalVisible] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isRedeemingPromo, setIsRedeemingPromo] = useState(false);
  const [promoToast, setPromoToast] = useState<string | null>(null);
  const bankDividerColor = withOpacity(theme.bankColor, 0.3);

  useEffect(() => {
    if (promoToast === null) {
      return undefined;
    }

    const timeout = setTimeout((): void => setPromoToast(null), 4_000);
    return (): void => clearTimeout(timeout);
  }, [promoToast]);

  function openPromoModal(): void {
    setPromoCode('');
    setPromoError(null);
    setIsPromoModalVisible(true);
  }

  function closePromoModal(): void {
    if (!isRedeemingPromo) {
      setIsPromoModalVisible(false);
      setPromoError(null);
    }
  }

  async function handlePromoRedemption(): Promise<void> {
    setPromoError(null);
    setIsRedeemingPromo(true);

    try {
      /**
       * B9 — REDEMPTION HAS NO PROVIDER, AND IT SAYS SO INSTEAD OF PRETENDING.
       *
       * This called RevenueCat. The paywall is unmounted and react-native-purchases is archived
       * out of the dependency manifest, so there is nothing behind this control. It refuses with a
       * reason rather than failing silently or, worse, reporting a success it cannot deliver.
       *
       * The control itself belongs to the Settings/More rework, which is P5b. It is left visible
       * and honest rather than hidden: a hidden affordance that still exists in the code is how a
       * dead path survives a fence.
       */
      setPromoError(
        t('מימוש קודים אינו זמין בגרסה זו.'),
      );
      return;
    } finally {
      setIsRedeemingPromo(false);
    }
  }

  function confirmDeleteProfile(profile: AppProfile): void {
    if (activeProfile?.id === profile.id) {
      return;
    }

    Alert.alert(
      t('מחיקת פרופיל'),
      t('למחוק את הפרופיל {{name}}?', { name: profile.displayName }),
      [
        { text: t('ביטול'), style: 'cancel' },
        {
          text: t('מחיקה'),
          style: 'destructive',
          onPress: (): void => deleteProfile(profile.id),
        },
      ],
    );
  }

  return (
    <RtlScreen safe className={`${SURFACE.page}`}>
      <RtlScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full p-4">
          {promoToast !== null ? (
            <View className={`mb-4 rounded-xl px-4 py-3 shadow-sm ${ROLE_SURFACE_BG.positive}`}>
              <AppText
                align="center"
                className={`font-extrabold ${ROLE_TEXT.positive}`}
              >
                {promoToast}
              </AppText>
            </View>
          ) : null}

          <AppText
            className={`mb-4 text-2xl font-extrabold ${TEXT.heading}`}
            style={{
              borderBottomColor: bankDividerColor,
              borderBottomWidth: 1,
            }}
          >
            {t('הגדרות')}
          </AppText>

          <ProfileSwitcher
            activeBorderColor={theme.bankColor}
            mode="editor"
            onRequestDelete={confirmDeleteProfile}
          />

          <AppText
            className={`mb-2 mt-6 text-base font-extrabold ${TEXT.body}`}
            style={{
              borderBottomColor: bankDividerColor,
              borderBottomWidth: 1,
            }}
          >
            {t('חשבון ומנוי')}
          </AppText>

          <Pressable
            accessibilityRole="button"
            className={`mb-4 min-h-[50px] justify-center rounded-lg border px-4 shadow-sm ${PROMO.border} ${PROMO.surface}`}
            onPress={openPromoModal}
          >
            <RtlRow className="items-center justify-between">
              <AppText className={`text-base font-extrabold ${PROMO.text}`}>
                {t('קוד קידום מכירות 🎟️')}
              </AppText>
              <AppText className={`text-xl ${PROMO.textSubtle}`}>
                ›
              </AppText>
            </RtlRow>
          </Pressable>

          <AppText
            className={`mb-2 mt-6 text-base font-extrabold ${TEXT.body}`}
            style={{
              borderBottomColor: bankDividerColor,
              borderBottomWidth: 1,
            }}
          >
            {t('שפה')}
          </AppText>

          <View accessibilityRole="radiogroup" className="mb-4 gap-2">
            {LANGUAGE_OPTIONS.map(option => {
              const isSelected = languageChoice === option.preference;

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  className={`min-h-[48px] justify-center rounded-lg border px-4 ${
                    isSelected
                      ? `${ACCENT.border} ${ACCENT.surfaceStrong}`
                      : `${BORDER.hairline} ${SURFACE.card}`
                  }`}
                  key={option.preference}
                  onPress={(): void => setLanguageChoice(option.preference)}
                  style={
                    isSelected
                      ? {
                          backgroundColor: withOpacity(
                            theme.companyAccent,
                            0.15,
                          ),
                          borderColor: theme.companyAccent,
                        }
                      : undefined
                  }
                >
                  <AppText
                    className={`text-base font-extrabold ${
                      isSelected
                        ? `${ACCENT.text}`
                        : `${TEXT.body}`
                    }`}
                  >
                    {t(option.labelKey)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            className={`mb-3 min-h-[50px] items-center justify-center rounded-lg border px-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
            onPress={(): void => navigation.navigate('Glossary')}
          >
            <AppText className={`text-center text-base font-extrabold ${ACCENT.text}`}>
              {t('מילון פיננסי')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className={`mb-3 min-h-[50px] items-center justify-center rounded-lg border px-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
            onPress={(): void => navigation.navigate('Learn')}
            testID="learn-entry"
          >
            <AppText className={`text-center text-base font-extrabold ${ACCENT.text}`}>
              {t('לומדים: מילון, זכויות ואנשי קשר')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className={`mb-3 min-h-[50px] items-center justify-center rounded-lg border px-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
            onPress={(): void => navigation.navigate('DataPrivacy')}
            testID="data-privacy-entry"
          >
            <AppText className={`text-center text-base font-extrabold ${ACCENT.text}`}>
              {t('מידע ופרטיות: גרסאות, רעננות ואחסון מקומי')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className={`mb-3 min-h-[50px] items-center justify-center rounded-lg border px-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
            onPress={(): void => navigation.navigate('CrashLog')}
            testID="crash-log-entry"
          >
            <AppText className={`text-center text-base font-extrabold ${ACCENT.text}`}>
              {t('יומן קריסות: שגיאות שנשמרו במכשיר בלבד')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className={`mb-3 min-h-[50px] items-center justify-center rounded-lg border px-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
            onPress={(): void => navigation.navigate('VaultExportImport')}
            testID="vault-export-import-entry"
          >
            <AppText className={`text-center text-base font-extrabold ${ACCENT.text}`}>
              {t('ייצוא וייבוא גיבוי כספת מוצפן')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className={`mb-3 min-h-[50px] items-center justify-center rounded-lg border px-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
            onPress={(): void => navigation.navigate('InstallmentImport')}
          >
            <AppText className={`text-center text-base font-extrabold ${ACCENT.text}`}>
              {t('הוסף תשלומים קיימים')}
            </AppText>
          </Pressable>

          {__DEV__ ? (
            <Pressable
              accessibilityRole="button"
              testID="dev-engine-probe-entry"
              className={`mb-3 min-h-[50px] items-center justify-center rounded-lg border px-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
              onPress={(): void => navigation.navigate('EngineProbe')}
            >
              <AppText className={`text-center text-base font-extrabold ${ACCENT.text}`}>
                ENGINE PROBE (dev)
              </AppText>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            className={`mb-3 min-h-[50px] items-center justify-center rounded-lg border px-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
            onPress={(): void => navigation.navigate('InterestCalculator')}
          >
            <AppText className={`text-center text-base font-extrabold ${ACCENT.text}`}>
              {t('מחשבון ריבית')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className={`min-h-[50px] items-center justify-center rounded-lg ${SURFACE.inverse}`}
            onPress={(): void => navigation.navigate('Contact')}
          >
            <AppText className={`text-center text-base font-extrabold ${TEXT.inverse}`}>
              {t('צור קשר עם חברת האשראי')}
            </AppText>
          </Pressable>
        </View>
      </RtlScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closePromoModal}
        transparent
        visible={isPromoModalVisible}
      >
        <View className={`flex-1 items-center justify-center px-4 ${SURFACE.modalScrim}`}>
          <View
            className={`w-full max-w-md gap-4 rounded-2xl p-4 shadow-lg ${SURFACE.card}`}
            key={isRTL ? 'promo-modal-rtl' : 'promo-modal-ltr'}
          >
            <AppText className={`text-xl font-extrabold ${TEXT.heading}`}>
              {t('קוד קידום מכירות 🎟️')}
            </AppText>

            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              className={`min-h-[52px] rounded-xl border px-4 text-base ${BORDER.hairline} ${SURFACE.page} ${TEXT.heading}`}
              editable={!isRedeemingPromo}
              onChangeText={setPromoCode}
              placeholder={t('הכנס קוד')}
              placeholderTextColor={CHROME.subtle}
              style={{ textAlign, writingDirection }}
              value={promoCode}
            />

            {promoError !== null ? (
              <AppText className={`text-sm font-bold ${ROLE_TEXT.danger}`}>
                {promoError}
              </AppText>
            ) : null}

            <RtlRow className="gap-3">
              <Pressable
                accessibilityRole="button"
                className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border px-4 ${BORDER.hairline}`}
                disabled={isRedeemingPromo}
                onPress={closePromoModal}
              >
                <AppText className={`font-bold ${TEXT.body}`}>
                  {t('ביטול')}
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className={`min-h-[48px] flex-1 items-center justify-center rounded-xl px-4 shadow-sm ${PROMO.solid}`}
                disabled={isRedeemingPromo}
                onPress={() => {
                  void handlePromoRedemption();
                }}
              >
                <AppText className={`font-extrabold ${TEXT.onAccent}`}>
                  {isRedeemingPromo ? t('מממש…') : t('מימוש')}
                </AppText>
              </Pressable>
            </RtlRow>
          </View>
        </View>
      </Modal>
    </RtlScreen>
  );
}
