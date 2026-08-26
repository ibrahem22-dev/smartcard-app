/**
 * GATE: runner-up — criterion D5.  →  `RUNNER-UP OK`
 *
 *   > **D5.** *"The runner-up row renders, carrying the scoring engine's
 *   > deltaFromBestIls when the engine supplies it and NO delta at all when the
 *   > engine omits it; the surface never computes one."*
 *
 * MEASURES: 'render'. The suite mounts the screen with `scoreCards` output and
 * asserts the painted row against that object's delta field. A grep of the
 * source for "saves" would prove the comment.
 *
 * When the engine omits the field (`deltasSuppressed`), inventing a subtraction
 * on the surface is the defect this gate exists to catch.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['D5'];
export const SENTINEL = 'RUNNER-UP OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckVerdictScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkVerdict.runnerUp.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  "paints the scoring engine's deltaFromBestIls when the engine supplies it",
  'paints no delta at all when the engine omits it',
  'omits the runner-up row when there is no second ranked card',
  'the claimed delta is the engine field, never a surface subtraction of two costs',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness to measure D5 with' };
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
    return fail(SCREEN + ' does not exist — there is no Check Verdict surface for D5 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — D5 is measured by rendering the runner-up row');
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
    SUITE + ' mounts ' + SCREEN + ' with scoreCards output (the N1 engine):',
    '  · delta paints deltaFromBestIls when present; omission paints no number',
    '  · no second ranked card omits the row; the claimed figure is the engine field',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
