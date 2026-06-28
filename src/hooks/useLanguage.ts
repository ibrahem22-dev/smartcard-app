import * as Localization from 'expo-localization';
import { useCallback } from 'react';

import i18n from '../i18n';
import {
  useLanguageStore,
  type LanguagePreference,
  type ResolvedLanguage,
} from '../store/useLanguageStore';

export function getDeviceLanguage(): 'he' | 'en' {
  const locales = Localization.getLocales();
  for (const locale of locales) {
    const code = locale.languageCode?.toLowerCase() ?? '';
    if (code === 'en') return 'en';
    // 'iw' — legacy ISO 639-1 Hebrew code returned by Samsung and older Android OEMs
    if (code === 'he' || code === 'iw') return 'he';
  }
  return 'he';
}

if (__DEV__) {
  console.log('[AUTO-DETECT] Raw locales:', Localization.getLocales());
  console.log('[AUTO-DETECT] Resolved:', getDeviceLanguage());
}

export type { LanguagePreference, ResolvedLanguage } from '../store/useLanguageStore';
export type AppLanguage = ResolvedLanguage;

interface UseLanguageResult {
  readonly language: ResolvedLanguage;
  readonly isRTL: boolean;
  readonly preference: LanguagePreference;
  readonly t: (key: string) => string;
}

export function useLanguage(): UseLanguageResult {
  const preference = useLanguageStore(state => state.preference);
  const language = useLanguageStore(state => state.resolved);
  const isRTL = useLanguageStore(state => state.isRTL);

  const t = useCallback(
    (key: string): string => i18n.t(key),
    [language],
  );

  return {
    language,
    isRTL,
    preference,
    t,
  };
}
