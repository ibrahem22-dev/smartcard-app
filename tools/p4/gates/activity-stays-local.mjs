/**
 * GATE: activity-stays-local — criterion L4.  →  `ACTIVITY-STAYS-LOCAL OK`
 *
 * Nothing logged leaves the device. The analytics barrier refuses an activity record.
 *
 * NEGATIVE CONTROL (contract §11 L4): pass an activity record to the analytics
 * boundary and watch it refuse.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['L4'];
export const SENTINEL = 'ACTIVITY-STAYS-LOCAL OK';
export const MEASURES = 'unit+source';

const TRACK = 'src/analytics/track.ts';
const UNIT = 'src/analytics/__tests__/activityStaysLocal.test.ts';
const JEST_CONFIG = 'jest.config.cjs';

const UNIT_CASES = [
  'passing an activity record to track() is refused and sends nothing',
  'a nested activity record is refused the same way',
  'declared props without activity still send — the control',
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
  for (const file of [TRACK, UNIT]) {
    if (!existsSync(join(root, file))) {
      return fail(file + ' does not exist — L4 has no activity barrier to measure');
    }
  }

  const track = readFileSync(join(root, TRACK), 'utf8');
  for (const needle of ['findActivityCarrier', 'activity cannot leave the device', 'Logged purchases']) {
    if (!track.includes(needle)) return fail(TRACK + ' lost ' + needle);
  }
  if (track.includes('activity.types') || track.includes("from '../types/activity")) {
    return fail(TRACK + ' imports an activity vault type — the boundary must not name vault types');
  }

  const unitSrc = readFileSync(join(root, UNIT), 'utf8');
  if (!unitSrc.includes('activityId') || !unitSrc.includes('track(')) {
    return fail(UNIT + ' no longer passes an activity record to track()');
  }

  const unitCfg = projectConfig(root, 'unit', UNIT);
  if (unitCfg.error) return fail(unitCfg.error);
  const unit = requireJestCases(root, UNIT, UNIT_CASES, [
    '--config', JSON.stringify(unitCfg.config),
  ]);
  if (unit.problems.length) return fail(unit.problems.join(' · '), unit.summary ?? undefined);

  return ok(SENTINEL, [
    TRACK + ' refuses activityId after consent, without importing activity types',
    UNIT + ' · ' + unit.summary,
  ].join('\n'));
};
