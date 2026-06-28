import { useCallback } from 'react';

import i18n from '../i18n';
import type { AppLanguage, LanguageChoice } from '../i18n/locale';
import { useLanguageStore } from '../store/useLanguageStore';
import { isLanguageRTL } from '../utils/direction';

export type { AppLanguage, LanguageChoice };
/** @deprecated Use LanguageChoice */
export type LanguagePreference = LanguageChoice;
/** @deprecated Use AppLanguage */
export type ResolvedLanguage = AppLanguage;

export { getDeviceLanguage } from '../i18n/locale';

interface UseLanguageResult {
  readonly language: AppLanguage;
  readonly isRTL: boolean;
  readonly preference: LanguageChoice;
  readonly languageChoice: LanguageChoice;
  readonly t: (key: string) => string;
}

export function useLanguage(): UseLanguageResult {
  const languageChoice = useLanguageStore(state => state.languageChoice);
  const language = useLanguageStore(state => state.resolvedLanguage);

  const t = useCallback(
    (key: string): string => i18n.t(key),
    [language],
  );

  return {
    language,
    isRTL: isLanguageRTL(language),
    preference: languageChoice,
    languageChoice,
    t,
  };
}
