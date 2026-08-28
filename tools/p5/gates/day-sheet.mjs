/**
 * GATE: day-sheet — criterion K3.  →  `DAY-SHEET OK`
 *
 *   > **K3.** *"The day sheet lists the fixed event taxonomy — salary in, card billings with card
 *   > and amount, installments due, loans and mortgage, fixed orders — derived from user commitments
 *   > and card billing dates, labelled Estimate when derived, with a one-line pressure summary."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "LABELLED ESTIMATE WHEN DERIVED" HAS TWO HALVES AND ONLY ONE OF THEM GETS BUILT
 *
 * Everyone builds the first: derived dates wear the chip. The second — **a date the user stated
 * does NOT wear it** — is the half that makes the label mean anything, and the safe-looking failure
 * is to put `ESTIMATE` on everything, because then nothing is ever overclaimed.
 *
 * That is a real loss, not a harmless one. A salary date the user typed is the most reliable fact on
 * this screen; marking it an estimate tells them the app is unsure about something they told it, and
 * it flattens the distinction the chip exists to draw. So the suite must prove both directions and
 * this gate requires both cases by name.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE TAXONOMY IS FIXED, SO THE ORDER MAY NOT DEPEND ON THE DAY
 *
 * Five kinds, declared once and mapped. A sheet that rendered whichever kinds the day happened to
 * contain, in whatever order they were found, would look correct on every day that has all five and
 * shuffle on every day that does not — and a user reading two days in a row would see the same
 * information in two different shapes.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE PRESSURE SUMMARY IS A SENTENCE, NOT A NEW NUMBER
 *
 * "One line about the day" is a place where a total wants to appear: sum the outflows, show the
 * figure. Nothing publishes a per-day total, so a sum here would be a number invented on a surface —
 * B1, and §2 rule 11. If no engine offers one, the honest sheet lists the events and says nothing it
 * cannot support.
 *
 * NEGATIVE CONTROL: label a user-stated salary date Estimate and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['K3'];
export const SENTINEL = 'DAY-SHEET OK';
export const MEASURES = 'render';

const EVENTS = 'src/screens/calendar/dayEvents.ts';
const SHEET = 'src/screens/calendar/DaySheet.tsx';
const GRID = 'src/screens/calendar/MonthGrid.tsx';
const SUITE = 'src/screens/calendar/__tests__/daySheet.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

/** K3's taxonomy, in K3's order. The criterion's own content. */
const TAXONOMY = ['salary-in', 'card-billing', 'installment-due', 'loan-or-mortgage', 'fixed-order'];

const REQUIRED_CASES = [
  'lists the five event kinds in the fixed taxonomy order',
  'renders a card billing with its card and its amount',
  'labels a derived date Estimate',
  /* The half that stops the label being applied to everything. */
  'does not label a date the user stated as Estimate',
  'renders an honest empty sheet for a day with nothing scheduled',
  'renders a one-line pressure summary',
  'computes no figure the data does not carry',
];

/** The old engine stack, which K2 already ruled out of this screen's risk path. */
const OLD_STACK = [/useCashflowCalendar/, /cashflowRadar/, /loanEngine/];

/** A per-day total nobody publishes. */
const SUMS = [
  [/\.reduce\s*\(/, 'reduces the day\'s events into a total'],
  [/amountIls[^;\n]*\+/, 'adds event amounts'],
  [/\+[^;\n]*amountIls/, 'adds event amounts'],
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
  for (const rel of [EVENTS, SHEET, GRID, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — K3 has nothing to be about');
  }

  const eventsSrc = stripComments(readFileSync(join(root, EVENTS), 'utf8'));
  const sheetSrc = stripComments(readFileSync(join(root, SHEET), 'utf8'));
  const gridSrc = stripComments(readFileSync(join(root, GRID), 'utf8'));
  const problems = [];

  /* 1. THE TAXONOMY, DECLARED ONCE, IN K3's ORDER. */
  const orderMatch = eventsSrc.match(/DAY_EVENT_ORDER[^=]*=\s*\[([\s\S]*?)\]/);
  const declared = orderMatch ? [...orderMatch[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]) : [];
  if (declared.length === 0) {
    return fail(EVENTS + ' declares no DAY_EVENT_ORDER — a taxonomy that is not declared is not fixed');
  }
  if (declared.join(',') !== TAXONOMY.join(',')) {
    problems.push(EVENTS + ' declares [' + declared.join(', ') + '] but K3 fixes [' + TAXONOMY.join(', ') + ']');
  }

  /* 2. THE SHEET MAPS THE ORDER, so it cannot depend on what the day contains. */
  if (!/DAY_EVENT_ORDER/.test(sheetSrc)) {
    problems.push(
      SHEET + ' does not render from DAY_EVENT_ORDER. A sheet rendering whichever kinds the day happens to contain '
        + 'looks correct on a full day and shuffles on every other, and a user reading two days in a row sees the same '
        + 'information in two shapes',
    );
  }

  /* 3. BOTH HALVES OF THE ESTIMATE LABEL. */
  if (!/derived/.test(eventsSrc)) {
    problems.push(EVENTS + ' carries no derived flag — "labelled Estimate WHEN DERIVED" needs the sheet to know which dates were worked out');
  }
  if (!/ESTIMATE/.test(sheetSrc)) {
    problems.push(SHEET + ' never renders an Estimate chip');
  }
  /* A chip applied unconditionally is the safe-looking failure. */
  if (/<ProvenanceChip[^>]*view=\{\{\s*chip:\s*'ESTIMATE'/.test(sheetSrc) && !/derived/.test(sheetSrc)) {
    problems.push(
      SHEET + ' renders the Estimate chip without consulting the derived flag. Labelling everything Estimate is the '
        + 'safe-looking failure and a real loss: a salary date the user typed is the most reliable fact on this screen, '
        + 'and marking it an estimate tells them the app is unsure about something they said',
    );
  }

  /* 4. NO PER-DAY TOTAL INVENTED. */
  for (const f of [{ n: EVENTS, s: eventsSrc }, { n: SHEET, s: sheetSrc }]) {
    for (const [re, why] of SUMS) {
      if (re.test(f.s)) {
        problems.push(f.n + ' ' + why + ' — nothing publishes a per-day total, so a sum here is a number invented on a surface (B1, §2 rule 11)');
      }
    }
  }

  /* 5. NOT THE OLD STACK, and not an engine directly. */
  for (const f of [{ n: EVENTS, s: eventsSrc }, { n: SHEET, s: sheetSrc }]) {
    for (const re of OLD_STACK) {
      if (re.test(f.s)) {
        problems.push(f.n + ' reaches the M3-era cashflow stack — K2 ruled it out of this screen\'s engine path and the reason is in agreementParticipants.ts');
      }
    }
    if (/from\s+'[^']*\/engines\//.test(f.s)) {
      problems.push(f.n + ' imports an engine directly (B1)');
    }
  }

  /* 6. THE GRID OPENS IT. */
  if (!/DaySheet/.test(gridSrc)) {
    problems.push(GRID + ' does not open the DaySheet — K2 made the days tappable and K3 is what a tap reaches');
  }

  /* 7. AN EMPTY DAY IS HONEST. */
  if (!/calendar-day-sheet-empty/.test(sheetSrc)) {
    problems.push(SHEET + ' has no empty state — a day with nothing scheduled says so rather than rendering a zero');
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
    'CRITERION K3 — the Plan Calendar day sheet.',
    'The taxonomy is declared once and mapped, so the order cannot depend on what a day contains:',
    ...declared.map((k) => '  · ' + k),
    'BOTH halves of the Estimate label are proved. Everyone builds the first — derived dates wear the',
    '  chip. The second, that a date the USER STATED does not, is what makes the label mean anything,',
    '  and the safe-looking failure is to put ESTIMATE on everything so nothing is ever overclaimed.',
    '  That is a real loss: a salary date the user typed is the most reliable fact on this screen, and',
    '  marking it an estimate tells them the app is unsure about something they said.',
    'The pressure summary is a sentence, not a new number — nothing publishes a per-day total, so a',
    '  sum here would be invented on a surface.',
    'And the sheet reads the seam, never the M3-era cashflow stack that K2 ruled out of this screen.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
