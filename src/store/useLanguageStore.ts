import { MMKV } from 'react-native-mmkv';
import { create } from 'zustand';

import { getDeviceLanguage } from '../hooks/useLanguage';
import { MMKV_KEYS } from './keys';

export type LanguagePreference = 'auto' | 'he' | 'en';
export type ResolvedLanguage = 'he' | 'en';

const storage = new MMKV({ id: 'smartcard.preferences' });

function isLanguagePreference(value: string): value is LanguagePreference {
  return value === 'auto' || value === 'he' || value === 'en';
}

function readStoredPreference(): LanguagePreference | undefined {
  const stored = storage.getString(MMKV_KEYS.languagePreference);
  if (stored === undefined) {
    return undefined;
  }
  if (isLanguagePreference(stored)) {
    return stored;
  }
  // Legacy values: 'device' → auto, 'ar' → he (stored as preference, resolved below)
  if (stored === 'device') {
    return 'auto';
  }
  if (stored === 'ar') {
    return 'he';
  }
  return undefined;
}

export function resolveLanguage(
  pref: LanguagePreference | undefined,
): ResolvedLanguage {
  if (!pref || pref === 'auto') return getDeviceLanguage();
  return pref === 'en' ? 'en' : 'he';
}

function deriveState(preference: LanguagePreference): {
  preference: LanguagePreference;
  resolved: ResolvedLanguage;
  isRTL: boolean;
} {
  const resolved = resolveLanguage(preference);
  return {
    preference,
    resolved,
    isRTL: resolved === 'he',
  };
}

function readInitialPreference(): LanguagePreference {
  return readStoredPreference() ?? 'auto';
}

interface LanguageState {
  preference: LanguagePreference;
  resolved: ResolvedLanguage;
  isRTL: boolean;
  setPreference: (pref: LanguagePreference) => void;
}

const initialState = deriveState(readInitialPreference());

export const useLanguageStore = create<LanguageState>(set => ({
  ...initialState,
  setPreference: (pref: LanguagePreference): void => {
    storage.set(MMKV_KEYS.languagePreference, pref);
    set(deriveState(pref));
  },
}));
