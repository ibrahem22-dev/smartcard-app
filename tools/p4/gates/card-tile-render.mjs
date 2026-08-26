/**
 * GATE: card-tile-render — criterion M5.  →  `CARD-TILE-RENDER OK`
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['M5'];
export const SENTINEL = 'CARD-TILE-RENDER OK';
export const MEASURES = 'render';

const TILE = 'src/components/CardTile.tsx';
const SUITE = 'src/components/__tests__/CardTile.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const REQUIRED_CASES = [
  'paints the resolver surface and the nickname with no last4',
  'the masked group is built from last4 alone',
  'omitting last4 is the normal tile, not a degraded one',
  'the tile is the resolver surface, not a hard-coded image path',
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
  if (!existsSync(join(root, TILE))) return fail(TILE + ' does not exist');
  if (!existsSync(join(root, SUITE))) return fail(SUITE + ' does not exist');
  const { config, error } = renderConfigFor(root);
  if (error) return fail(error);
  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);
  return ok(SENTINEL, [
    SUITE + ' mounts ' + TILE + ':',
    '  · resolver surface + nickname; mask from last4 alone; omit is normal; no Image path',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
