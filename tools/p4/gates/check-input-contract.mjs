/**
 * GATE: check-input-contract — criterion C1.  →  `CHECK-INPUT-CONTRACT OK`
 *
 *   > **C1.** *"Amount greater than zero and currency are required with the shekel as default;
 *   > category, plan and card preselect are optional."*  (spec §8)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * MEASURES: 'render' — AND THAT IS THE WHOLE DESIGN OF THIS GATE
 *
 * Contract §2 rule 9: *"A screen assertion is measured against the rendered surface, not the
 * source. A test that greps a component file for a string proves the string is in the file."*
 * C1 is a claim about what a person can and cannot do on a screen, so this gate asserts nothing
 * about the text of `CheckInputScreen.tsx`. It delegates to NAMED cases in a suite that mounts the
 * screen, types into the field and presses the control — and requires each case by name, so a case
 * renamed, skipped or deleted fails here rather than vanishing from a suite that still reads green.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A SEARCH THAT FINDS NOTHING MUST NEVER READ AS A PASS
 *
 * The screen file and the suite file are asserted to EXIST first, and the required-case list is
 * asserted to be non-empty (contract §2 rule 5: a check over zero items fails). Without those, a
 * rename or a deletion would produce silence, and silence would print the sentinel.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS GATE HANDS JEST A CONFIGURATION, AND WHERE THAT CONFIGURATION COMES FROM
 *
 * `jest.config.cjs` runs two projects: `unit` (`**\/__tests__\/**\/*.test.ts`, node environment)
 * and `render` (`**\/__tests__\/**\/*.render.test.tsx`, the Expo pipeline). The suite this criterion
 * is measured by is named by WP-1.2's scope — `checkInput.contract.test.tsx` — and that name matches
 * NEITHER project's `testMatch`: `*.test.ts` does not match a `.tsx` file, and the render project
 * requires `.render.` in the name. A bare `npx jest` therefore does not run it.
 *
 * So this gate runs it under the RENDER PROJECT'S OWN CONFIGURATION, read out of `jest.config.cjs`
 * at run time with only `testMatch` narrowed to this suite. Derived rather than copied, on purpose:
 * a gate carrying its own duplicate of the harness would keep passing on the day the harness moved,
 * and would then be measuring an environment the app no longer has.
 *
 * THIS IS RECORDED AS A DEVIATION, NOT HIDDEN: the suite is outside the app's default test run
 * until either it is renamed to `*.render.test.tsx` or the render project's `testMatch` admits it.
 * Both are edits outside WP-1.2's scope. See the work-package return.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['C1'];
export const SENTINEL = 'CHECK-INPUT-CONTRACT OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckInputScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkInput.contract.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

/**
 * ONE CASE PER CLAUSE C1 MAKES, plus the architectural rule that governs every P4 surface.
 * The wording is the suite's; changing it in one place without the other is meant to fail.
 */
const REQUIRED_CASES = [
  // currency required, shekel default, with no user action
  'renders with the shekel already selected, before any user action',
  // amount required
  'refuses to proceed with no amount typed',
  // amount must be GREATER than zero, and must be a number
  'refuses zero, a negative amount and text that is not a number',
  // category, plan and card preselect are optional
  'proceeds on a positive amount with no category, no installments and no card chosen',
  // the default is a value that travels, not merely a highlight
  'sends the shekel as the currency when the user changed nothing',
  // the refusal is live rather than a first-render decoration
  'lets the amount become usable and unusable again as the field is edited',
  // the currency is a real choice; the shekel is its default
  'offers every currency the type defines and switches to the one tapped',
  // contract §5 B1 / spec §20 — no surface holds recommendation logic
  'shows no figure the screen computed — only the amount the person typed',
];

/** The render project's own configuration, narrowed to this suite. Derived, never duplicated. */
const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness to measure C1 with' };
  }
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const render = projects.find((p) => p && p.displayName === RENDER_PROJECT);
  if (!render) {
    return {
      error: JEST_CONFIG + ' has no "' + RENDER_PROJECT + '" project. C1 is measured by rendering '
        + '(contract §2 rule 9), and without that project there is no environment that can mount a '
        + 'screen — which is a harness failure and must not be reported as a criterion failure.',
    };
  }
  return {
    config: {
      ...render,
      rootDir: root,
      testMatch: ['**/' + SUITE],
    },
  };
};

export const run = async ({ root }) => {
  if (REQUIRED_CASES.length === 0) {
    return fail('this gate requires no cases — a check over zero items is not a check (§2 rule 5)');
  }
  if (!existsSync(join(root, SCREEN))) {
    return fail(SCREEN + ' does not exist — there is no Check Input surface for C1 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — C1 is measured by rendering the screen, and nothing '
      + 'renders it. A missing suite is a failure, never an absence of findings.');
  }

  const { config, error } = renderConfigFor(root);
  if (error) return fail(error);

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  /**
   * A suite that ran and passed ZERO tests prints a summary too. The named cases above already
   * cover that — none of them could have been matched — but the count is asserted as well, because
   * the failure mode this project keeps finding is a green line over a population of nothing.
   */
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }

  return ok(SENTINEL, [
    SUITE + ' mounts ' + SCREEN + ' and measures C1 on the RENDERED surface:',
    '  · the shekel is selected on the first frame, with no user action, and travels with the draft',
    '  · zero, negative, non-numeric and empty amounts are all refused — nothing leaves the screen',
    '  · a positive amount alone produces a usable input: no category, no installments, no card',
    '  · the refusal returns when the field is cleared, and every currency the type defines renders',
    '  · nothing numeric is on screen but the amount the person typed (contract §5 B1, spec §20)',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
