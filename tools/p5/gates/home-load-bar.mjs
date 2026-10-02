/**
 * GATE: home-load-bar — criterion H3.  →  `HOME-LOAD-BAR OK`
 *
 *   > **H3.** *"The monthly load bar shows commitments over income with 35 and 50 percent ticks
 *   > paired with an absolute shekel figure, and renders only when income exists — otherwise it says
 *   > what is missing."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE TICKS ARE THE PLACE A NUMBER GETS RETYPED
 *
 * "35 and 50 percent" are `strongWarningRatio` and `blockedRatio`, which the load engine publishes
 * on every result. They are also two of the most quotable numbers in this product, which makes them
 * the ones most likely to be written into a component as `0.35` and `0.5` — where they would look
 * completely correct, agree with the engine on the day they were written, and stop agreeing the
 * moment anyone tuned a band.
 *
 * A bar whose ticks disagree with the engine that colours it is worse than a bar with no ticks: the
 * user sees a marker at 35% and a colour change at 38% and concludes the app is confused. So the
 * gate refuses the literals, and the suite is required to read the thresholds from the engine at run
 * time rather than asserting against numbers it typed itself.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "PAIRED WITH AN ABSOLUTE SHEKEL FIGURE" IS LOAD-BEARING
 *
 * Spec §25, which `J1` also rests on: *"absolute + percent together is more tangible than either
 * alone."* A bar reading 41% and nothing else is a number about a number — the user has to hold
 * their income in their head to make it mean anything. The shekel figure is what makes it a fact
 * about their month.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A 0% BAR IS NOT AN HONEST RENDERING OF AN UNKNOWN INCOME
 *
 * It is a full-width empty bar that reads as *"you have committed nothing"* — the most reassuring
 * possible misreading, produced by having no data at all. `H1` next door already handles this by
 * saying what is missing; H3 must too.
 *
 * NEGATIVE CONTROL: write the thresholds as literals and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['H3'];
export const SENTINEL = 'HOME-LOAD-BAR OK';
export const MEASURES = 'render';

const BAR = 'src/screens/home/HomeLoadBar.tsx';
const SCREEN = 'src/screens/HomeScreen.tsx';
const SUITE = 'src/screens/home/__tests__/homeLoadBar.render.test.tsx';
const READERS = 'src/surfaces/__tests__/agreementReaders.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders the ratio the engine reported',
  'renders the absolute shekel figure beside it',
  'places the ticks at the engine thresholds',
  'writes no threshold of its own',
  'renders nothing and says what is missing when income is unknown',
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
  for (const rel of [BAR, SCREEN, SUITE, READERS]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — H3 has nothing to be about');
  }

  const barSrc = stripComments(readFileSync(join(root, BAR), 'utf8'));
  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const readersSrc = stripComments(readFileSync(join(root, READERS), 'utf8'));
  const problems = [];

  /* 1. THE TICKS ARE THE ENGINE'S. */
  for (const lit of ['0.35', '0.5', '35', '50']) {
    const re = new RegExp('(?<![0-9.])' + lit.replace('.', '\\.') + '(?![0-9])');
    if (re.test(barSrc) && /tick/i.test(barSrc)) {
      problems.push(
        BAR + ' contains the literal ' + lit + ' near its ticks. strongWarningRatio and blockedRatio are the engine\'s '
          + 'and it publishes them on every result — a copy agrees on the day it is written and stops agreeing the '
          + 'moment a band is tuned, and a bar whose ticks disagree with the colour that changes at them reads as a '
          + 'confused app',
      );
      break;
    }
  }
  for (const field of ['strongWarningRatio', 'blockedRatio']) {
    if (!new RegExp(field).test(barSrc)) {
      problems.push(BAR + ' never reads ' + field + ' — H3\'s ticks are the engine\'s thresholds');
    }
  }

  /* 2. RATIO AND ABSOLUTE, TOGETHER. */
  if (!/ratioOfIncome/.test(barSrc)) {
    problems.push(BAR + ' never reads ratioOfIncome — "commitments over income" is an engine field, not a division');
  }
  if (!/monthlyObligationsIls/.test(barSrc)) {
    problems.push(
      BAR + ' renders no absolute shekel figure. §25: absolute and percent together are more tangible than either '
        + 'alone — a bar reading 41% is a number about a number, and the user has to hold their income in their head '
        + 'for it to mean anything',
    );
  }
  for (const id of ['home-load-bar-ratio', 'home-load-bar-absolute']) {
    if (!new RegExp("['\"`]" + id + "['\"`]").test(barSrc)) {
      problems.push(BAR + ' has no ' + id + ' element');
    }
  }

  /* 3. NO DIVISION ON THE SURFACE. */
  if (/\/\s*(monthlyIncome|income)\b/i.test(barSrc)) {
    problems.push(BAR + ' divides by income — the ratio is an engine field (B1)');
  }

  /* 4. NO INCOME, NO BAR — and it says what is missing. */
  if (!/home-load-bar-absent/.test(barSrc)) {
    problems.push(
      BAR + ' has no absent state. A 0% bar is not an honest rendering of an unknown income — it is a full-width empty '
        + 'bar reading "you have committed nothing", which is the most reassuring possible misreading of having no data',
    );
  }

  /* 5. THE SCREEN SHOWS IT. */
  if (!/HomeLoadBar/.test(screenSrc)) {
    problems.push(SCREEN + ' does not render HomeLoadBar');
  }

  /* 6. THE READER IS REAL AND RETURNS A RATIO (D-020). */
  const reader = readersSrc.match(/export function readHomeLoadBar[\s\S]{0,500}?\n}/);
  if (!reader) {
    problems.push(READERS + ' has no readHomeLoadBar — it is the home-load-bar participant in one-load');
  } else if (/return NOT_BUILT;\s*\n?}/.test(reader[0]) && !/render|paintedValue/.test(reader[0])) {
    problems.push(READERS + ' still returns NOT_BUILT for readHomeLoadBar while the bar renders');
  } else if (!/home-load-bar-ratio/.test(reader[0])) {
    problems.push(
      READERS + ' readHomeLoadBar does not read home-load-bar-ratio. one-load compares RATIOS; a reader returning the '
        + 'absolute figure would not fail the property, it would make it compare two different questions (D-020)',
    );
  }

  /* 7. THE SUITE READS THE THRESHOLDS FROM THE ENGINE, not from numbers it typed. */
  if (!/strongWarningRatio/.test(suiteSrc)) {
    problems.push(
      SUITE + ' never reads strongWarningRatio from the engine result. Asserting against a 0.35 the test typed proves '
        + 'the bar agrees with the test, not with the engine',
    );
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
    'CRITERION H3 — Home\'s monthly load bar.',
    'The ticks are the engine\'s thresholds, not retyped. 35 and 50 are among the most quotable',
    '  numbers in this product, which makes them the ones most likely to be written into a component',
    '  — where they would look correct, agree on the day, and stop agreeing the moment a band was',
    '  tuned. A bar whose ticks disagree with the colour that changes at them reads as a confused app.',
    'The percentage is paired with the absolute shekel figure, which §25 says is the point: a bar',
    '  reading 41% alone is a number about a number, and the user has to hold their income in their',
    '  head for it to mean anything.',
    'With no income there is no bar. A 0% bar is not an honest rendering of an unknown income — it is',
    '  a full-width empty bar reading "you have committed nothing", the most reassuring possible',
    '  misreading of having no data at all.',
    'And readHomeLoadBar returns the RATIO, which is what one-load compares (D-020).',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
