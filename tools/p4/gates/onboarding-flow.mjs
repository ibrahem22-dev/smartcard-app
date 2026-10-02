/**
 * GATE: onboarding-flow — criterion O1.  →  `ONBOARDING-FLOW OK`
 *
 * Negative control: make the income step unskippable and watch the gate fail.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['O1'];
export const SENTINEL = 'ONBOARDING-FLOW OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/onboarding/OnboardingScreen.tsx';
const SUITE = 'src/screens/onboarding/__tests__/onboarding.flow.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'opens on the language confirmation, with English, Hebrew and Arabic rows',
  'preselects the device language before any user action',
  'language Skip accepts the device language and advances to income — it does not leave language unconfirmed',
  'cannot reach income, add-card or security without confirming language',
  'income is the second step and is skippable',
  'add first card is the third step and is skippable',
  'security and finish is the fourth step and is skippable',
  'the four steps appear in spec order and no other onboarding step is inserted',
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
    return fail(SCREEN + ' does not exist — there is no onboarding surface for O1 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — O1 is measured by rendering the screen');
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
    SUITE + ' mounts ' + SCREEN + ' and measures O1 on the RENDERED surface:',
    '  · language is first; English / עברית / العربية rows; device language preselected',
    '  · language Skip confirms device language — it is not an unconfirmed skip',
    '  · income, add-card and security follow in spec order and each has a skip control',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
