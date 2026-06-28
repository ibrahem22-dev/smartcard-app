import type { AppLanguage } from '../i18n/locale';

export type WritingDirection = 'rtl' | 'ltr';

export type { AppLanguage };

export function isLanguageRTL(language: AppLanguage): boolean {
  return language === 'he';
}

export function getWritingDirection(language: AppLanguage): WritingDirection {
  return isLanguageRTL(language) ? 'rtl' : 'ltr';
}

export function getTextAlign(language: AppLanguage): 'right' | 'left' {
  return isLanguageRTL(language) ? 'right' : 'left';
}

export function getRowDirection(language: AppLanguage): 'row-reverse' | 'row' {
  return isLanguageRTL(language) ? 'row-reverse' : 'row';
}

export function getStartAlign(language: AppLanguage): 'flex-end' | 'flex-start' {
  return isLanguageRTL(language) ? 'flex-end' : 'flex-start';
}

export function getEndAlign(language: AppLanguage): 'flex-start' | 'flex-end' {
  return isLanguageRTL(language) ? 'flex-start' : 'flex-end';
}

export function getDirectionKey(language: AppLanguage): string {
  return `${language}-${getWritingDirection(language)}`;
}

export function getRowStyle(language: AppLanguage): {
  flexDirection: 'row-reverse' | 'row';
  alignItems: 'center';
} {
  return {
    flexDirection: getRowDirection(language),
    alignItems: 'center',
  };
}

// Root container must NOT carry `direction:'rtl'`. It cascaded into RtlRow and
// double-flipped every row (root cause of ISSUE-RTL-01). Mirroring is explicit:
// rows via RtlRow (row-reverse), text via RtlText/AppText (writingDirection).
// `language` kept in the signature for call-site stability.
export function getRootDirectionStyle(_language: AppLanguage): {
  flex: number;
} {
  return { flex: 1 };
}

export function getTrailingOffset(
  offset: number,
  language: AppLanguage,
): { left?: number; right?: number } {
  return isLanguageRTL(language) ? { left: offset } : { right: offset };
}

export function getTabOrder<T>(tabs: readonly T[], language: AppLanguage): T[] {
  return isLanguageRTL(language) ? [...tabs].reverse() : [...tabs];
}

export function getTabsForDirection<T>(tabs: readonly T[], isRTL: boolean): T[] {
  return isRTL ? [...tabs].reverse() : [...tabs];
}
