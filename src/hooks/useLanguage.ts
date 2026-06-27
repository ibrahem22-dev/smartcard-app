import { useState } from 'react';
import { I18nManager } from 'react-native';
import { getLocales } from 'expo-localization';
import * as Updates from 'expo-updates';
import { MMKV } from 'react-native-mmkv';

import { MMKV_KEYS } from '../store/keys';

export type LanguagePreference = 'device' | 'he' | 'ar' | 'en';
export type AppLanguage = Exclude<LanguagePreference, 'device'>;

interface UseLanguageResult {
  readonly languagePreference: LanguagePreference;
  readonly language: AppLanguage;
  readonly setLanguagePreference: (preference: LanguagePreference) => void;
}

const preferencesStorage = new MMKV({ id: 'smartcard.preferences' });

export function getDeviceLanguage(): AppLanguage {
  const locale = getLocales()[0];
  const languageCode = locale?.languageCode?.toLowerCase() ?? '';

  if (languageCode.startsWith('he')) {
    return 'he';
  }

  if (languageCode.startsWith('ar')) {
    return 'ar';
  }

  return 'he';
}

function isLanguagePreference(value: string): value is LanguagePreference {
  return value === 'device' || value === 'he' || value === 'ar' || value === 'en';
}

export function readLanguagePreference(): LanguagePreference {
  const stored = preferencesStorage.getString(MMKV_KEYS.languagePreference);

  if (stored !== undefined && isLanguagePreference(stored)) {
    return stored;
  }

  const initialPreference = getDeviceLanguage();
  preferencesStorage.set(MMKV_KEYS.languagePreference, initialPreference);
  return initialPreference;
}

export function resolveLanguage(
  preference: LanguagePreference,
): AppLanguage {
  return preference === 'device' ? getDeviceLanguage() : preference;
}

export function getInitialLanguage(): AppLanguage {
  return resolveLanguage(readLanguagePreference());
}

export function useLanguage(): UseLanguageResult {
  const [languagePreference, setPreference] = useState<LanguagePreference>(
    readLanguagePreference,
  );

  function setLanguagePreference(preference: LanguagePreference): void {
    const language = resolveLanguage(preference);
    const shouldUseRtl = language === 'he' || language === 'ar';

    preferencesStorage.set(MMKV_KEYS.languagePreference, preference);
    setPreference(preference);
    I18nManager.allowRTL(shouldUseRtl);
    I18nManager.forceRTL(shouldUseRtl);
    void Updates.reloadAsync();
  }

  return {
    languagePreference,
    language: resolveLanguage(languagePreference),
    setLanguagePreference,
  };
}
