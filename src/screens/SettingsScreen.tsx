import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ProfileSwitcher } from '../components/ProfileSwitcher';
import { useLanguage, type LanguagePreference } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { en } from '../i18n/en';
import type { SettingsStackParamList } from '../navigation/types';
import { useProfileStore } from '../store/useProfileStore';
import type { AppProfile } from '../types/profile.types';
import { rtl } from '../utils/rtlStyles';

type SettingsScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  'SettingsRoot'
>;

const LANGUAGE_OPTIONS: readonly {
  readonly preference: Extract<LanguagePreference, 'device' | 'he' | 'en'>;
  readonly labelHe: string;
  readonly labelEn: string;
}[] = [
  {
    preference: 'device',
    labelHe: 'שפת המכשיר אוטומטי',
    labelEn: en.settings.deviceLanguage,
  },
  {
    preference: 'he',
    labelHe: 'עברית',
    labelEn: en.settings.hebrew,
  },
  {
    preference: 'en',
    labelHe: 'English',
    labelEn: en.settings.english,
  },
];

export function SettingsScreen({
  navigation,
}: SettingsScreenProps): React.ReactElement {
  const theme = useTheme();
  const {
    language,
    languagePreference,
    setLanguagePreference,
  } = useLanguage();
  const activeProfile = useProfileStore(state => state.activeProfile);
  const deleteProfile = useProfileStore(state => state.deleteProfile);
  const isEnglish = language === 'en';

  function confirmDeleteProfile(profile: AppProfile): void {
    if (activeProfile?.id === profile.id) {
      return;
    }

    Alert.alert(
      'מחיקת פרופיל',
      `למחוק את הפרופיל ${profile.displayName}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחיקה',
          style: 'destructive',
          onPress: (): void => deleteProfile(profile.id),
        },
      ],
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-app-dark" style={rtl.screen}>
      <ScrollView
        contentContainerStyle={rtl.scrollInner}
        keyboardShouldPersistTaps="handled"
        style={rtl.scrollOuter}
      >
        <View className="w-full p-5">
          <Text
            className={`mb-[18px] text-[26px] font-extrabold text-slate-900 dark:text-white ${
              isEnglish ? 'text-left' : 'text-right'
            }`}
            style={isEnglish ? { writingDirection: 'ltr' } : rtl.text}
          >
            {isEnglish ? en.settings.title : 'הגדרות'}
          </Text>

          <ProfileSwitcher
            mode="editor"
            onRequestDelete={confirmDeleteProfile}
          />

          <Text
            className={`mb-2 mt-6 text-base font-extrabold text-slate-700 dark:text-slate-200 ${
              isEnglish ? 'text-left' : 'text-right'
            }`}
            style={isEnglish ? { writingDirection: 'ltr' } : rtl.text}
          >
            {isEnglish ? en.settings.languageTitle : 'שפה'}
          </Text>

          <View accessibilityRole="radiogroup" className="mb-5 gap-2">
            {LANGUAGE_OPTIONS.map(option => {
              const isSelected = languagePreference === option.preference;

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
                  onPress={(): void =>
                    setLanguagePreference(option.preference)
                  }
                >
                  <Text
                    className={`text-base font-extrabold ${
                      isEnglish ? 'text-left' : 'text-right'
                    } ${
                      isSelected
                        ? 'text-blue-700 dark:text-blue-200'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                    style={isEnglish ? { writingDirection: 'ltr' } : rtl.text}
                  >
                    {isEnglish ? option.labelEn : option.labelHe}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            className="mb-3 min-h-[50px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 dark:border-blue-900 dark:bg-blue-950"
            onPress={(): void => navigation.navigate('Glossary')}
          >
            <Text
              className="text-center text-base font-extrabold text-blue-700 dark:text-blue-200"
              style={isEnglish ? { writingDirection: 'ltr' } : rtl.text}
            >
              {isEnglish ? en.settings.financialGlossary : 'מילון פיננסי'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="mb-3 min-h-[50px] items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 dark:border-blue-900 dark:bg-blue-950"
            onPress={(): void => navigation.navigate('InstallmentImport')}
          >
            <Text
              className="text-center text-base font-extrabold text-blue-700 dark:text-blue-200"
              style={isEnglish ? { writingDirection: 'ltr' } : rtl.text}
            >
              {isEnglish
                ? en.settings.importInstallments
                : 'הוסף תשלומים קיימים'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="min-h-[50px] items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100"
            onPress={(): void => navigation.navigate('Contact')}
          >
            <Text
              className="text-center text-base font-extrabold text-white dark:text-slate-900"
              style={isEnglish ? { writingDirection: 'ltr' } : rtl.text}
            >
              {isEnglish ? en.settings.contactIssuer : 'צור קשר עם חברת האשראי'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
