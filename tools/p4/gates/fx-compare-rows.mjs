/**
 * GATE: fx-compare-rows — criterion X2.  →  `FX-COMPARE-ROWS OK`
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['X2'];
export const SENTINEL = 'FX-COMPARE-ROWS OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/fx/FxCompareSheet.tsx';
const SUITE = 'src/screens/fx/__tests__/fxCompare.rows.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const REQUIRED_CASES = [
  'renders ranked rows in the engine order, cheapest first',
  'unknown-leg cards are listed separately and never ranked',
  'paints the engine floor reason as the exemption and never invents a delta',
  'the painted total is the engine effectiveIls, not a surface recomputation',
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
  return ok(SENTINEL, [
    SUITE + ' mounts ' + SCREEN + ' with compareAbroad output:',
    '  · ranked ascending; unknown unranked; floor reason painted; no invented delta',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
