/**
 * GATE: home-hero-honesty — criterion H2.  →  `HOME-HERO-HONESTY OK`
 *
 *   > **H2.** *"The hero chip reads Estimate, from your data with tap-to-explain, and can never read
 *   > Verified."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "CAN NEVER" IS A CLAIM ABOUT THE TYPE, NOT ABOUT TODAY'S VALUE
 *
 * `W2` established the shape and the reasoning transfers exactly: a component taking
 * `chip: ProvenanceChip` and being handed `'ESTIMATE'` at its one call site satisfies *"reads
 * Estimate"* and fails *"can never read Verified"*. The second is a claim about what the code
 * **admits**, and a variable that is ESTIMATE today is one call site away from not being.
 *
 * What makes it matter more here than anywhere else in P5: this is **the biggest number on the home
 * screen**, it is the first thing a user sees, and it rests on an income they typed, obligations the
 * app assembled from their vault, and a buffer someone configured. `VERIFIED` on that would claim a
 * confirmation nobody made, on the figure most likely to be acted on.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "FROM YOUR DATA WITH TAP-TO-EXPLAIN" IS A SECOND CLAUSE, NOT A GLOSS ON THE FIRST
 *
 * A chip reading *Estimate* tells a user the number is uncertain. It does not tell them **what it is
 * made of**, and an estimate whose inputs are invisible is a number they can only take or leave.
 * H2's *tap-to-explain* is what turns it into something they can check: income, obligations, buffer,
 * and where each came from.
 *
 * So the explanation must name the parts. A tap that reveals *"this is an estimate"* has restated the
 * chip and explained nothing, and this gate refuses that by requiring the parts to appear.
 *
 * NEGATIVE CONTROL (contract §H2): label the hero Verified and watch this fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['H2'];
export const SENTINEL = 'HOME-HERO-HONESTY OK';
export const MEASURES = 'render';

const HERO = 'src/screens/home/HomeHero.tsx';
const SUITE = 'src/screens/home/__tests__/homeHero.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders an Estimate chip',
  'cannot render a Verified chip',
  'explains what the number is made of when tapped',
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
  for (const rel of [HERO, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — H2 has nothing to be about');
  }

  const heroSrc = stripComments(readFileSync(join(root, HERO), 'utf8'));
  const problems = [];

  /* 1. VERIFIED IS IMPOSSIBLE, NOT MERELY ABSENT. */
  if (/VERIFIED/.test(heroSrc)) {
    problems.push(
      HERO + ' names VERIFIED. This is the biggest number on the home screen and it rests on an income the user typed, '
        + 'obligations the app assembled and a configured buffer — VERIFIED would claim a confirmation nobody made, on '
        + 'the figure most likely to be acted on',
    );
  }
  if (/chip\s*:\s*ProvenanceChip\b/.test(heroSrc) && !/chip\s*:\s*'ESTIMATE'/.test(heroSrc)) {
    problems.push(
      HERO + ' accepts a chip of the full ProvenanceChip type. "Can never read Verified" is a claim about what the code '
        + 'ADMITS — a variable that is ESTIMATE today is one call site away from not being. Take no chip input, or '
        + 'narrow it to the literal',
    );
  }
  if (!/ESTIMATE/.test(heroSrc)) {
    problems.push(HERO + ' renders no Estimate chip');
  }

  /* 2. TAP-TO-EXPLAIN, AND IT NAMES THE PARTS. */
  if (!/home-hero-explain/.test(heroSrc)) {
    problems.push(HERO + ' has no tap-to-explain target');
  }
  if (!/home-hero-explanation/.test(heroSrc)) {
    problems.push(HERO + ' has no explanation to reveal');
  }
  /* An explanation that restates the chip has explained nothing. */
  const namesParts = ['income', 'obligation', 'buffer'].filter((w) => new RegExp(w, 'i').test(heroSrc));
  if (namesParts.length < 3) {
    problems.push(
      HERO + ' names only ' + namesParts.length + ' of the three parts (income, obligations, buffer) in its explanation. '
        + 'A chip reading Estimate says the number is uncertain; it does not say what it is MADE OF, and an estimate '
        + 'whose inputs are invisible is one a user can only take or leave. A tap revealing "this is an estimate" has '
        + 'restated the chip',
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
    'CRITERION H2 — the hero\'s honesty.',
    'Verified is impossible STRUCTURALLY, not merely absent today. W2 set the shape and it matters',
    '  more here: this is the biggest number on the home screen, the first thing a user sees, and it',
    '  rests on an income they typed, obligations the app assembled and a buffer someone configured.',
    '  VERIFIED would claim a confirmation nobody made, on the figure most likely to be acted on.',
    'And tap-to-explain names the three parts. A chip reading Estimate says the number is uncertain;',
    '  it does not say what it is MADE OF, and an estimate whose inputs are invisible is one a user',
    '  can only take or leave. A tap that reveals "this is an estimate" has restated the chip.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
