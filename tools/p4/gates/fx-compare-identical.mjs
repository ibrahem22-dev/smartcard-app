/**
 * GATE: fx-compare-identical — criterion R4.  →  `FX-COMPARE-IDENTICAL OK`
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['R4'];
export const SENTINEL = 'FX-COMPARE-IDENTICAL OK';
export const MEASURES = 'render';

const SUITE = 'src/screens/fx/__tests__/fxCompare.identical.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const REQUIRED_CASES = [
  'Check Verdict and Card DNA entries produce the same rendered tree',
  'the identity holds for an empty mount as well as a populated comparison',
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
    SUITE + ' compares the two entry points as rendered trees:',
    '  · populated comparison and empty mount are byte-identical across entries',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
