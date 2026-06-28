import { getLocales } from 'expo-localization';
import { MMKV } from 'react-native-mmkv';

import { MMKV_KEYS } from '../store/keys';

export type AppLanguage = 'en' | 'he';
export type LanguageChoice = 'auto' | 'en' | 'he';

/** @deprecated Use LanguageChoice */
export type LanguagePreference = LanguageChoice;

/** @deprecated Use AppLanguage */
export type ResolvedLanguage = AppLanguage;

const storage = new MMKV({ id: 'smartcard.preferences' });

function isLanguageChoice(value: string): value is LanguageChoice {
  return value === 'auto' || value === 'he' || value === 'en';
}

export function readStoredLanguageChoice(): LanguageChoice | undefined {
  const stored = storage.getString(MMKV_KEYS.languagePreference);
  if (stored === undefined) {
    return undefined;
  }
  if (isLanguageChoice(stored)) {
    return stored;
  }
  if (stored === 'device') {
    return 'auto';
  }
  if (stored === 'ar') {
    return 'he';
  }
  return undefined;
}

export function persistLanguageChoice(choice: LanguageChoice): void {
  storage.set(MMKV_KEYS.languagePreference, choice);
}

/** Device locale — Samsung returns 'iw' for Hebrew. Defaults to Hebrew. */
export function getDeviceLanguage(): AppLanguage {
  const locales = getLocales();
  for (const locale of locales) {
    const code = locale.languageCode?.toLowerCase() ?? '';
    if (code === 'en') {
      return 'en';
    }
    if (code === 'he' || code === 'iw') {
      return 'he';
    }
  }
  return 'he';
}

export function resolveLanguage(choice: LanguageChoice | undefined): AppLanguage {
  if (!choice || choice === 'auto') {
    return getDeviceLanguage();
  }
  return choice === 'en' ? 'en' : 'he';
}

/**
 * Boot-time locale from MMKV + device. No Zustand — safe for index.js.
 */
export function getNormalizedLocale(): AppLanguage {
  const stored = storage.getString(MMKV_KEYS.languagePreference);
  if (stored === 'en') {
    return 'en';
  }
  if (stored === 'he' || stored === 'ar') {
    return 'he';
  }
  return getDeviceLanguage();
}

export function isRTLLocale(): boolean {
  return getNormalizedLocale() === 'he';
}
