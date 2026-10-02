/**
 * GATE: fx-compare-explainer — criterion X4.  →  `FX-COMPARE-EXPLAINER OK`
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['X4'];
export const SENTINEL = 'FX-COMPARE-EXPLAINER OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/fx/FxCompareSheet.tsx';
const SUITE = 'src/screens/fx/__tests__/fxCompare.explainer.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const REQUIRED_CASES = [
  'omits the expander when no ranked quote exists',
  'paints base, markup, fixed fee and total from the winner quote, not a surface recomputation',
  'paints every step of the winner quote reason trace',
  'the painted identity is the engine quote, not amount times rate on the surface',
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
    '  · expander paints winner quote fields and that quote\'s reason-trace steps',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
