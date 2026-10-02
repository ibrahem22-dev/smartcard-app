/**
 * GATE: no-account-surface — criterion O2.  →  `NO-ACCOUNT-SURFACE OK`
 *
 * Absence derived by sweeping the RENDERED onboarding flow, not by grepping
 * OnboardingScreen.tsx. A search that finds nothing because it never mounted
 * a step is not a sweep.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['O2'];
export const SENTINEL = 'NO-ACCOUNT-SURFACE OK';
export const MEASURES = 'render';

const SCREEN_DIR = 'src/screens/onboarding';
const SCREEN = 'src/screens/onboarding/OnboardingScreen.tsx';
const SUITE = 'src/screens/onboarding/__tests__/onboarding.account.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'the onboarding directory has at least one surface to sweep — a sweep of nothing is not a sweep',
  'language step paints no login, account, OTP or email',
  'income step paints no login, account, OTP or email',
  'add-card step paints no login, account, OTP or email',
  'security step paints no login, account, OTP or email',
  'no onboarding TextInput asks for email, password or OTP',
];

const collectScreens = (dir, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__') continue;
      collectScreens(p, acc);
    } else if (entry.endsWith('.tsx') && !entry.includes('.test.')) {
      acc.push(p);
    }
  }
  return acc;
};

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
  const dir = join(root, SCREEN_DIR);
  if (!existsSync(dir)) {
    return fail(SCREEN_DIR + ' does not exist — a sweep of a missing directory is not a sweep');
  }
  if (!existsSync(join(root, SCREEN))) {
    return fail(SCREEN + ' does not exist — there is no onboarding flow for O2 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — O2 is measured by rendering the flow');
  }
  const screens = collectScreens(dir);
  if (screens.length === 0) {
    return fail('no onboarding screens under ' + SCREEN_DIR + ' — a sweep of nothing is not a sweep');
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
    SUITE + ' sweeps the RENDERED onboarding flow (contract §2 rule 9):',
    '  · population ' + screens.length + ' onboarding screen(s) derived from ' + SCREEN_DIR,
    '  · language, income, add-card and security frames carry no login/account/OTP/email copy',
    '  · no TextInput on the flow asks for email, password or OTP',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
