/**
 * GATE: media-resolves — criterion M1.  →  `MEDIA-RESOLVES OK`
 *
 * p4-media.mjs derives the population, then delegates here. This gate must print
 * `resolved N / N` matching that population. It runs the APP resolver, not a second ladder.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['M1'];
export const SENTINEL = 'MEDIA-RESOLVES OK';
export const MEASURES = 'artifact';

const SUITE = 'src/media/__tests__/resolveMedia.test.ts';
const JEST_CONFIG = 'jest.config.cjs';

const REQUIRED_CASES = ['every derived subject resolves on the empty media set'];

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
  if (!existsSync(join(root, SUITE))) return fail(SUITE + ' does not exist');
  const { config, error } = unitConfigFor(root);
  if (error) return fail(error);
  const { problems, summary, output } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);
  const match = String(output ?? '').match(/resolved\s+(\d+)\s*\/\s*(\d+)/);
  if (!match) {
    return fail('the suite printed no "resolved N / N" line — p4-media cannot agree the population');
  }
  const got = match[1];
  const total = match[2];
  if (got !== total) {
    return fail(`resolved ${got} / ${total} — the target is a resolution path for every subject`);
  }
  return ok(SENTINEL, [
    `resolved ${got} / ${total}`,
    SUITE + ' ran the app resolver over the derived population, empty media set included',
    String(summary),
  ].join('\n'));
};
