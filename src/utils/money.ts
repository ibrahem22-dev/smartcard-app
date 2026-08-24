import type { TextStyle } from 'react-native';

import type { AppLanguage } from '../i18n/locale';
import {
  MONEY_FRACTION_DIGITS,
  PERCENT_MAX_FRACTION_DIGITS,
} from '../config/financial';

/**
 * THE ONE MONEY FORMATTER — criterion A7.
 *
 *   > **A7.** *"A Hebrew fall-through audit makes untranslated dynamic strings visible, not silent;
 *   > **exactly one money formatter exists**; tabular numerals applied app-wide."*
 *
 * Before this file there were eight, in five screens, and every one of them hardcoded `'he-IL'` —
 * so an Arabic or English reader saw amounts grouped by Hebrew conventions regardless of the
 * language they had chosen. Three of the eight also disagreed about decimals: one showed none, one
 * showed two, one showed as many as the number had.
 *
 * That is the shape this campaign keeps meeting. Nobody decided the app should format money three
 * ways; three screens each made a local decision and nothing compared them.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY ARABIC USES LATIN DIGITS — PD-007, and it is a real choice rather than an oversight
 *
 * `Intl` renders `ar` locales with Arabic-Indic digits (٣٥٠) by default. In Israeli banking,
 * statements, card terminals and issuer apps use Latin digits, and an Arabic-speaking user
 * reconciling this app against a bank statement would be reading two different numeral systems for
 * the same number. So the Arabic locale is requested with `-u-nu-latn`: Arabic language, Latin
 * digits. The alternative was defensible and it is written down here rather than left implicit.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE CURRENCY SYMBOL IS NOT PART OF THE NUMBER
 *
 * `formatAmount` returns digits only. `formatMoney` adds the shekel sign. Keeping them separate is
 * what lets a table column show amounts with the symbol in its header — and stops a formatter from
 * being copied and stripped, which is how the eighth one appeared.
 */

/** Every language the app ships, mapped to the locale its NUMBERS are formatted in. */
const NUMBER_LOCALE: Readonly<Record<AppLanguage, string>> = {
  he: 'he-IL',
  // Arabic language, Latin digits. See the header.
  ar: 'ar-IL-u-nu-latn',
  en: 'en-IL',
};

/** The one currency this app deals in. Named so a reader can find every use of it. */
export const CURRENCY_SIGN = '₪';

/**
 * TWO DECIMALS, ALWAYS, FOR MONEY — and the constant lives in `config/financial.ts`, not here.
 *
 * The screens variously used 0, 2, and "as many as it has". "As many as it has" is the dangerous
 * one: ₪1234.5 and ₪1234.50 are the same amount, and a column where some rows have two decimals and
 * others one cannot be read down. Money that rounds to the agora is money a reader can compare.
 *
 * It was declared here first, and the §9.4 boundary lint flagged it as a financial literal outside
 * `config/**` — correctly. It reads like typography and it is not: at 0 decimals this app would
 * render ₪1,234.56 as ₪1,235 on every screen at once, which is a false statement about an amount by
 * up to half a shekel. The test is whether the number, if wrong, could tell a user something false
 * about their money.
 */

/** Digits only, grouped for the reader's language. No currency sign. */
export function formatAmount(
  value: number,
  language: AppLanguage,
  fractionDigits: number = MONEY_FRACTION_DIGITS,
): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[language], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * An amount with the shekel sign, placed where the language puts it.
 *
 * Hebrew and Arabic are read right-to-left and put the sign before the digits as rendered; English
 * puts it first too. The sign leads in all three, so the difference is handled by the surrounding
 * layout (RtlRow / writingDirection) rather than by reversing the string here — a formatter that
 * reordered text would fight the direction handling instead of cooperating with it.
 */
export function formatMoney(
  value: number,
  language: AppLanguage,
  fractionDigits: number = MONEY_FRACTION_DIGITS,
): string {
  return `${CURRENCY_SIGN}${formatAmount(value, language, fractionDigits)}`;
}

/**
 * A percentage, with the same locale discipline.
 *
 * Two decimals maximum and no trailing zeros: unlike money, 2.5% and 2.50% read identically and the
 * shorter form is what every issuer publishes. A rate is quoted, not reconciled.
 */
export function formatPercent(value: number, language: AppLanguage): string {
  const digits = new Intl.NumberFormat(NUMBER_LOCALE[language], {
    maximumFractionDigits: PERCENT_MAX_FRACTION_DIGITS,
  }).format(value);
  return `${digits}%`;
}

/**
 * TABULAR NUMERALS — A7's third clause.
 *
 * Proportional digits are different widths, so a column of amounts does not line up and the eye
 * cannot compare magnitudes down a list.
 *
 * A STYLE OBJECT, NOT A CLASS NAME. The first version exported the string
 * `'font-variant-numeric-tabular'`, which is not a class Tailwind ships and not one NativeWind
 * would have produced — it would have been applied to every amount in the app, rendered nothing,
 * and passed any check that only asked whether the token was used. React Native takes this as the
 * `fontVariant` style prop, so that is what it is.
 *
 * Exported from here rather than from the token module because it is typography and not colour: A7
 * asks for it, A8 does not, and putting it in `theme/tokens.ts` would put a non-colour under a gate
 * that counts colours.
 */
export const TABULAR_NUMERALS: TextStyle = { fontVariant: ['tabular-nums'] };
