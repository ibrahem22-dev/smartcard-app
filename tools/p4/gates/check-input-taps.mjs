/**
 * GATE: check-input-taps — criterion C2.  →  `CHECK-INPUT-TAPS OK`
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['C2'];
export const SENTINEL = 'CHECK-INPUT-TAPS OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckInputScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkInput.taps.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const REQUIRED_CASES = [
  'renders the currency switcher, custom keypad, category chips and collapsed card picker',
  'completes a check in four taps or fewer plus the amount',
  'category, plan and card remain optional — amount plus submit still produces a draft',
  'offers every category the type defines',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const render = projects.find((p) => p && p.displayName === 'render');
  if (!render) return { error: JEST_CONFIG + ' has no "render" project' };
  return { config: { ...render, rootDir: root, testMatch: ['**/' + SUITE] } };
};

export const run = async ({ root }) => {
  if (!existsSync(join(root, SCREEN))) return fail(SCREEN + ' does not exist');
  if (!existsSync(join(root, SUITE))) return fail(SUITE + ' does not exist');
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
    SUITE + ' mounts ' + SCREEN + ':',
    '  · currency switcher, custom keypad, category chips, collapsed card picker',
    '  · a check with optionals completes in four taps plus the amount; optionals stay optional',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
