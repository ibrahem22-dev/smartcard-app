import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useLanguage, type LanguagePreference } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { en } from '../i18n/en';
import type { SettingsStackParamList } from '../navigation/types';
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
  const isEnglish = language === 'en';

  return (
    <View className="flex-1 bg-slate-50 p-5 dark:bg-neutral-950" style={rtl.screen}>
      <Text
        className={`mb-[18px] text-[26px] font-extrabold text-slate-900 dark:text-white ${
          isEnglish ? 'text-left' : 'text-right'
        }`}
        style={isEnglish ? { writingDirection: 'ltr' } : rtl.text}
      >
        {isEnglish ? en.settings.title : 'הגדרות'}
      </Text>

      <Text
        className={`mb-2 text-base font-extrabold text-slate-700 dark:text-slate-200 ${
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
                  : 'border-slate-300 bg-white dark:border-neutral-700 dark:bg-neutral-900'
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
        className="min-h-[50px] items-center justify-center rounded-lg bg-slate-900 dark:bg-white"
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
  );
}
