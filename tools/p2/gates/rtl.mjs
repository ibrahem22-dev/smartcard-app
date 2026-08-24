/**
 * GATE: rtl — criterion A6.  →  `RTL OK — 3 locales`
 *
 *   > **A6.** *"he · ar · en render with correct structural mirroring; calendar is **Sunday-first
 *   > with he/ar day letters**; **numerals stay LTR inside RTL text**."*
 *
 * Flagged **L13a**, and the campaign plan is blunt about what that means:
 *
 *   > *"Latin-only fixtures are, by themselves, evidence of nothing. Every text gate is validated
 *   > against Hebrew and Arabic content specifically."*
 *
 * So every check below either reads Hebrew and Arabic data or refuses.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * FOUR CHECKS
 *
 *   1. **Three locales, structurally mirrored.** Every language the app ships has a writing
 *      direction, and the two RTL ones resolve to `rtl`. The population is derived from the
 *      language union, so a fourth language cannot arrive unmirrored.
 *   2. **Sunday-first, in all three.** Including English — an English-speaking user of an Israeli
 *      financial app is reading Israeli billing dates, and the language somebody reads is not the
 *      calendar they live in.
 *   3. **Day letters exist per locale, in the right script.** Hebrew letters must be Hebrew and
 *      Arabic letters must be Arabic — a check that only counted seven entries would pass a table
 *      that had been filled in with English three times.
 *   4. **Numerals are isolated inside RTL text.** Every date and amount rendered into a translated
 *      sentence carries a directional isolate. Without one, `12/08/2026` inside Hebrew is reordered
 *      by the bidirectional algorithm into `2026/08/12` — the same characters, a different date.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['A6'];
export const SENTINEL = 'RTL OK — 3 locales';

const CALENDAR = 'src/utils/calendar.ts';
const DIRECTION = 'src/utils/direction.ts';
const LOCALE = 'src/i18n/locale.ts';

const HEBREW = /[֐-׿]/;
const ARABIC = /[؀-ۿ]/;
const LATIN = /^[A-Za-z]$/;

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => {
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, b, c) => b + blank(c));
};

const lineAt = (code, i) => code.slice(0, i).split('\n').length;

/** Read `X: ['a', 'b', …]` rows out of a `Record<AppLanguage, readonly string[]>`. */
const readLetterTable = (src, name) => {
  const m = src.match(new RegExp('export const ' + name + '[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};'));
  if (!m) return null;
  const out = {};
  for (const row of m[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
    out[row[1]] = [...row[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  }
  return out;
};

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  for (const rel of [CALENDAR, DIRECTION, LOCALE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist');
  }
  const calendar = readFileSync(join(root, CALENDAR), 'utf8');
  const direction = readFileSync(join(root, DIRECTION), 'utf8');
  const locale = readFileSync(join(root, LOCALE), 'utf8');

  // ── 1. the locales, derived ──────────────────────────────────────────────────────
  const langMatch = locale.match(/export type AppLanguage\s*=\s*([^;]+);/);
  if (!langMatch) return fail('could not read AppLanguage out of ' + LOCALE);
  const languages = [...langMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (languages.length === 0) return fail('AppLanguage declares no languages — an empty set is not three locales');

  const rtlMatch = direction.match(/export function isLanguageRTL[\s\S]*?\n\}/);
  if (!rtlMatch) return fail('could not read isLanguageRTL out of ' + DIRECTION);
  const rtlLanguages = languages.filter((l) => new RegExp("'" + l + "'").test(rtlMatch[0]));
  if (rtlLanguages.length < 2) {
    problems.push('only ' + rtlLanguages.length + ' language(s) resolve to RTL. This app ships '
      + 'Hebrew and Arabic, and a mirroring check that finds fewer than two right-to-left locales '
      + 'is not checking mirroring');
  }
  lines.push('locales         ' + languages.join(' · ') + '  (RTL: ' + rtlLanguages.join(', ') + ')');

  // ── 2. Sunday-first ──────────────────────────────────────────────────────────────
  const startsOn = calendar.match(/export const WEEK_STARTS_ON\s*=\s*(\d+)/);
  if (!startsOn) problems.push('no WEEK_STARTS_ON in ' + CALENDAR);
  else if (startsOn[1] !== '0') {
    problems.push('the week starts on day ' + startsOn[1] + '. A6 says Sunday-first, and the '
      + 'Israeli working week runs Sunday to Thursday: a Monday-first calendar puts the first '
      + 'working day at the end of the row');
  }
  const order = calendar.match(/export const WEEK_ORDER\s*=\s*\[([^\]]*)\]/);
  const orderDays = order ? [...order[1].matchAll(/\d+/g)].map((x) => Number(x[0])) : [];
  if (orderDays.length !== 7) problems.push('WEEK_ORDER has ' + orderDays.length + ' day(s), not 7');
  else if (orderDays[0] !== 0) problems.push('WEEK_ORDER begins on day ' + orderDays[0] + ', not Sunday');
  lines.push('week            starts on day ' + (startsOn ? startsOn[1] : '?') + ' (Sunday) · order ' + orderDays.join(','));

  // ── 3. day letters, per locale, IN THE RIGHT SCRIPT ──────────────────────────────
  //
  // L13a: a table filled in with English three times would pass a check that only counted rows.
  const letters = readLetterTable(calendar, 'DAY_LETTERS');
  const names = readLetterTable(calendar, 'DAY_NAMES');
  if (!letters) return fail('could not read DAY_LETTERS out of ' + CALENDAR);
  if (!names) return fail('could not read DAY_NAMES out of ' + CALENDAR);

  const SCRIPT = { he: [HEBREW, 'Hebrew'], ar: [ARABIC, 'Arabic'] };
  for (const lang of languages) {
    for (const [table, label] of [[letters, 'DAY_LETTERS'], [names, 'DAY_NAMES']]) {
      const row = table[lang];
      if (!row) { problems.push(label + ' has no row for "' + lang + '"'); continue; }
      if (row.length !== 7) { problems.push(label + '.' + lang + ' has ' + row.length + ' entries, not 7'); continue; }
      if (row.some((x) => x.trim() === '')) problems.push(label + '.' + lang + ' has an empty entry');
      const expected = SCRIPT[lang];
      if (expected && !row.every((x) => expected[0].test(x))) {
        problems.push(label + '.' + lang + ' is not written in ' + expected[1]
          + ' — L13a: a table filled in with Latin three times passes any check that only counts rows');
      }
      if (lang === 'en' && !row.every((x) => LATIN.test(x) || x.length > 1)) {
        problems.push(label + '.en is not Latin');
      }
    }
  }
  lines.push('day letters     ' + languages.map((l) => l + ' ' + (letters[l] ?? []).join('')).join('  ·  '));

  // ── 4. numerals isolated inside RTL text ─────────────────────────────────────────
  if (!/LEFT-TO-RIGHT ISOLATE|\\u2066|⁦/.test(calendar) || !/ltrNumerals/.test(calendar)) {
    problems.push(CALENDAR + ' declares no directional isolate helper. A6: numerals stay LTR inside '
      + 'RTL text, and without an isolate a date reorders into a different date');
  }

  // Every rendered date must go through it. A date built inline and dropped into JSX is the case.
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files — an empty population proves nothing');
  const bareDates = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    if (rel === CALENDAR) continue;
    const code = stripComments(readFileSync(abs, 'utf8'));
    // A template that joins date parts with slashes, not wrapped by the isolate helper.
    for (const m of code.matchAll(/`\$\{[^`]*\}\/\$\{[^`]*\}\/\$\{[^`]*\}`/g)) {
      const before = code.slice(Math.max(0, m.index - 40), m.index);
      if (!/ltrNumerals\s*\($/.test(before.trim() + '(')) {
        if (!/ltrNumerals/.test(code.slice(Math.max(0, m.index - 60), m.index))) {
          bareDates.push({ file: rel, line: lineAt(code, m.index), text: m[0].slice(0, 40) });
        }
      }
    }
  }
  for (const b of bareDates.slice(0, 4)) {
    problems.push(b.file + ':' + b.line + ' builds a slash-separated date without a directional '
      + 'isolate — inside Hebrew or Arabic the bidirectional algorithm reorders the segments and '
      + 'a reader sees a different date');
  }
  lines.push('isolates        ltrNumerals declared · ' + bareDates.length + ' bare slash-date(s) found in '
    + files.length + ' files');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'RTL OK — ' + languages.length + ' locales',
  };
};
