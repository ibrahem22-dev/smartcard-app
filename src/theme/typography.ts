import type { TextStyle } from 'react-native';

import tokens from '../../assets/brand/typography.tokens.json';
import type { AppLanguage } from '../i18n/locale';

/**
 * THE FROZEN TYPE SYSTEM — Phase 9, integrated under OQ-MDC-027 option 1.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE PACKAGE'S OWN JSON IS THE SOURCE, AND P5's GATE IS WHY
 *
 * The first version of this module transcribed all sixteen tokens into TypeScript by hand — every
 * size, both line heights, every letter spacing. P3's `no-magic-numbers` flagged the ratios, since
 * 1.556 has the shape of a rate, so they were added to `financial-literals.allow.json` with their
 * reasons. P5's version of the same gate refused that, and it was right to:
 *
 *   > *"An exception carried from an earlier campaign is a reviewed decision; one a campaign
 *   > writes for its own new code is that campaign marking its own homework."*
 *
 * T1 had created this file and then written its own permission slip for it. The real answer was
 * that hand-transcribing forty numbers was the mistake. `assets/brand/typography.tokens.json` is
 * now a BYTE-IDENTICAL copy of the canonical package file, the `tokens-swap` gate compares the two
 * on every run, and this module reads it. There is no number here to allowlist, and no
 * transcription to trust.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE PACKAGE GIVES AND WHAT THIS APP USES
 *
 * The canonical file carries `size.desktop` and `size.mobileCompactMax360`, and per-script line
 * heights for Latin, Hebrew and Arabic. The desktop size is used: honouring the compact one means
 * deciding what "compact" is, and the package fixes no breakpoint this app has ever had. Line
 * height is resolved PER SCRIPT because the package gives three and they differ — Arabic sits
 * taller, because its ascenders and descenders travel further, and one number for all three would
 * crowd Arabic or loosen Hebrew.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE FAMILY IS A CONCRETE FACE AND NOT A CSS STACK
 *
 * The package also ships fallback stacks. React Native does not resolve a stack: `fontFamily` names
 * ONE registered face, and a missing name falls back to the system font SILENTLY. So the script
 * picks the family, the weight picks the face, and both come from the twelve files in
 * `assets/fonts`. The stacks are not reproduced, because copying them would suggest a fallback
 * behaviour this platform does not have.
 *
 * DIGITS ARE ALREADY TABULAR. The package records that all three Plex builds are tabular by
 * default and that no `tnum` feature exists in them. `TABULAR_NUMERALS` in `utils/money.ts` is
 * still what makes a column align where `fontVariant` is honoured, and T2's gate still measures it.
 */

/** The three families, by the name each registered face carries. */
export const PLEX_FAMILIES = {
  latin: 'IBMPlexSans',
  hebrew: 'IBMPlexSansHebrew',
  arabic: 'IBMPlexSansArabic',
} as const;

/** The four weights the package ships. Anything else is not available — synthesis is prohibited. */
export const PLEX_WEIGHTS: Readonly<Record<'regular' | 'medium' | 'semibold' | 'bold', number>> = {
  regular: tokens.weights.regular,
  medium: tokens.weights.medium,
  semibold: tokens.weights.semibold,
  bold: tokens.weights.bold,
};

/** Weight → the face suffix of the file that carries it, for all three families. */
const FACE_FOR_WEIGHT: Readonly<Record<number, string>> = {
  [tokens.weights.regular]: 'Regular',
  [tokens.weights.medium]: 'Medium',
  [tokens.weights.semibold]: 'SemiBold',
  [tokens.weights.bold]: 'Bold',
};

/**
 * THE TWELVE APPROVED FILES, as `expo-font` must be given them.
 *
 * Three families times four weights. Verified byte-identical to `04_App_Production/fonts` by the
 * `tokens-swap` gate. Licensed under the SIL Open Font License 1.1; `OFL_1.1_IBM_PLEX.txt` and
 * `FONT_LICENSES_AND_ATTRIBUTION.md` travel beside the faces they cover and must stay there.
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

/** The family a script reads in. Hebrew and Arabic have their own Plex builds; the rest is Latin. */
export function plexFamily(language: AppLanguage, weight: number): string {
  const base = language === 'he' ? PLEX_FAMILIES.hebrew
    : language === 'ar' ? PLEX_FAMILIES.arabic
      : PLEX_FAMILIES.latin;
  const face = FACE_FOR_WEIGHT[weight];
  if (face === undefined) {
    throw new Error(`weight ${String(weight)} is not one of the four the frozen package ships; `
      + 'synthetic weights are prohibited, so there is no face to fall back to');
  }
  return `${base}-${face}`;
}

/**
 * The package writes a token's size EITHER as `{ desktop, mobileCompactMax360 }` or as `{ all }`,
 * depending on whether that token is responsive. Both shapes are real and this reads both. The
 * desktop figure is taken where a token offers one: honouring the compact size means deciding what
 * "compact" is, and the package fixes no breakpoint this app has ever had.
 */
const sizeOf = (size: { desktop?: string; all?: string }): number =>
  Number.parseInt(String(size.desktop ?? size.all), 10);

/** The sixteen token names the package declares. */
export type TypeTokenName = keyof typeof tokens.tokens;

/** Every frozen type size in the package, in points — read by the tokens-swap gate. */
export const FROZEN_TYPE_SIZES: readonly number[] = [
  ...new Set(Object.values(tokens.tokens).map((t) => sizeOf(t.size))),
];

/**
 * A type token resolved for one reader — the only supported way to set a face, a size and a weight.
 *
 * Letter spacing is given in em by the package and React Native takes points, so it is multiplied
 * by the size. That is the unit conversion the platform requires, not a new value: -0.01em at 48px
 * is -0.48pt and nothing was chosen.
 */
export function typeStyle(token: TypeTokenName, language: AppLanguage): TextStyle {
  const t = tokens.tokens[token];
  const sizePx = sizeOf(t.size);
  const lh = language === 'ar' ? t.lineHeight.arabic
    : language === 'he' ? t.lineHeight.hebrew
      : t.lineHeight.latin;
  const tracking = language === 'ar' ? t.letterSpacing.arabic
    : language === 'he' ? t.letterSpacing.hebrew
      : t.letterSpacing.latin;
  return {
    fontFamily: plexFamily(language, t.weight),
    fontSize: sizePx,
    lineHeight: Math.round(sizePx * lh),
    letterSpacing: Number.parseFloat(String(tracking)) * sizePx,
  };
}
