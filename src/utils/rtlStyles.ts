import { StyleSheet } from 'react-native';

import { useLanguageStore } from '../store/useLanguageStore';

// RTL RULE (ISSUE-RTL-ROOT-FIX-02 — do not regress, see AGENTS §14):
// - Direction is driven NATIVELY by I18nManager (allowRTL in MainApplication.kt +
//   per-language forceRTL in languageService.ts/index.js). Under RTL, Yoga flips a
//   plain `flexDirection: 'row'` automatically — so NEVER hard-code 'row-reverse'
//   or the `flex-row-reverse` className; that double-flips and breaks Hebrew.
// - Text: <AppText> owns textAlign/writingDirection. Never hard-code textAlign.
// - TextInput: inputStyle() follows the resolved language at render time.
export const rtl = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  screen: {
    flex: 1,
  },

  scrollOuter: {
    flex: 1,
  },

  scrollInner: {
    flexGrow: 1,
    paddingBottom: 24,
  },

  listInner: {
    flexGrow: 1,
  },
});

/**
 * TextInput alignment — follows the resolved language (mirrors AppText). Read at
 * render time; callers re-render on language change via useTranslation.
 */
export function inputStyle(): { textAlign: 'left' | 'right' } {
  return {
    textAlign: useLanguageStore.getState().isRTL ? 'right' : 'left',
  };
}
