import { useEffect, useState } from 'react';
import { getLocales } from 'expo-localization';

import { keyVault } from '../security/keyVault';
import { MMKV_KEYS } from '../store/keys';

export type LanguagePreference = 'device' | 'he' | 'ar' | 'en';
export type AppLanguage = Exclude<LanguagePreference, 'device'>;

interface UseLanguageResult {
  readonly languagePreference: LanguagePreference;
  readonly language: AppLanguage;
  readonly setLanguagePreference: (preference: LanguagePreference) => void;
}

function getDeviceLanguage(): AppLanguage {
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

function readInitialPreference(): {
  readonly preference: LanguagePreference;
  readonly shouldPersist: boolean;
} {
  const stored = keyVault
    .getEncryptedStorage()
    .getString(MMKV_KEYS.languagePreference);

  if (stored !== undefined && isLanguagePreference(stored)) {
    return { preference: stored, shouldPersist: false };
  }

  return { preference: getDeviceLanguage(), shouldPersist: true };
}

export function useLanguage(): UseLanguageResult {
  const [initial] = useState(readInitialPreference);
  const [languagePreference, setPreference] = useState<LanguagePreference>(
    initial.preference,
  );

  useEffect(() => {
    if (initial.shouldPersist) {
      keyVault
        .getEncryptedStorage()
        .set(MMKV_KEYS.languagePreference, initial.preference);
    }
  }, [initial]);

  function setLanguagePreference(preference: LanguagePreference): void {
    keyVault
      .getEncryptedStorage()
      .set(MMKV_KEYS.languagePreference, preference);
    setPreference(preference);
  }

  return {
    languagePreference,
    language:
      languagePreference === 'device'
        ? getDeviceLanguage()
        : languagePreference,
    setLanguagePreference,
  };
}
