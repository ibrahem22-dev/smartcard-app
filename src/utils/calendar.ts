import type { AppLanguage } from '../i18n/locale';

/**
 * THE CALENDAR'S LOCALIZATION — criterion A6.
 *
 *   > **A6.** *"he · ar · en render with correct structural mirroring; **calendar is Sunday-first
 *   > with he/ar day letters**; numerals stay LTR inside RTL text."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * SUNDAY-FIRST IS NOT A PREFERENCE, IT IS WHERE THE APP IS
 *
 * The Israeli working week runs Sunday to Thursday. A calendar that starts on Monday — the default
 * almost everywhere else, and what `Intl` gives for most locales — puts the first working day at
 * the end of the row, and every user has to re-read the header to find today. It is the kind of
 * wrongness nobody reports as a bug and everybody notices.
 *
 * **All three languages get Sunday-first**, including English: an English-speaking user of an
 * Israeli financial app is looking at Israeli billing dates. The language a person reads is not the
 * calendar they live in.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE DAY LETTERS ARE WRITTEN OUT AND NOT COMPUTED
 *
 * `Intl.DateTimeFormat(locale, { weekday: 'narrow' })` would look like the right answer and is not,
 * for Hebrew: it returns the day NAMES abbreviated by the CLDR, which for Hebrew are the letters
 * א׳ ב׳ ג׳ — and on some runtimes returns two-character forms, on others one. React Native's Hermes
 * ships a trimmed ICU, and what a device returns depends on which ICU it was built with. A header
 * row whose width changes by platform is a layout that breaks on one phone and not another.
 *
 * So the letters are data. Hebrew uses the traditional letter-numerals; Arabic uses the first
 * letter of each day name; English uses the conventional single letters. Each is checkable by a
 * reader who speaks the language, which a call into ICU is not.
 */

/** Sunday-first, and the same in all three languages. See the header. */
export const WEEK_STARTS_ON = 0 as const;

/** Day indexes in render order: Sunday first, whatever the language. */
export const WEEK_ORDER = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * One letter per day, indexed Sunday..Saturday.
 *
 * Hebrew: א ב ג ד ה ו ש — the traditional letter-numerals, with ש for שבת rather than ז, because
 * that is what a Hebrew calendar prints.
 * Arabic: ح ن ث ر خ ج س — first letters of الأحد, الاثنين, الثلاثاء, الأربعاء, الخميس, الجمعة, السبت.
 */
export const DAY_LETTERS: Readonly<Record<AppLanguage, readonly string[]>> = {
  he: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
  ar: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};

/** The full day names, for an accessibility label — a single letter read aloud is not a day. */
export const DAY_NAMES: Readonly<Record<AppLanguage, readonly string[]>> = {
  he: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

/**
 * THE UNICODE MARKS THAT KEEP A NUMBER READING LEFT-TO-RIGHT INSIDE RIGHT-TO-LEFT TEXT.
 *
 * A6's third clause. Left on its own, a date like `12/08/2026` inside a Hebrew sentence is laid out
 * by the bidirectional algorithm as a neutral run between RTL text — and the SLASHES are neutral
 * too, so the segments reorder and a user reads `2026/08/12`. Not a rendering artefact: the same
 * characters, in a different order, meaning a different date.
 *
 * U+2066 LEFT-TO-RIGHT ISOLATE opens a run that is laid out left-to-right and, crucially, whose
 * direction cannot leak into the text around it. U+2069 POP DIRECTIONAL ISOLATE closes it.
 *
 * Isolates rather than the older embedding marks (U+202A/U+202C) because an embedding affects the
 * surrounding text's resolution and an isolate does not — which is exactly what "inside RTL text"
 * asks for.
 */
export const LRI = '⁦';
export const PDI = '⁩';

/**
 * Wrap a numeric run so it survives being placed inside right-to-left text.
 *
 * Applied to anything with internal structure a reader depends on: dates, card last-four, amounts
 * with separators, percentages. A bare integer needs no isolate, but wrapping one costs nothing and
 * a rule with an exception is a rule somebody applies inconsistently.
 */
export function ltrNumerals(text: string): string {
  return `${LRI}${text}${PDI}`;
}

/** True when the string already carries an isolate — so wrapping is not applied twice. */
export function isIsolated(text: string): boolean {
  return text.startsWith(LRI) && text.endsWith(PDI);
}

/**
 * The day-of-week index for a `YYYY-MM-DD` string, Sunday = 0.
 *
 * Parsed by hand rather than through `new Date(string)`: that constructor treats a bare
 * `YYYY-MM-DD` as UTC midnight, so east of Greenwich it can report the previous day. A billing date
 * that lands on the wrong day of the week is a calendar that is wrong for every user in Israel.
 */
export function dayOfWeek(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return Number.NaN;
  return new Date(y, m - 1, d).getDay();
}
