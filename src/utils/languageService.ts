import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import { MMKV } from 'react-native-mmkv';

import { MMKV_KEYS } from '../store/keys';

/**
 * Apply native Yoga layout direction for the resolved locale.
 * allowRTL is always true (native MainApplication.kt also sets this) so Hebrew
 * can be restored after English. forceRTL follows the language: he→true, en→false.
 * Returns true when the direction changed and a JS reload is required.
 */
export function applyNativeRtlDirection(): boolean {
  const shouldBeRTL = isRTLLocale();
  const changed = I18nManager.isRTL !== shouldBeRTL;
  I18nManager.allowRTL(true);
  if (changed) {
    I18nManager.forceRTL(shouldBeRTL);
  }
  return changed;
}

/**
 * Single source of truth for resolving the app's language at the
 * native/boot boundary. The reactive in-app source for components remains
 * `useLanguageStore`; this module exists so that `index.js`, `src/i18n`, and the
 * native RTL bootstrap all resolve the locale the SAME way — including Samsung's
 * legacy 'iw' Hebrew code.
 */

const storage = new MMKV({ id: 'smartcard.preferences' });

/**
 * Resolves the effective language: the stored preference wins; otherwise we fall
 * back to the device locale. Samsung Android returns 'iw' (legacy ISO-639) for
 * Hebrew — normalized to 'he' here. Arabic is treated as Hebrew/RTL elsewhere in
 * the app, so it collapses to 'he'. Defaults to Hebrew (Israeli-first app).
 */
export function getNormalizedLocale(): 'he' | 'en' {
  const stored = storage.getString(MMKV_KEYS.languagePreference);
  // Explicit preference (not device/auto) overrides the device locale.
  if (stored === 'en') return 'en';
  if (stored === 'he' || stored === 'ar') return 'he';

  const raw = (getLocales()[0]?.languageCode ?? 'he').toLowerCase();
  const normalized = raw === 'iw' ? 'he' : raw; // Samsung legacy Hebrew code
  return normalized === 'en' ? 'en' : 'he';
}

/** True when the resolved language is right-to-left (Hebrew/Arabic). */
export function isRTLLocale(): boolean {
  return getNormalizedLocale() === 'he';
}

/**
 * Whether this import flipped the native I18nManager direction. `index.js` reads
 * it to decide if a one-time reload is needed so the new direction takes effect.
 */
export const rtlDirectionChanged: boolean = applyNativeRtlDirection();
