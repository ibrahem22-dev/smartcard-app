/**
 * GATE: pill-panel-agree — criterion R3.  →  `PILL-PANEL-AGREE OK`
 *
 *   > **R3.** *"The pill and the Financial Impact panel never disagree, as an automated
 *   > property over generated inputs."*  (roadmap §10 P4 DoD 'automated'; spec §9 hard rule)
 *
 * MEASURES: 'render'. The suite generates Check drafts, runs each through the B1 seam,
 * mounts the screen, and asserts the painted pill against a reconstruction from the
 * painted panel. A grep of the source for "never disagree" would prove the comment.
 *
 * D2 named the Stitch sample. R3 is the property over a generated population that
 * includes it. A check over zero generated inputs is not a check (§2 rule 5); the
 * suite asserts a minimum count.
 *
 * NEGATIVE CONTROL (contract §12 R3): perturb one path's threshold and watch this
 * property fail.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['R3'];
export const SENTINEL = 'PILL-PANEL-AGREE OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckVerdictScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkVerdict.agree.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'generated inputs never paint a pill that disagrees with the panel',
  'the Stitch sample is inside the generated set and is caution',
  'wait and hard-flag cases still paint the engine verdict next to its own panel',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness to measure R3 with' };
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
    return fail(SCREEN + ' does not exist — there is no Check Verdict surface for R3 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — R3 is measured by a generated-input property on the rendered surface');
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
    SUITE + ' mounts ' + SCREEN + ' over a generated population (the B1 seam):',
    '  · painted pill equals result.verdict AND the pill reconstructed from the painted load',
    '  · reconstruction uses that result\'s own safe/hard ratios unless PERTURBED_SAFE is set',
    '  · Stitch (0.41 vs 0.35) is inside the generated set',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
