/**
 * GATE: calendar-scope-guard — criterion K4.  →  `CALENDAR-SCOPE-GUARD OK`
 *
 *   > **K4.** *"Two prohibitions hold: the calendar carries financial commitments only and never
 *   > general expense tracking, and no forward-looking market-holiday date is assembled or shipped
 *   > without a named Owner-approved authority."*
 *
 * MEASURES: 'source'. Both clauses are refusals, and a refusal is measured by looking for the thing
 * refused.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * PROHIBITION ONE: A CALENDAR IS THE EASIEST PLACE IN ANY FINANCE APP TO BECOME A SPENDING DIARY
 *
 * The screen already has days, amounts and a day sheet. Adding *what you spent* to a grid that
 * already shows *what leaves* is a small edit and a completely different product — and unlike
 * `J5`'s equivalent on Plan, here the shape is already right, so nothing about the layout would
 * resist it. That is precisely why the prohibition is written down.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * PROHIBITION TWO: THE AUTHORITY DOOR EXISTS, AND THIS STOPS THE SURFACE WALKING AROUND IT
 *
 * P2's criterion `C9` already governs market holidays at the data layer: *"A BOI market-holiday
 * calendar is supplied to `stalenessOf` **or** its absence is a dated `DEFERRED` entry carrying an
 * OD id. A holiday must not read as an ordinary publication day."*
 *
 * That door is at the data layer. K4 closes the corridor around it: a calendar SCREEN that assembles
 * its own list of holiday dates has produced forward-looking market data with no authority behind
 * it, and it will look completely ordinary — an array of dates, in a UI file, that nobody thinks to
 * ask the provenance of. The dates might even be right this year. That is not the test; **who says
 * so** is the test, and a hardcoded array answers "nobody".
 *
 * So the gate refuses date-table shapes under the calendar surface, and it says which it found.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE POPULATION IS DERIVED, AND AN EMPTY ONE FAILS
 *
 * §2 rule 4 and rule 5. Everything under `src/screens/calendar/`, plus `CalendarScreen` itself.
 *
 * NEGATIVE CONTROL (contract §K4): plant a holiday table in the calendar's own data and watch the
 * authority door refuse it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['K4'];
export const SENTINEL = 'CALENDAR-SCOPE-GUARD OK';
export const MEASURES = 'source';

const CALENDAR_DIR = 'src/screens/calendar';
const SCREEN = 'src/screens/CalendarScreen.tsx';

/** Expense tracking, in the shape it would arrive in on a calendar. */
const EXPENSE_TRACKING = [
  [/\bspentOn\b|\bspending\w*/i, 'tracks spending'],
  [/\bexpenseLog\b|\bexpenses\b/i, 'keeps expenses'],
  [/\breceipt\w*/i, 'records receipts'],
  [/\bcategorize\w*|\bsetCategory\b/i, 'categorizes'],
  [/\bbudget\w*/i, 'budgets'],
];

/**
 * A forward-looking date table assembled in a UI file. The shape is what gives it away: several
 * ISO dates in one literal, next to a word about holidays or market closure.
 */
const HOLIDAY_TABLE = [
  [/\bholidays?\b[^\n]{0,40}=\s*\[/i, 'assembles a holiday list'],
  [/\[[^\]]*['"`]\d{4}-\d{2}-\d{2}['"`][^\]]*['"`]\d{4}-\d{2}-\d{2}['"`][^\]]*\]/, 'declares a literal table of dates'],
  [/\bmarketClosed\b|\bnonPublicationDays?\b|\bclosedDates\b/i, 'names market-closure dates'],
  [/\bBOI_HOLIDAYS\b|\bHOLIDAY_DATES\b/i, 'declares a holiday constant'],
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const walk = (abs, acc = []) => {
  if (!existsSync(abs)) return acc;
  for (const entry of readdirSync(abs)) {
    const p = join(abs, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
};

export const run = async ({ root }) => {
  const files = walk(join(root, CALENDAR_DIR));
  if (existsSync(join(root, SCREEN))) files.push(join(root, SCREEN));
  if (files.length === 0) {
    return fail(
      'no calendar modules found under ' + CALENDAR_DIR + ' — a scope guard over zero files passes silently '
        + 'and proves nothing (§2 rule 5), so an empty population is a failure',
    );
  }

  const problems = [];
  for (const abs of files) {
    const rel = abs.slice(root.length + 1).replace(/\\/g, '/');
    const src = stripComments(readFileSync(abs, 'utf8'));

    for (const [re, why] of EXPENSE_TRACKING) {
      const hit = src.match(re);
      if (hit) {
        problems.push(
          rel + ' ' + why + ' ("' + hit[0] + '"). A calendar is the easiest place in a finance app to become a spending '
            + 'diary: it already has days, amounts and a day sheet, so adding what you SPENT to a grid showing what '
            + 'LEAVES is a small edit and a different product — and the layout would not resist it',
        );
        break;
      }
    }

    for (const [re, why] of HOLIDAY_TABLE) {
      const hit = src.match(re);
      if (hit) {
        problems.push(
          rel + ' ' + why + ' (' + String(hit[0]).slice(0, 48) + '). That is forward-looking market data with no '
            + 'authority behind it. P2\'s C9 put the door at the data layer — supplied to stalenessOf, or a dated '
            + 'DEFERRED entry with an OD id — and a table in a UI file walks around it. The dates might even be right '
            + 'this year; who says so is the test, and a hardcoded array answers "nobody"',
        );
        break;
      }
    }
  }

  if (problems.length) return fail(problems.join(' · '));

  return ok(SENTINEL, [
    'CRITERION K4 — the calendar\'s two prohibitions, over ' + files.length + ' derived module(s).',
    'No general expense tracking. The screen already has days, amounts and a day sheet, so adding what',
    '  you SPENT to a grid that shows what LEAVES is a small edit into a different product, and unlike',
    '  Plan\'s equivalent guard the shape here is already right — nothing about the layout resists it.',
    'And no forward-looking market-holiday date assembled on this surface. P2\'s C9 already put that',
    '  door at the data layer; this closes the corridor around it. A holiday table in a UI file is',
    '  market data with no authority behind it, and it looks entirely ordinary — an array of dates',
    '  nobody thinks to ask the provenance of. The dates might be right this year; WHO SAYS SO is the',
    '  test, and a hardcoded array answers "nobody".',
  ].join('\n'));
};
