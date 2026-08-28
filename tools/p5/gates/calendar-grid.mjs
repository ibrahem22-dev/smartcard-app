/**
 * GATE: calendar-grid — criterion K1.  →  `CALENDAR-GRID OK`
 *
 *   > **K1.** *"The month grid is Sunday-first with he, ar and en day letters, localized."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ONE PLACE DECIDES WHERE THE WEEK BEGINS
 *
 * `WEEK_ORDER` in `src/utils/calendar.ts` is Sunday-first, and `WeekHeader` already renders it. A
 * grid that wrote its own `[0,1,2,3,4,5,6]` would agree with the header today and stop agreeing the
 * moment either changed — and the symptom would be every date sitting under the wrong letter, which
 * is the kind of wrong that looks like a rendering glitch rather than a data bug.
 *
 * So this gate requires the grid to import `WEEK_ORDER` and refuses a local day-index array.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE MIRRORING TRAP, WHICH `WeekHeader`'s OWN COMMENT ALREADY DOCUMENTS
 *
 * From that file, verbatim: *"`WEEK_ORDER` is Sunday-first as an ARRAY. In Hebrew and Arabic the
 * writing direction already lays a plain row out right-to-left, so Sunday lands in the rightmost
 * cell — which is where a Hebrew calendar puts it. Wrapping this in a direction-aware row would
 * reverse the array TOO, and two reversals cancel."*
 *
 * The grid has to lay out the same way. A `RtlRow` around the week rows would mirror the dates once
 * while the header mirrored zero times, and the two would disagree by exactly one reflection. This
 * gate therefore refuses a direction-aware row wrapper on the grid's weeks — and says why, because
 * the next person to see an unmirrored row here will assume it is an oversight. It is not.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE GRID IS A LAYOUT
 *
 * It arranges days. Markers are `K2`, the day sheet is `K3`. A grid that computed a risk level or
 * summed a day's charges would be doing two criteria's work and B1's forbidden third.
 *
 * NEGATIVE CONTROL (contract §K1): switch the grid to Monday-first and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['K1'];
export const SENTINEL = 'CALENDAR-GRID OK';
export const MEASURES = 'render';

const ARRANGE = 'src/screens/calendar/monthGrid.ts';
const GRID = 'src/screens/calendar/MonthGrid.tsx';
const SCREEN = 'src/screens/CalendarScreen.tsx';
const SUITE = 'src/screens/calendar/__tests__/monthGrid.render.test.tsx';
const CALENDAR = 'src/utils/calendar.ts';
const HEADER = 'src/components/WeekHeader.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'lays the columns out in the order WEEK_ORDER declares',
  'renders day letters for he, ar and en',
  'starts the week on Sunday in every language',
  'renders a rectangular grid with neighbouring-month days marked',
  'takes its column order from src/utils/calendar rather than its own',
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const render = projects.find((p) => p && p.displayName === RENDER_PROJECT);
  if (!render) return { error: JEST_CONFIG + ' has no "' + RENDER_PROJECT + '" project' };
  return { config: { ...render, rootDir: root, testMatch: ['**/' + SUITE] } };
};

export const run = async ({ root }) => {
  for (const rel of [ARRANGE, GRID, SCREEN, SUITE, CALENDAR, HEADER]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — K1 has nothing to be about');
  }

  const arrangeSrc = stripComments(readFileSync(join(root, ARRANGE), 'utf8'));
  const gridSrc = stripComments(readFileSync(join(root, GRID), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const calendarSrc = readFileSync(join(root, CALENDAR), 'utf8');
  const problems = [];

  /* 1. THE WEEK BEGINS IN ONE PLACE, AND IT IS NOT HERE. */
  if (!/WEEK_ORDER/.test(arrangeSrc + gridSrc)) {
    problems.push(
      'the grid never references WEEK_ORDER from ' + CALENDAR + '. A grid that decides its own first day is a second '
        + 'place the week begins, and it stops agreeing with WeekHeader the moment either changes — the symptom being '
        + 'every date under the wrong letter, which reads as a rendering glitch rather than a data bug',
    );
  }
  for (const f of [{ n: ARRANGE, s: arrangeSrc }, { n: GRID, s: gridSrc }]) {
    if (/\[\s*0\s*,\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*,\s*6\s*\]/.test(f.s)) {
      problems.push(f.n + ' declares its own 0..6 day-index array — that is the second home WEEK_ORDER exists to prevent');
    }
    if (/\[\s*1\s*,\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*,\s*6\s*,\s*0\s*\]/.test(f.s)) {
      problems.push(f.n + ' declares a Monday-first order');
    }
  }

  /* Sanity: the one place really is Sunday-first, so a passing grid means what it says. */
  if (!/WEEK_ORDER\s*=\s*\[\s*0\s*,/.test(calendarSrc)) {
    problems.push(CALENDAR + ' no longer starts WEEK_ORDER at 0 (Sunday) — K1 is about the grid, but a grid that faithfully follows a Monday-first declaration is still Monday-first');
  }

  /* 2. THE MIRRORING TRAP. */
  if (/<RtlRow[^>]*>\s*\{?[^]{0,200}?calendar-day-/.test(gridSrc)) {
    problems.push(
      GRID + ' wraps the week rows in a direction-aware row. ' + HEADER + '\'s own comment explains why that breaks: '
        + 'WEEK_ORDER is Sunday-first as an ARRAY and RTL writing direction already lays a plain row out right-to-left, '
        + 'so mirroring reverses it a second time and the two reversals cancel. The dates would disagree with the '
        + 'letters by exactly one reflection',
    );
  }

  /* 3. ALL THREE LANGUAGES ARE AVAILABLE TO IT. */
  if (!/DAY_LETTERS/.test(gridSrc) && !/WeekHeader/.test(gridSrc)) {
    problems.push(GRID + ' neither renders WeekHeader nor reads DAY_LETTERS — K1 says he, ar and en, localized');
  }

  /* 4. A LAYOUT, NOT A CALCULATION. Markers are K2 and the day sheet is K3. */
  if (/from\s+'[^']*\/engines\//.test(gridSrc) || /from\s+'[^']*\/engines\//.test(arrangeSrc)) {
    problems.push('the grid imports an engine — it arranges days; markers are K2 and the day sheet is K3 (B1)');
  }
  if (/\.reduce\s*\(/.test(gridSrc)) {
    problems.push(GRID + ' reduces — a grid that sums a day\'s charges is doing K3\'s work and B1\'s forbidden third');
  }

  /* 5. THE SCREEN SHOWS IT, AND ONLY ONE WEEK HEADER SURVIVES. */
  if (!/MonthGrid/.test(screenSrc)) {
    problems.push(SCREEN + ' does not render MonthGrid');
  }
  const headersOnScreen = (screenSrc.match(/WeekHeader/g) ?? []).length;
  const headersInGrid = (gridSrc.match(/WeekHeader/g) ?? []).length;
  if (headersOnScreen > 0 && headersInGrid > 0) {
    problems.push(SCREEN + ' and ' + GRID + ' each render a WeekHeader — the screen would show the weekday row twice');
  }

  if (problems.length) return fail(problems.join(' · '));

  const { config, error } = renderConfigFor(root);
  if (error) return fail(error);
  const { problems: caseProblems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (caseProblems.length) return fail(caseProblems.join(' · '), summary ?? undefined);
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }

  return ok(SENTINEL, [
    'CRITERION K1 — the month grid.',
    'The week begins in ONE place — WEEK_ORDER in ' + CALENDAR + ' — and the grid takes its column',
    '  order from there rather than declaring a 0..6 array of its own. Two declarations would agree',
    '  today and diverge later, and the symptom is every date under the wrong letter, which reads as',
    '  a rendering glitch rather than a data bug.',
    'The week rows are NOT direction-mirrored, and that is deliberate. ' + HEADER + ' documents why at',
    '  length: WEEK_ORDER is Sunday-first as an array, RTL writing direction already lays a plain row',
    '  out right-to-left, and mirroring reverses it a second time — two reversals cancel, and the',
    '  dates end up disagreeing with the letters by exactly one reflection.',
    'Day letters come from DAY_LETTERS for he, ar and en, read from the module rather than retyped.',
    'And the grid arranges days and computes nothing: markers are K2, the day sheet is K3.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
