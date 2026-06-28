import { enBySource } from './en';
import { translateHebrew } from './he';
import { getNormalizedLocale, type AppLanguage } from './locale';

export type I18nLanguage = AppLanguage;

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
