/**
 * GATE: home-risk-strip — criterion H4.  →  `HOME-RISK-STRIP OK`
 *
 *   > **H4.** *"The 7-day risk strip renders per-day risk from the risk engine with colour plus
 *   > tap-to-explain and a non-colour cue, requires billing dates, and degrades to an honest unknown
 *   > rather than to green without them."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "RATHER THAN TO GREEN" IS THE WHOLE CRITERION
 *
 * Every other clause here is ordinary. This one names a specific, plausible, dangerous failure: a
 * strip with no billing dates has nothing to warn about, so the naive rendering is seven calm days.
 * **Green is not the absence of a warning — it is a claim that the week is clear**, and producing it
 * from having no data tells the user the most reassuring possible thing at exactly the moment the
 * app knows least.
 *
 * It is the same shape as `H3`'s 0% bar and `J3`'s `1/1`, and it is the worst of the three, because
 * the risk strip is the element a user glances at to decide whether to worry. So the suite must
 * prove the degraded render is **unknown**, not merely "not red", and this gate requires the case by
 * name and refuses a default-to-safe in the source.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * COLOUR PLUS A CUE, BECAUSE COLOUR ALONE IS NOT A RENDERING FOR EVERYONE
 *
 * `K2` holds the same line on the calendar's dots. A coloured square with no cue is invisible to a
 * screen reader and ambiguous to anyone who cannot distinguish the hues, and "risk" is precisely the
 * information nobody should have to guess at.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND IT IS A3's PARTICIPANT
 *
 * `A3` compares this strip against Plan Calendar's risk dots, which `K2` wired to the seam. If this
 * one read anything else, the property would compare two engine stacks — the failure the PHASE-1
 * note in `agreementParticipants.ts` was written to prevent, arriving from the other end.
 *
 * NEGATIVE CONTROL (contract §H4): remove the billing dates and watch the strip refuse to render a
 * level it cannot know.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['H4'];
export const SENTINEL = 'HOME-RISK-STRIP OK';
export const MEASURES = 'render';

const STRIP = 'src/screens/home/HomeRiskStrip.tsx';
const SCREEN = 'src/screens/HomeScreen.tsx';
const SUITE = 'src/screens/home/__tests__/homeRiskStrip.render.test.tsx';
const READERS = 'src/surfaces/__tests__/agreementReaders.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders a level for each of the seven days from the risk engine',
  'renders a non-colour cue beside every level',
  'explains a day when it is tapped',
  'renders unknown and not green when billing dates are missing',
  'renders unknown for a day the engine could not level',
];

/** Defaulting to the calm answer, in the shapes it arrives in. */
const DEFAULTS_TO_SAFE = [
  [/\?\?\s*['"`]safe['"`]/i, 'defaults a missing level to safe'],
  [/\|\|\s*['"`]safe['"`]/i, 'falls back to safe'],
  [/\?\?\s*['"`]green['"`]/i, 'defaults a missing level to green'],
  [/level\s*=\s*['"`]safe['"`]/i, 'initialises a level to safe'],
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
  for (const rel of [STRIP, SCREEN, SUITE, READERS]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — H4 has nothing to be about');
  }

  const stripSrc = stripComments(readFileSync(join(root, STRIP), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const readersSrc = stripComments(readFileSync(join(root, READERS), 'utf8'));
  const problems = [];

  /* 1. NEVER GREEN BY DEFAULT. */
  for (const [re, why] of DEFAULTS_TO_SAFE) {
    if (re.test(stripSrc)) {
      problems.push(
        STRIP + ' ' + why + '. Green is not the absence of a warning — it is a claim that the week is clear, and '
          + 'producing it from having no data tells the user the most reassuring possible thing at the moment the app '
          + 'knows least. This is the element people glance at to decide whether to worry',
      );
    }
  }
  if (!/unknown/i.test(stripSrc)) {
    problems.push(STRIP + ' has no unknown level — H4 says it degrades to an honest unknown, and "not red" is not the same as "we do not know"');
  }

  /* 2. THE LEVELS ARE THE ENGINE'S, THROUGH THE SEAM. */
  if (/from\s+'[^']*\/engines\//.test(stripSrc)) {
    problems.push(STRIP + ' imports an engine directly — B1, and A3 compares this against Plan Calendar\'s dots, which K2 wired to the seam');
  }
  if (!/surfaces/.test(stripSrc)) {
    problems.push(STRIP + ' does not read through the surfaces seam — if it read anything else, A3 would compare two engine stacks');
  }

  /* 3. COLOUR PLUS A CUE. */
  if (!/-cue/.test(stripSrc)) {
    problems.push(
      STRIP + ' renders no non-colour cue. A coloured square is invisible to a screen reader and ambiguous to anyone '
        + 'who cannot distinguish the hues, and risk is precisely the information nobody should have to guess at (K2 '
        + 'holds the same line on the calendar dots)',
    );
  }
  if (!/accessibilityLabel/.test(stripSrc)) {
    problems.push(STRIP + ' gives its days no accessibility label');
  }

  /* 4. TAP TO EXPLAIN. */
  if (!/explain/i.test(stripSrc)) {
    problems.push(STRIP + ' has no tap-to-explain');
  }

  /* 5. THE SCREEN SHOWS IT. */
  if (!/HomeRiskStrip/.test(screenSrc)) {
    problems.push(SCREEN + ' does not render HomeRiskStrip');
  }

  /* 6. A3's PARTICIPANT IS REAL. */
  const reader = readersSrc.match(/export function readHomeRiskStripDay[\s\S]{0,500}?\n}/);
  if (!reader) {
    problems.push(READERS + ' has no readHomeRiskStripDay');
  } else if (/return NOT_BUILT;\s*\n?}/.test(reader[0]) && !/render|queryByTestId/.test(reader[0])) {
    problems.push(READERS + ' still returns NOT_BUILT for readHomeRiskStripDay while the strip renders — A3 would report the participant missing while it is on screen');
  }

  /* 7. THE SUITE PROVES THE DEGRADED CASE IS UNKNOWN, not merely not-red. */
  if (!/unknown/i.test(suiteSrc)) {
    problems.push(SUITE + ' never asserts an unknown level — the degraded render is the criterion, and proving it is "not red" is not proving it says "we do not know"');
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
    'CRITERION H4 — Home\'s 7-day risk strip.',
    'Without billing dates it degrades to an honest UNKNOWN and never to green. That clause is the',
    '  whole criterion: a strip with nothing to warn about renders seven calm days if nobody stops it,',
    '  and green is not the absence of a warning — it is a claim that the week is clear, produced from',
    '  having no data, at the moment the app knows least. It is the same shape as H3\'s 0% bar and',
    '  J3\'s 1/1, and the worst of the three, because this is the element people glance at to decide',
    '  whether to worry.',
    'Every level carries a non-colour cue and an accessibility label, as K2 requires of the calendar',
    '  dots: risk is not information anyone should have to guess at from a hue.',
    'The levels come from the risk engine through the seam — if this read anything else, A3 would',
    '  compare two engine stacks, which is the failure the PHASE-1 note was written to prevent,',
    '  arriving from the other end.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
