/**
 * GATE: one-verdict — criterion D2.  →  `ONE-VERDICT OK`
 *
 *   > **D2.** *"The pill and the Financial Impact panel come from ONE engine computation:
 *   > no input produces a pill that disagrees with the panel's numbers."*
 *   > (spec §9 hard rule; Stitch sample: "Good to go" at 41% vs a 35% threshold)
 *
 * MEASURES: 'render'. The suite mounts the screen with engine-produced results (the B1
 * seam) and asserts the rendered pill against the rendered panel. A grep of the source
 * for "one computation" would prove the file mentions it.
 *
 * The suite is named `*.render.test.tsx` so it also runs in the app's default render
 * project. This gate still requires each case BY NAME.
 *
 * NEGATIVE CONTROL (contract §9 D2): derive the pill from a second code path and watch
 * this gate fail. Spec §9 names the counter-example; a gate that has never seen that
 * case fail has not been shown to catch it.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['D2'];
export const SENTINEL = 'ONE-VERDICT OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckVerdictScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkVerdict.one.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'the Stitch sample — 41% load against the 35% threshold renders caution, not Good to go',
  'the pill and every Financial Impact bullet come from the same result object',
  'Good to go never paints when the panel shows load above the safe threshold',
  'caution, dont_buy_now and wait each still agree with the panel of the same result',
  'without a result there is no pill and no panel — a canned pair would be a second computation',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness to measure D2 with' };
  }
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const render = projects.find((p) => p && p.displayName === RENDER_PROJECT);
  if (!render) {
    return { error: JEST_CONFIG + ' has no "' + RENDER_PROJECT + '" project' };
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
    return fail(SCREEN + ' does not exist — there is no Check Verdict surface for D2 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — D2 is measured by rendering the pill against the panel');
  }

  const { config, error } = renderConfigFor(root);
  if (error) return fail(error);

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }

  return ok(SENTINEL, [
    SUITE + ' mounts ' + SCREEN + ' with engine-produced results (the B1 seam):',
    '  · pill testID is result.verdict; each panel bullet claims the same object\'s number',
    '  · Stitch sample (4100 on 10000 income, 0.41 vs 0.35) renders caution, not Good to go',
    '  · Good to go is refused whenever the rendered load is above the result\'s safe ratio',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
