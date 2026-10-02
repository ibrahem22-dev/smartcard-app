/**
 * GATE: benefit-hint — criterion C5.  →  `BENEFIT-HINT OK`
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['C5'];
export const SENTINEL = 'BENEFIT-HINT OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckInputScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkInput.benefitHint.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const REQUIRED_CASES = [
  'omitting the hint paints no chip',
  'a supplied match paints that label',
  'the hint is the supplied match, not a surface invention',
  'an empty mount does not invent a match to fill the slot',
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
    '  · hint paints only a supplied match; omission invents nothing',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
