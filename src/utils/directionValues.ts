// @deprecated RTL experiment — NOT used at runtime (no importers).
// Pure re-export shim of ./direction. Kept for reference; safe to delete later.
export type { AppLanguage } from '../i18n/locale';
export {
  getDirectionKey,
  getEndAlign,
  getRowDirection,
  getRowStyle,
  getRootDirectionStyle,
  getStartAlign,
  getTabOrder,
  getTextAlign,
  getTrailingOffset,
  getWritingDirection,
  isLanguageRTL,
  type WritingDirection,
} from './direction';

/** @deprecated Use isLanguageRTL(language) */
export function isRTLForLanguage(language: import('../i18n/locale').AppLanguage): boolean {
  return language === 'he';
}

/** @deprecated Use getRowDirection(language) */
export function getRowFlexDirection(
  language: import('../i18n/locale').AppLanguage,
): 'row-reverse' | 'row' {
  return language === 'he' ? 'row-reverse' : 'row';
}
