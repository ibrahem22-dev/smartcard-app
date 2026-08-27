/**
 * GATE: verdict-history — criterion L3.  →  `VERDICT-HISTORY OK`
 *
 * Verdict history is queryable substrate rather than a write-only log.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['L3'];
export const SENTINEL = 'VERDICT-HISTORY OK';
export const MEASURES = 'unit';

const MAPPER = 'src/screens/check/activityMapper.ts';
const STORE = 'src/store/useActivityStore.ts';
const UNIT = 'src/screens/check/__tests__/verdictHistory.test.ts';
const JEST_CONFIG = 'jest.config.cjs';

const UNIT_CASES = [
  'querying the history returns written verdicts in time order',
  'a card filter returns that card rather than the whole write-only log',
];

const projectConfig = (root, displayName, suite) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const project = projects.find((p) => p && p.displayName === displayName);
  if (!project) return { error: JEST_CONFIG + ' has no "' + displayName + '" project' };
  return { config: { ...project, rootDir: root, testMatch: ['**/' + suite] } };
};

export const run = async ({ root }) => {
  for (const file of [MAPPER, STORE, UNIT]) {
    if (!existsSync(join(root, file))) {
      return fail(file + ' does not exist — L3 has no verdict-history substrate to measure');
    }
  }

  const mapper = readFileSync(join(root, MAPPER), 'utf8');
  if (!mapper.includes('queryVerdictHistory')) {
    return fail(MAPPER + ' lost queryVerdictHistory — a write-only log is not substrate');
  }
  if (!mapper.includes('writeVerdictHistory')) {
    return fail(MAPPER + ' lost writeVerdictHistory');
  }

  const store = readFileSync(join(root, STORE), 'utf8');
  if (!store.includes('recordVerdict')) {
    return fail(STORE + ' has no recordVerdict');
  }
  if (!store.includes('queryVerdicts')) {
    return fail(STORE + ' has no queryVerdicts — history would be write-only');
  }

  const unitSrc = readFileSync(join(root, UNIT), 'utf8');
  if (!unitSrc.includes('queryVerdictHistory')) {
    return fail(UNIT + ' does not query history');
  }

  const unitCfg = projectConfig(root, 'unit', UNIT);
  if (unitCfg.error) return fail(unitCfg.error);
  const unit = requireJestCases(root, UNIT, UNIT_CASES, [
    '--config', JSON.stringify(unitCfg.config),
  ]);
  if (unit.problems.length) return fail(unit.problems.join(' · '), unit.summary ?? undefined);

  return ok(SENTINEL, [
    MAPPER + ' queryVerdictHistory is the substrate; ' + STORE + ' records and queries',
    UNIT + ' · ' + unit.summary,
  ].join('\n'));
};
