import type { TextStyle } from 'react-native';

import type { AppLanguage } from '../i18n/locale';

/**
 * THE FROZEN TYPE SYSTEM — Phase 9, integrated under OQ-MDC-027 option 1.
 *
 * Every value here is COPIED from the canonical package at
 * `Brand/05_Typography/13_Phase_9_Final_Typography_Package/05_Design_Tokens/typography.tokens.ts`,
 * whose own header says *"Reference output only; integration into an application repository
 * requires separate authorization."* That authorization is OQ-MDC-027 option 1, ruled by the Owner
 * on 2026-09-03. Nothing is derived, rounded or interpolated: three families, four weights, sixteen
 * type tokens, and the sizes and line heights the package froze.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY LINE HEIGHT IS PER SCRIPT AND NOT ONE NUMBER
 *
 * The package gives every token TWO line heights — one for Latin and Hebrew, one for Arabic — and
 * they differ at every size. Arabic sits taller because its ascenders and descenders travel
 * further, and setting one line height for all three scripts crowds Arabic or loosens Hebrew.
 * A single number would have been simpler and would have been an invention, so the pair is kept
 * and `typeStyle` resolves it from the reader's language rather than from a default anybody picked.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE FAMILY IS A CONCRETE FILE NAME AND NOT A CSS STACK
 *
 * The package also ships `ST_FONT_STACKS`, which are CSS fallback lists. React Native does not
 * resolve a stack: `fontFamily` names ONE face that must be registered, and a missing name falls
 * back silently to the system font. So the script picks the family and the weight picks the face,
 * and both come from the twelve files shipped in `assets/fonts`. The stacks are not reproduced
 * here, because copying them would suggest a fallback behaviour this platform does not have.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * DIGITS ARE ALREADY TABULAR
 *
 * `ST_NUMERIC` records that all three Plex builds are tabular by default and that no `tnum`
 * feature exists in them. `TABULAR_NUMERALS` in `utils/money.ts` therefore remains what makes a
 * column align on platforms that honour `fontVariant`; it is not made redundant by the font, and
 * T2's gate still measures it.
 */

/** The three families, by the name each registered face carries. */
export const PLEX_FAMILIES = {
  latin: 'IBMPlexSans',
  hebrew: 'IBMPlexSansHebrew',
  arabic: 'IBMPlexSansArabic',
} as const;

/** The four weights the package freezes. No other weight may be requested. */
export const PLEX_WEIGHTS = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export type PlexWeight = (typeof PLEX_WEIGHTS)[keyof typeof PLEX_WEIGHTS];

/** Weight → the face suffix of the file that carries it, for all three families. */
const FACE_FOR_WEIGHT: Readonly<Record<PlexWeight, string>> = {
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
};

/**
 * THE TWELVE APPROVED FILES, as `expo-font` must be given them.
 *
 * The key is the family name a `fontFamily` may name; the value is the module the bundler resolves.
 * Three families times four weights is twelve, which is exactly what
 * `04_App_Production/fonts` ships and exactly what was copied into `assets/fonts` — verified
 * byte-identical to the approved package. They are licensed under the SIL Open Font License 1.1;
 * `assets/fonts/OFL_1.1_IBM_PLEX.txt` and `FONT_LICENSES_AND_ATTRIBUTION.md` travel with them, and
 * both are required to remain beside the faces they cover.
 */
export const PLEX_FONT_ASSETS = {
  'IBMPlexSans-Regular': require('../../assets/fonts/IBMPlexSans-Regular.ttf'),
  'IBMPlexSans-Medium': require('../../assets/fonts/IBMPlexSans-Medium.ttf'),
  'IBMPlexSans-SemiBold': require('../../assets/fonts/IBMPlexSans-SemiBold.ttf'),
  'IBMPlexSans-Bold': require('../../assets/fonts/IBMPlexSans-Bold.ttf'),
  'IBMPlexSansHebrew-Regular': require('../../assets/fonts/IBMPlexSansHebrew-Regular.ttf'),
  'IBMPlexSansHebrew-Medium': require('../../assets/fonts/IBMPlexSansHebrew-Medium.ttf'),
  'IBMPlexSansHebrew-SemiBold': require('../../assets/fonts/IBMPlexSansHebrew-SemiBold.ttf'),
  'IBMPlexSansHebrew-Bold': require('../../assets/fonts/IBMPlexSansHebrew-Bold.ttf'),
  'IBMPlexSansArabic-Regular': require('../../assets/fonts/IBMPlexSansArabic-Regular.ttf'),
  'IBMPlexSansArabic-Medium': require('../../assets/fonts/IBMPlexSansArabic-Medium.ttf'),
  'IBMPlexSansArabic-SemiBold': require('../../assets/fonts/IBMPlexSansArabic-SemiBold.ttf'),
  'IBMPlexSansArabic-Bold': require('../../assets/fonts/IBMPlexSansArabic-Bold.ttf'),
} as const;

/** The family a script reads in. Hebrew and Arabic have their own Plex builds; everything else is Latin. */
export function plexFamily(language: AppLanguage, weight: PlexWeight): string {
  const base = language === 'he' ? PLEX_FAMILIES.hebrew
    : language === 'ar' ? PLEX_FAMILIES.arabic
      : PLEX_FAMILIES.latin;
  return `${base}-${FACE_FOR_WEIGHT[weight]}`;
}

export interface TypeToken {
  /** What the package says this token is for. Kept so a call site can be checked against intent. */
  readonly role: string;
  readonly weight: PlexWeight;
  readonly sizePx: number;
  /** Latin and Hebrew share a line height; Arabic has its own. Both are frozen values. */
  readonly lineHeightLatinHebrew: number;
  readonly lineHeightArabic: number;
  readonly letterSpacingLatin: number;
}

/**
 * THE SIXTEEN TOKENS, verbatim from the frozen package.
 *
 * `sizePxCompactMobile` is deliberately NOT carried. The package offers it for display-xl,
 * display-l and data-xl on narrow screens, and honouring it means deciding what "compact" is —
 * a breakpoint the package does not fix and this app has never had. Inventing one would be
 * inventing a size. The full sizes are used, and this sentence is why.
 */
export const TYPE = {
  'display-xl': { role: 'Marketing hero, store header', weight: 600, sizePx: 48, lineHeightLatinHebrew: 1.167, lineHeightArabic: 1.25, letterSpacingLatin: -0.01 },
  'display-l': { role: 'Onboarding, feature headers', weight: 600, sizePx: 40, lineHeightLatinHebrew: 1.2, lineHeightArabic: 1.3, letterSpacingLatin: -0.01 },
  h1: { role: 'Screen titles', weight: 600, sizePx: 32, lineHeightLatinHebrew: 1.25, lineHeightArabic: 1.375, letterSpacingLatin: 0 },
  h2: { role: 'Section titles', weight: 600, sizePx: 28, lineHeightLatinHebrew: 1.286, lineHeightArabic: 1.357, letterSpacingLatin: 0 },
  h3: { role: 'Card titles', weight: 600, sizePx: 24, lineHeightLatinHebrew: 1.333, lineHeightArabic: 1.417, letterSpacingLatin: 0 },
  'body-l': { role: 'Intro copy', weight: 400, sizePx: 18, lineHeightLatinHebrew: 1.556, lineHeightArabic: 1.667, letterSpacingLatin: 0 },
  'body-m': { role: 'Default body workhorse', weight: 400, sizePx: 16, lineHeightLatinHebrew: 1.5, lineHeightArabic: 1.625, letterSpacingLatin: 0 },
  'body-s': { role: 'Secondary body, dense cards', weight: 400, sizePx: 14, lineHeightLatinHebrew: 1.429, lineHeightArabic: 1.571, letterSpacingLatin: 0 },
  'label-l': { role: 'Field labels, buttons, nav', weight: 500, sizePx: 16, lineHeightLatinHebrew: 1.25, lineHeightArabic: 1.5, letterSpacingLatin: 0 },
  'label-m': { role: 'Labels, emphasized metadata', weight: 500, sizePx: 14, lineHeightLatinHebrew: 1.286, lineHeightArabic: 1.429, letterSpacingLatin: 0.02 },
  'label-s': { role: 'Badges, chips', weight: 600, sizePx: 12, lineHeightLatinHebrew: 1.333, lineHeightArabic: 1.417, letterSpacingLatin: 0.04 },
  caption: { role: 'Metadata, legal', weight: 400, sizePx: 12, lineHeightLatinHebrew: 1.333, lineHeightArabic: 1.5, letterSpacingLatin: 0 },
  'data-xl': { role: 'Headline amounts', weight: 600, sizePx: 40, lineHeightLatinHebrew: 1.1, lineHeightArabic: 1.25, letterSpacingLatin: -0.005 },
  'data-l': { role: 'Card amounts', weight: 600, sizePx: 32, lineHeightLatinHebrew: 1.188, lineHeightArabic: 1.313, letterSpacingLatin: 0 },
  'data-m': { role: 'Inline emphasized amounts', weight: 600, sizePx: 20, lineHeightLatinHebrew: 1.3, lineHeightArabic: 1.5, letterSpacingLatin: 0 },
  'data-s': { role: 'Metadata numbers, FX quotes', weight: 500, sizePx: 14, lineHeightLatinHebrew: 1.429, lineHeightArabic: 1.571, letterSpacingLatin: 0 },
} as const satisfies Readonly<Record<string, TypeToken>>;

export type TypeTokenName = keyof typeof TYPE;

/**
 * A type token resolved for one reader — the only supported way to set a face, a size or a weight.
 *
 * Letter spacing is given in em by the package and React Native takes points, so it is multiplied
 * by the size. That is the unit conversion the platform requires, not a new value: -0.01em at 48px
 * is -0.48pt and nothing was chosen.
 */
export function typeStyle(token: TypeTokenName, language: AppLanguage): TextStyle {
  const t = TYPE[token];
  const lineHeightRatio = language === 'ar' ? t.lineHeightArabic : t.lineHeightLatinHebrew;
  return {
    fontFamily: plexFamily(language, t.weight),
    fontSize: t.sizePx,
    lineHeight: Math.round(t.sizePx * lineHeightRatio),
    letterSpacing: t.letterSpacingLatin * t.sizePx,
  };
}
