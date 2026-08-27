/**
 * GATE: finish-setup — criterion O4.  →  `FINISH-SETUP OK`
 *
 * Persistent, dismissible Finish setup on Home carries every skipped onboarding
 * step. Measured on the rendered Home surface.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['O4'];
export const SENTINEL = 'FINISH-SETUP OK';
export const MEASURES = 'render';

const HOME = 'src/screens/HomeScreen.tsx';
const STORE = 'src/store/useFinishSetupStore.ts';
const SUITE = 'src/screens/__tests__/finishSetup.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'Home does not show Finish setup when nothing was skipped',
  'the checklist carries every skipped step and never language confirmation',
  'the checklist lists only the steps that were actually skipped',
  'dismiss hides the checklist and the hide survives remount',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const render = projects.find((p) => p && p.displayName === RENDER_PROJECT);
  if (!render) return { error: JEST_CONFIG + ' has no "' + RENDER_PROJECT + '" project' };
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
  for (const rel of [HOME, STORE, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist');
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
    SUITE + ' measures O4 on the RENDERED Home surface:',
    '  · empty skip list paints no card',
    '  · skipped income / add-card / security appear; language never does',
    '  · dismiss hides the card and the hide survives remount',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
