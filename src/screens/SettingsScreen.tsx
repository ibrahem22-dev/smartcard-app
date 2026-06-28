import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AppText } from '../components/AppText';
import { RtlScrollView, RtlScreen } from '../components/rtl';
import { ProfileSwitcher } from '../components/ProfileSwitcher';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import type { SettingsStackParamList } from '../navigation/types';
import {
  useLanguageStore,
  type LanguageChoice,
} from '../store/useLanguageStore';
import { useProfileStore } from '../store/useProfileStore';
import type { AppProfile } from '../types/profile.types';

type SettingsScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  'SettingsRoot'
>;

const LANGUAGE_OPTIONS: readonly {
  readonly preference: LanguageChoice;
  readonly label: string;
}[] = [
  { preference: 'auto', label: 'Auto' },
  { preference: 'he', label: 'עברית' },
  { preference: 'en', label: 'English' },
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
  const bankDividerColor = withOpacity(theme.bankColor, 0.3);

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
    <RtlScreen className="bg-slate-50 dark:bg-app-dark">
      <RtlScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full p-5">
          <AppText
            className="mb-[18px] text-[26px] font-extrabold text-slate-900 dark:text-white"
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
            className="mb-2 mt-6 text-base font-extrabold text-slate-700 dark:text-slate-200"
            style={{
              borderBottomColor: bankDividerColor,
              borderBottomWidth: 1,
            }}
          >
            {t('שפה')}
          </AppText>

          <View accessibilityRole="radiogroup" className="mb-5 gap-2">
            {LANGUAGE_OPTIONS.map(option => {
              const isSelected = languageChoice === option.preference;

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  className={`min-h-[48px] justify-center rounded-lg border px-4 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-100 dark:border-blue-400 dark:bg-blue-950'
                      : 'border-slate-300 bg-white dark:border-neutral-700 dark:bg-dark-surface'
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
                        ? 'text-blue-700 dark:text-blue-200'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            className="mb-3 min-h-[50px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 dark:border-blue-900 dark:bg-blue-950"
            onPress={(): void => navigation.navigate('Glossary')}
          >
            <AppText className="text-center text-base font-extrabold text-blue-700 dark:text-blue-200">
              {t('מילון פיננסי')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="mb-3 min-h-[50px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 dark:border-blue-900 dark:bg-blue-950"
            onPress={(): void => navigation.navigate('InstallmentImport')}
          >
            <AppText className="text-center text-base font-extrabold text-blue-700 dark:text-blue-200">
              {t('הוסף תשלומים קיימים')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="mb-3 min-h-[50px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 dark:border-blue-900 dark:bg-blue-950"
            onPress={(): void => navigation.navigate('Loans')}
          >
            <AppText className="text-center text-base font-extrabold text-blue-700 dark:text-blue-200">
              {t('הלוואות ומשכנתא')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="mb-3 min-h-[50px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 dark:border-blue-900 dark:bg-blue-950"
            onPress={(): void => navigation.navigate('InterestCalculator')}
          >
            <AppText className="text-center text-base font-extrabold text-blue-700 dark:text-blue-200">
              {t('מחשבון ריבית')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="mb-3 min-h-[50px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 shadow-sm dark:border-blue-900 dark:bg-blue-950"
            onPress={(): void => navigation.navigate('ProfileShare')}
          >
            <AppText className="text-center text-base font-extrabold text-blue-700 dark:text-blue-200">
              {t('שיתוף פרופיל')}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="min-h-[50px] items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100"
            onPress={(): void => navigation.navigate('Contact')}
          >
            <AppText className="text-center text-base font-extrabold text-white dark:text-slate-900">
              {t('צור קשר עם חברת האשראי')}
            </AppText>
          </Pressable>
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
