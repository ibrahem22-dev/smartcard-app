import { enBySource } from './en';
import { translateHebrew } from './he';
import { getNormalizedLocale } from '../utils/languageService';

export type I18nLanguage = 'he' | 'en';

// languageService is the single source of locale resolution (handles Samsung
// 'iw'→'he' and the stored preference). Never read getLocales() directly here.
let currentLanguage: I18nLanguage = getNormalizedLocale();

const i18n = {
  changeLanguage(lang: I18nLanguage): void {
    currentLanguage = lang;
  },
  get language(): I18nLanguage {
    return currentLanguage;
  },
  t(key: string): string {
    if (currentLanguage === 'en') {
      return enBySource[key] ?? key;
    }
    return translateHebrew(key);
  },
};

export default i18n;
