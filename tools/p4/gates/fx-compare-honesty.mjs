/**
 * GATE: fx-compare-honesty — criterion X3.  →  `FX-COMPARE-HONESTY OK`
 *
 * Negative control (contract fence): label the reference rate as the real cost
 * and watch this gate fail.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['X3'];
export const SENTINEL = 'FX-COMPARE-HONESTY OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/fx/FxCompareSheet.tsx';
const SUITE = 'src/screens/fx/__tests__/fxCompare.honesty.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const REQUIRED_CASES = [
  'paints the engine rateUsed on a neutral reference chip, not a surface invention',
  'keeps the dashed Estimate chip structurally outside the reference lane',
  'paints the network-settlement caveat as persistent copy',
  'does not label the reference rate as the estimated real cost',
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
    '  · BOI reference is a neutral chip; dashed Estimate is separate; settlement caveat present',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
