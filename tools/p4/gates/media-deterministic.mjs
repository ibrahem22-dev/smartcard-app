/**
 * GATE: media-deterministic — criterion M2.  →  `MEDIA-DETERMINISTIC OK`
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['M2'];
export const SENTINEL = 'MEDIA-DETERMINISTIC OK';
export const MEASURES = 'source';

const RESOLVER = 'src/media/resolveMedia.ts';
const SUITE = 'src/media/__tests__/resolveMedia.test.ts';
const JEST_CONFIG = 'jest.config.cjs';

const REQUIRED_CASES = [
  'the same subject and media set yield the same tier and assetId twice',
  'reordering the media set does not change the resolution',
];

const NETWORK = /\b(fetch|XMLHttpRequest|WebSocket)\b|https?:\/\//;
const NONDET = /\bMath\.random\b|\bDate\.now\b|\bcrypto\.randomUUID\b/;

const unitConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const unit = projects.find((p) => p && p.displayName === 'unit');
  if (!unit) return { error: JEST_CONFIG + ' has no "unit" project' };
  return { config: { ...unit, rootDir: root, testMatch: ['**/' + SUITE] } };
};

export const run = async ({ root }) => {
  const abs = join(root, RESOLVER);
  if (!existsSync(abs)) return fail(RESOLVER + ' does not exist');
  const src = readFileSync(abs, 'utf8');
  if (NETWORK.test(src)) {
    return fail(RESOLVER + ' contains a network call or URL — M2 is offline');
  }
  if (NONDET.test(src)) {
    return fail(RESOLVER + ' contains Math.random / Date.now / randomUUID — resolution must be deterministic');
  }
  if (!existsSync(join(root, SUITE))) return fail(SUITE + ' does not exist');
  const { config, error } = unitConfigFor(root);
  if (error) return fail(error);
  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);
  return ok(SENTINEL, [
    RESOLVER + ' has no network or nondeterministic call',
    SUITE + ' same subject + same set → same tier and assetId, order-independent',
    String(summary),
  ].join('\n'));
};
