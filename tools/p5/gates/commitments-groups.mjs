/**
 * GATE: commitments-groups — criterion J2.  →  `COMMITMENTS-GROUPS OK`
 *
 *   > **J2.** *"The grouped list renders in the fixed order Installments, Loans, Mortgage, Fixed
 *   > orders."*
 *
 * MEASURES: 'render'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE WORK WAS DONE BY B2; THIS IS THE MEASUREMENT
 *
 * `CommitmentsScreen` has rendered these four groups in this order since B2, because B2 required
 * the surface to render P5 content rather than a placeholder and the group list was the content.
 * J2 is the criterion that says the ORDER is fixed, and it needed a gate rather than more code.
 *
 * That is worth stating plainly rather than quietly reusing the earlier work: a criterion satisfied
 * by code another criterion motivated is still satisfied, but only if something now measures the
 * property THIS criterion names. B2's gate checks that no route reaches a placeholder. It says
 * nothing about the order of anything.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * EVERY GROUP RENDERS EVEN WHEN IT IS EMPTY, AND THAT IS PART OF THE ORDER
 *
 * `CommitmentsScreen`'s own header says why: *"A group that vanished when empty would make 'you
 * have no loans' and 'this app does not track loans' indistinguishable, and the second is false."*
 *
 * It is also what makes a fixed order testable. An order over a list that silently drops its empty
 * members is an order over whatever the fixture happened to populate — the four positions would
 * shuffle with the data, and a test asserting `[installments, mortgage]` would pass while proving
 * nothing about where loans belongs. So the gate asserts all four are present with an EMPTY vault,
 * which is the one fixture where a vanishing group is visible.
 *
 * `fixed-orders` (הוראות קבע) has no store at all — nothing in the vault holds them — so it is
 * ALWAYS the empty case, and it is the group most likely to be quietly dropped by someone tidying.
 *
 * NEGATIVE CONTROL: swap two groups in the declaration and watch the order check fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['J2'];
export const SENTINEL = 'COMMITMENTS-GROUPS OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/plan/CommitmentsScreen.tsx';
const SUITE = 'src/screens/plan/__tests__/commitments.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

/** Spec §15's order. The criterion's own content. */
const FIXED_ORDER = ['installments', 'loans', 'mortgage', 'fixed-orders'];

/** B2's suite already proves these; J2 is the criterion they belong to. */
const REQUIRED_CASES = [
  'renders the four groups in spec §15 order, with nothing in the vault',
  'gives an empty group its own line rather than letting it vanish',
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
  for (const rel of [SCREEN, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist — J2 has nothing to be about');
  }

  const screenSrc = stripComments(readFileSync(join(root, SCREEN), 'utf8'));
  const suiteSrc = stripComments(readFileSync(join(root, SUITE), 'utf8'));
  const problems = [];

  /* 1. THE FOUR, IN SPEC §15's ORDER. */
  const declared = [...screenSrc.matchAll(/\bkey:\s*'([a-z-]+)'/g)].map((m) => m[1]);
  if (declared.length === 0) {
    return fail(SCREEN + ' declares no groups — an order over zero groups is the vacuous pass §2 rule 5 refuses');
  }
  if (declared.join(',') !== FIXED_ORDER.join(',')) {
    problems.push(SCREEN + ' declares [' + declared.join(', ') + '] but spec §15 fixes [' + FIXED_ORDER.join(', ') + ']');
  }

  /* 2. NO GROUP IS DROPPED WHEN EMPTY — the thing that makes the order testable at all. */
  for (const key of FIXED_ORDER) {
    const guarded = new RegExp("length\\s*[>!=]=?\\s*0[^\\n]{0,80}'" + key + "'");
    if (guarded.test(screenSrc)) {
      problems.push(
        SCREEN + ' renders "' + key + '" conditionally on its own length. A group that vanishes when empty makes '
          + '"you have no loans" and "this app does not track loans" indistinguishable, and the second is false',
      );
    }
  }

  /* 3. THE TITLES ARE LITERAL t() CALLS — a variable key is invisible to arabicCoverage. */
  const titles = [...screenSrc.matchAll(/title:\s*t\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
  if (titles.length !== FIXED_ORDER.length) {
    problems.push(
      SCREEN + ' has ' + titles.length + ' literal t() group title(s), expected ' + FIXED_ORDER.length
        + '. A t(variable) title is invisible to the Arabic coverage test and falls back to Hebrew',
    );
  }

  /* 4. THE SUITE PROVES IT ON AN EMPTY VAULT, which is where a vanishing group shows. */
  if (!/empty/i.test(suiteSrc)) {
    problems.push(SUITE + ' never exercises the empty case — an order over a list that drops empty members is an order over whatever the fixture populated');
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
    'CRITERION J2 — the Plan Commitments group order.',
    SCREEN + ' declares spec §15\'s four groups in its order:',
    ...declared.map((k) => '  · ' + k),
    'The code is B2\'s — it shipped the groups because B2 needed the surface to render P5 content —',
    '  and J2 is the criterion that fixes their ORDER. B2\'s gate checks that no route reaches a',
    '  placeholder and says nothing about order, so this is a measurement that did not exist before.',
    'Every group renders even when empty, which is both the honesty rule and what makes a fixed order',
    '  testable: an order over a list that drops its empty members is an order over whatever the',
    '  fixture populated. fixed-orders has no store at all, so it is always the empty case and the one',
    '  most likely to be quietly tidied away.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + summary,
  ].join('\n'));
};
