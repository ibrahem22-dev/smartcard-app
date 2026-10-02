/**
 * GATE: onboarding-honesty — criterion O3.  →  `ONBOARDING-HONESTY OK`
 *
 * Copy is measured on the rendered surface against spec §18-A wording.
 * A paraphrase that "means the same thing" is the defect.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['O3'];
export const SENTINEL = 'ONBOARDING-HONESTY OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/onboarding/OnboardingScreen.tsx';
const SUITE = 'src/screens/onboarding/__tests__/onboarding.honesty.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'every step states why the data is asked and where it stays',
  'income paints the spec §6 line verbatim — not a paraphrase',
  'add-card and security paint the scoped §18-A claim verbatim',
  'the retired OD-11 sentence All data lives on this device is absent from every step',
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
  if (!existsSync(join(root, SCREEN))) {
    return fail(SCREEN + ' does not exist — there is no onboarding copy for O3 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — O3 is measured by rendering the copy');
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
    SUITE + ' measures O3 on the RENDERED surface against spec §18-A:',
    '  · every step states why data is asked and where it stays',
    '  · income uses the spec §6 line verbatim',
    '  · add-card and security use the scoped claim; the retired OD-11 sentence is absent',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
