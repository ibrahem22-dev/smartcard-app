import React, { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { RtlRow, RtlScrollView, RtlScreen } from '../components/rtl';
import { ProfileSwitcher } from '../components/ProfileSwitcher';
import { useAppDirection } from '../hooks/useAppDirection';
import { useLanguage } from '../hooks/useLanguage';
import { useMoney } from '../hooks/useMoney';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { MoreStackParamList } from '../navigation/types';
import {
  useLanguageStore,
  type LanguageChoice,
} from '../store/useLanguageStore';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import type { AppProfile } from '../types/profile.types';
import { parseAmount } from '../utils/parseAmount';
import {
  ACCENT,
  BORDER,
  CHROME,
  ROLE_TEXT,
  SURFACE,
  TEXT,
} from '../theme/tokens';
import { TABULAR_NUMERALS } from '../utils/money';

/**
 * SETTINGS — one place for everything that is a preference rather than a feature.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SEPARATION THE OWNER ASKED FOR
 *
 * This screen used to BE the More tab, which meant the product had no way to distinguish "a thing
 * you set once" from "a thing you use". It is now reached by the gear on Home — a top-level
 * account area — and More keeps the tools. Five groups, in the order a phone's settings uses:
 * account, language, preferences, privacy and data, about.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE PROMO-CODE CONTROL IS GONE, AND ITS ABSENCE IS THE POINT
 *
 * It called RevenueCat; `react-native-purchases` was archived out of the manifest, so it refused
 * with a message. V9's completion matrix carries the open item in as many words: *"Settings ships
 * an 'Account & subscription / Promo code' section that the listing's 'No account' line and the
 * IAP=No answers do not describe — hide or keep, with the truthful explanation."* There is no
 * provider, no subscription and no account; a control that refuses every time is a feature
 * announcement, and B2 refuses those on a live route. Removed rather than hidden, because a hidden
 * affordance that still exists in the code is how a dead path survives a fence.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE DATA CONTROLS STAY IN THE MORE STACK AND ARE REACHED FROM HERE
 *
 * `DataPrivacy`, `CrashLog` and `VaultExportImport` are registered on the same stack, so these are
 * ordinary same-stack pushes and the back button behaves. Criteria C7 and V9 both require a
 * Settings entry that reaches them by name.
 */

type SettingsScreenProps = NativeStackScreenProps<MoreStackParamList, 'Settings'>;

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
  const { money } = useMoney();
  const activeProfile = useProfileStore(state => state.activeProfile);
  const deleteProfile = useProfileStore(state => state.deleteProfile);
  const profile = useUserStore(state => state.profile);
  const setBudget = useUserStore(state => state.setMonthlyBudgetTargetIls);
  const { textAlign, writingDirection } = useAppDirection();
  const [budgetDraft, setBudgetDraft] = useState<string>('');
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const bankDividerColor = withOpacity(theme.bankColor, 0.3);

  function confirmDeleteProfile(profileToDelete: AppProfile): void {
    if (activeProfile?.id === profileToDelete.id) {
      return;
    }

    Alert.alert(
      t('מחיקת פרופיל'),
      t('למחוק את הפרופיל {{name}}?', { name: profileToDelete.displayName }),
      [
        { text: t('ביטול'), style: 'cancel' },
        {
          text: t('מחיקה'),
          style: 'destructive',
          onPress: (): void => deleteProfile(profileToDelete.id),
        },
      ],
    );
  }

  /**
   * SAVE THE BUDGET TARGET.
   *
   * `parseAmount` is the app's one text-to-money reader: it strips separators and the shekel sign
   * and bounds the result against `MONETARY_MIN_ILS`/`MONETARY_MAX_ILS` in `config/financial.ts`.
   * An empty field CLEARS the target rather than saving zero, because "I have no target" and "my
   * target is nothing" are different states and Home renders them differently.
   */
  function saveBudget(): void {
    const trimmed = budgetDraft.trim();
    if (trimmed === '') {
      setBudget(null);
      setBudgetError(null);
      return;
    }
    const parsed = parseAmount(trimmed);
    if (parsed === null) {
      setBudgetError(t('צריך סכום חיובי בשקלים'));
      return;
    }
    setBudget(parsed);
    setBudgetError(null);
    setBudgetDraft('');
  }

  const sectionHeading = (label: string): React.ReactElement => (
    <AppText
      className={`mb-2 mt-6 text-base font-extrabold ${TEXT.body}`}
      style={{ borderBottomColor: bankDividerColor, borderBottomWidth: 1 }}
    >
      {label}
    </AppText>
  );

  const linkRow = (
    label: string,
    testID: string,
    onPress: () => void,
  ): React.ReactElement => (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className={`mb-3 min-h-[50px] justify-center rounded-lg border px-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
      onPress={onPress}
      testID={testID}
    >
      <RtlRow className="items-center justify-between">
        <AppText className={`text-base font-extrabold ${ACCENT.text}`}>{label}</AppText>
        <AppText className={`text-xl ${TEXT.secondary}`}>›</AppText>
      </RtlRow>
    </Pressable>
  );

  return (
    <RtlScreen safe className={`${SURFACE.page}`} testID="settings-screen">
      <RtlScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full p-4">
          <AppText
            className={`mb-4 text-2xl font-extrabold ${TEXT.heading}`}
            style={{ borderBottomColor: bankDividerColor, borderBottomWidth: 1 }}
          >
            {t('הגדרות')}
          </AppText>

          {/* ── ACCOUNT ─────────────────────────────────────────────────────────────────── */}
          {sectionHeading(t('חשבון'))}
          <AppText className={`mb-2 text-xs ${TEXT.muted}`} testID="settings-account-note">
            {t('הפרופילים נשמרים במכשיר בלבד ואינם חשבון מקוון')}
          </AppText>
          <ProfileSwitcher
            activeBorderColor={theme.bankColor}
            mode="editor"
            onRequestDelete={confirmDeleteProfile}
          />

          {/* ── LANGUAGE & REGION ───────────────────────────────────────────────────────── */}
          {sectionHeading(t('שפה'))}
          <View accessibilityRole="radiogroup" className="mb-4 gap-2" testID="settings-language">
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
                  testID={`settings-language-${option.preference}`}
                >
                  <AppText
                    className={`text-base font-extrabold ${isSelected ? ACCENT.text : TEXT.body}`}
                  >
                    {t(option.labelKey)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* ── PREFERENCES ─────────────────────────────────────────────────────────────── */}
          {sectionHeading(t('העדפות'))}
          <AppText className={`mb-1 text-sm font-bold ${TEXT.body}`}>
            {t('יעד הוצאה חודשי')}
          </AppText>
          {profile === null ? (
            <AppText className={`mb-3 text-xs ${TEXT.secondary}`} testID="settings-budget-no-profile">
              {t('אין פרופיל טעון, ולכן אי אפשר לשמור יעד')}
            </AppText>
          ) : (
            <>
              <AppText
                className={`mb-2 text-xs ${TEXT.secondary}`}
                testID="settings-budget-current"
              >
                {profile.monthlyBudgetTargetIls === undefined
                  ? t('לא הוגדר יעד')
                  : `${t('היעד הנוכחי')}: ${money(profile.monthlyBudgetTargetIls)}`}
              </AppText>
              <TextInput
                accessibilityLabel={t('יעד הוצאה חודשי')}
                className={`min-h-[48px] rounded-lg border px-4 text-base ${BORDER.hairline} ${SURFACE.card} ${TEXT.heading}`}
                keyboardType="decimal-pad"
                onChangeText={setBudgetDraft}
                placeholder={t('סכום בשקלים, או ריק כדי לבטל יעד')}
                placeholderTextColor={CHROME.subtle}
                style={[{ textAlign, writingDirection }, TABULAR_NUMERALS]}
                testID="settings-budget-input"
                value={budgetDraft}
              />
              {budgetError === null ? null : (
                <AppText
                  className={`mt-1 text-xs font-bold ${ROLE_TEXT.danger}`}
                  testID="settings-budget-error"
                >
                  {budgetError}
                </AppText>
              )}
              <Pressable
                accessibilityLabel={t('שמירת יעד ההוצאה')}
                accessibilityRole="button"
                className={`mb-4 mt-2 min-h-[48px] items-center justify-center rounded-lg ${ACCENT.solid}`}
                onPress={saveBudget}
                testID="settings-budget-save"
              >
                <AppText className={`text-base font-extrabold ${TEXT.onAccent}`}>
                  {t('שמירת יעד ההוצאה')}
                </AppText>
              </Pressable>
            </>
          )}

          {/* ── PRIVACY & DATA ──────────────────────────────────────────────────────────── */}
          {sectionHeading(t('מידע ופרטיות'))}
          {linkRow(
            t('מידע ופרטיות: גרסאות, רעננות ואחסון מקומי'),
            'data-privacy-entry',
            (): void => navigation.navigate('DataPrivacy'),
          )}
          {linkRow(
            t('ייצוא וייבוא גיבוי כספת מוצפן'),
            'vault-export-import-entry',
            (): void => navigation.navigate('VaultExportImport'),
          )}
          {linkRow(
            t('יומן קריסות: שגיאות שנשמרו במכשיר בלבד'),
            'crash-log-entry',
            (): void => navigation.navigate('CrashLog'),
          )}
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
