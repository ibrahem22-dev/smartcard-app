import type { FlexStyle } from 'react-native';
import { useMemo } from 'react';

import type { AppLanguage, LanguageChoice } from '../i18n/locale';
import { useLanguageStore } from '../store/useLanguageStore';
import {
  getDirectionKey,
  getEndAlign,
  getRowDirection,
  getRowStyle,
  getStartAlign,
  getTextAlign,
  getTrailingOffset,
  getWritingDirection,
  isLanguageRTL,
} from '../utils/direction';

export interface AppDirection {
  readonly language: AppLanguage;
  readonly languageChoice: LanguageChoice;
  readonly isRTL: boolean;
  readonly directionKey: string;
  /** @deprecated Use directionKey */
  readonly navigationKey: string;
  readonly textAlign: 'left' | 'right';
  readonly writingDirection: 'rtl' | 'ltr';
  readonly rowDirection: 'row-reverse' | 'row';
  readonly row: { flexDirection: 'row-reverse' | 'row'; alignItems: 'center' };
  readonly startAlign: FlexStyle['alignItems'];
  readonly endAlign: FlexStyle['alignItems'];
  readonly trailingOffset: (offset: number) => { left?: number; right?: number };
}

export function useAppDirection(): AppDirection {
  const language = useLanguageStore(state => state.resolvedLanguage);
  const languageChoice = useLanguageStore(state => state.languageChoice);

  return useMemo(() => {
    const isRTL = isLanguageRTL(language);

    return {
      language,
      languageChoice,
      isRTL,
      directionKey: getDirectionKey(language),
      navigationKey: getDirectionKey(language),
      textAlign: getTextAlign(language),
      writingDirection: getWritingDirection(language),
      rowDirection: getRowDirection(language),
      row: getRowStyle(language),
      startAlign: getStartAlign(language),
      endAlign: getEndAlign(language),
      trailingOffset: (offset: number) => getTrailingOffset(offset, language),
    };
  }, [language, languageChoice]);
}

/** Stack header back glyph — points toward the screen edge in RTL/LTR. */
export function useStackBackGlyph(): string {
  const language = useLanguageStore(state => state.resolvedLanguage);
  return isLanguageRTL(language) ? '→' : '←';
}
