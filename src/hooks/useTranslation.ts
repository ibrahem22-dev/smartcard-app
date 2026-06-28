import { useCallback } from 'react';

import { enBySource } from '../i18n/en';
import { translateHebrew } from '../i18n/he';
import { useLanguage, type AppLanguage } from './useLanguage';

type TranslationValues = Readonly<Record<string, string | number>>;

export interface UseTranslationResult {
  readonly language: AppLanguage;
  readonly t: (
    source: string,
    values?: TranslationValues,
    englishOverride?: string,
  ) => string;
}

function interpolate(source: string, values?: TranslationValues): string {
  if (values === undefined) {
    return source;
  }

  return Object.entries(values).reduce(
    (result: string, [key, value]: [string, string | number]): string =>
      result.replaceAll(`{{${key}}}`, String(value)),
    source,
  );
}

function translateDynamicEnglish(source: string): string | undefined {
  const exchangeFeeMatch = source.match(
    /^רכישה בחו"ל: בכרטיס זה עשויה לחול עמלת המרה של (.+)%\.$/,
  );
  if (exchangeFeeMatch !== null) {
    return `International purchase: this card may incur a currency conversion fee of ${exchangeFeeMatch[1]}%.`;
  }

  return undefined;
}

export function useTranslation(): UseTranslationResult {
  const { language } = useLanguage();

  const t = useCallback(
    (
      source: string,
      values?: TranslationValues,
      englishOverride?: string,
    ): string => {
      const translated =
        language === 'en'
          ? englishOverride ??
            enBySource[source] ??
            translateDynamicEnglish(source) ??
            source
          : translateHebrew(source);

      return interpolate(translated, values);
    },
    [language],
  );

  return { language, t };
}
