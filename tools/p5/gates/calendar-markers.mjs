/**
 * GATE: calendar-markers — criterion K2.  →  `CALENDAR-MARKERS OK`
 *
 *   > **K2.** *"Day markers render the risk dot, the salary coin and the billing marker with a
 *   > one-line legend and tappable days, and no state on this screen is carried by colour alone."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE DOTS READ THE SEAM, AND THIS WAS WRITTEN DOWN IN PHASE-1
 *
 * `agreementParticipants.ts` carries a comment above `calendar-risk-dots` headed *"PHASE-6, READ
 * THIS BEFORE YOU BUILD THE DOTS."* It was put there when `B1`'s module walk found that Plan
 * Calendar reads its charges through `useCashflowCalendar`, an M3-era hook calling `cashflowRadar`
 * and `loanEngine` **directly** — a different engine stack from the P5 seam.
 *
 * That is fine for the charge list and fatal for the dots. `A3` compares these dots against Home's
 * 7-day risk strip, which reads the seam. Two stacks make the property a coin flip: spec §20's
 * *"any two surfaces showing different numbers for the same inputs is a P0 bug"* cannot be measured
 * when the two surfaces are asking different engines, and §2 rule 10 requires the agreement to be
 * measured **in one run**.
 *
 * So this gate refuses the old stack in the marker code specifically, and leaves the existing charge
 * list alone. The distinction is the point: the hook is not a defect, and feeding the dots from it
 * would be.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "NO STATE BY COLOUR ALONE" IS NOT SATISFIED BY A LEGEND
 *
 * A legend tells a user what a colour means once, somewhere else on the screen. It does not help
 * someone who cannot distinguish the colours in the first place, and it does not help a screen
 * reader, which reads a `View` with a red background as nothing at all.
 *
 * So every marker needs a cue that survives the colour being removed — a shape, a letter, a label,
 * an accessibility label. The gate requires the cue element to exist per marker rather than counting
 * the legend as coverage.
 *
 * NEGATIVE CONTROL: feed the risk dots from the old cashflow stack and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['K2'];
export const SENTINEL = 'CALENDAR-MARKERS OK';
export const MEASURES = 'render';

const MARKERS = 'src/screens/calendar/dayMarkers.ts';
const COMPONENT = 'src/screens/calendar/DayMarkers.tsx';
const GRID = 'src/screens/calendar/MonthGrid.tsx';
const SUITE = 'src/screens/calendar/__tests__/dayMarkers.render.test.tsx';
const READERS = 'src/surfaces/__tests__/agreementReaders.tsx';
const PARTICIPANTS = 'src/surfaces/__tests__/agreementParticipants.ts';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

/** The engine stack the dots may not read. */
const OLD_STACK = [
  [/useCashflowCalendar/, 'imports the M3-era cashflow hook'],
  [/cashflowRadar/, 'reaches cashflowRadar directly'],
  [/loanEngine/, 'reaches loanEngine directly'],
];

const REQUIRED_CASES = [
  'renders the risk dot from the risk engine through the surfaces seam',
  'renders the salary coin on the payday the profile carries',
  'renders the billing marker on a card billing date',
  'renders no marker on a day that has none',
  'gives every marker a cue that is not its colour',
  'renders a one-line legend',
  'reads no charge from the old cashflow stack',
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
  for (const rel of [MARKERS, COMPONENT, GRID, SUITE, READERS, PARTICIPANTS]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — K2 has nothing to be about');
  }

  const markersSrc = stripComments(readFileSync(join(root, MARKERS), 'utf8'));
  const componentSrc = stripComments(readFileSync(join(root, COMPONENT), 'utf8'));
  const gridSrc = stripComments(readFileSync(join(root, GRID), 'utf8'));
  const readersSrc = stripComments(readFileSync(join(root, READERS), 'utf8'));
  const participantsSrc = readFileSync(join(root, PARTICIPANTS), 'utf8');
  const problems = [];

  /* 1. THE OLD STACK STAYS OUT OF THE MARKERS. */
  for (const f of [{ n: MARKERS, s: markersSrc }, { n: COMPONENT, s: componentSrc }]) {
    for (const [re, why] of OLD_STACK) {
      if (re.test(f.s)) {
        problems.push(
          f.n + ' ' + why + '. A3 compares these dots against Home\'s risk strip, which reads the P5 seam — two engine '
            + 'stacks make the property a coin flip, and §2 rule 10 requires agreement measured IN ONE RUN. The hook '
            + 'is not a defect; feeding the dots from it would be',
        );
      }
    }
  }
  if (!/surfaces/.test(markersSrc + componentSrc)) {
    problems.push('neither ' + MARKERS + ' nor ' + COMPONENT + ' reads through src/surfaces/ — the risk level comes from the risk engine through the seam');
  }

  /* 2. THE PHASE-1 NOTE IS STILL THERE. It is how the next phase learns this without being told. */
  if (!/PHASE-6, READ THIS BEFORE YOU BUILD THE DOTS/.test(participantsSrc)) {
    problems.push(
      PARTICIPANTS + ' no longer carries the PHASE-6 warning above calendar-risk-dots. It was written when B1\'s walk '
        + 'found the two stacks, and deleting it once the dots are built removes the record of WHY they read the seam',
    );
  }

  /* 3. NO STATE BY COLOUR ALONE — a cue per marker, not a legend standing in for one. */
  if (!/-cue/.test(componentSrc)) {
    problems.push(
      COMPONENT + ' renders no per-marker cue element. A legend tells a user what a colour means once, somewhere else '
        + 'on the screen; it does not help someone who cannot distinguish the colours, and a screen reader reads a '
        + 'coloured View as nothing at all',
    );
  }
  if (!/accessibilityLabel/.test(componentSrc)) {
    problems.push(COMPONENT + ' gives no accessibility label to its markers');
  }

  /* 4. THE LEGEND EXISTS AND IS ONE THING. */
  if (!/calendar-legend/.test(componentSrc) && !/calendar-legend/.test(gridSrc)) {
    problems.push('no calendar-legend anywhere — K2 asks for a one-line legend naming the three markers');
  }

  /* 5. NOTHING COMPUTED. */
  if (/from\s+'[^']*\/engines\//.test(markersSrc) || /from\s+'[^']*\/engines\//.test(componentSrc)) {
    problems.push('the markers import an engine directly — B1: a surface reads through src/surfaces/');
  }

  /* 6. THE READER STOPPED RETURNING NOT_BUILT. */
  const body = readersSrc.match(/export function readCalendarRiskDotDay[\s\S]{0,500}?\n}/);
  const oneLiner = readersSrc.match(/export function readCalendarRiskDotDay[^\n]*NOT_BUILT[^\n]*/);
  if (oneLiner || (body && /return NOT_BUILT;\s*\n?}/.test(body[0]) && !/render|getByTestId/.test(body[0]))) {
    problems.push(READERS + ' still returns NOT_BUILT for readCalendarRiskDotDay while the dots render — the participants table declares calendar-risk-dots as builtIn PHASE-6');
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
    'CRITERION K2 — the Plan Calendar day markers.',
    'The risk dots read the P5 seam and never the M3-era cashflow stack. That was written down in',
    '  PHASE-1, above calendar-risk-dots in ' + PARTICIPANTS + ', when B1\'s module walk found the two',
    '  stacks — and the note is still there, because deleting it once the dots exist would remove the',
    '  record of why they read the seam. A3 compares these against Home\'s strip; two stacks would',
    '  make spec §20 a coin flip.',
    'Every marker carries a cue that is not its colour, and the legend does not stand in for one: a',
    '  legend explains a colour once, somewhere else, to someone who can see it. A screen reader',
    '  reads a coloured View as nothing at all.',
    'A day with no marker gets none, and nothing on this surface is computed.',
    'readCalendarRiskDotDay is real, so builtIn: PHASE-6 is true rather than aspirational.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
