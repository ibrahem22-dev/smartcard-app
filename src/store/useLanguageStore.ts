import { create } from 'zustand';

import i18n from '../i18n';
import {
  getDeviceLanguage,
  persistLanguageChoice,
  readStoredLanguageChoice,
  resolveLanguage,
  type AppLanguage,
  type LanguageChoice,
} from '../i18n/locale';

export type { AppLanguage, LanguageChoice };
/** @deprecated Use LanguageChoice */
export type LanguagePreference = LanguageChoice;
/** @deprecated Use AppLanguage */
export type ResolvedLanguage = AppLanguage;

export { getDeviceLanguage, resolveLanguage };

function deriveState(choice: LanguageChoice): {
  languageChoice: LanguageChoice;
  resolvedLanguage: AppLanguage;
} {
  const resolvedLanguage = resolveLanguage(choice);
  return { languageChoice: choice, resolvedLanguage };
}

function readInitialChoice(): LanguageChoice {
  return readStoredLanguageChoice() ?? 'auto';
}

interface LanguageState {
  languageChoice: LanguageChoice;
  resolvedLanguage: AppLanguage;
  isHydrated: boolean;
  setLanguageChoice: (choice: LanguageChoice) => void;
  hydrateLanguage: () => void;
}

const initialChoice = readInitialChoice();
const initialState = deriveState(initialChoice);

export const useLanguageStore = create<LanguageState>(set => ({
  ...initialState,
  isHydrated: true,
  hydrateLanguage: (): void => {
    const choice = readStoredLanguageChoice() ?? 'auto';
    const next = deriveState(choice);
    i18n.changeLanguage(next.resolvedLanguage);
    set({ ...next, isHydrated: true });
  },
  setLanguageChoice: (choice: LanguageChoice): void => {
    persistLanguageChoice(choice);
    const next = deriveState(choice);
    i18n.changeLanguage(next.resolvedLanguage);
    set(next);
  },
}));
