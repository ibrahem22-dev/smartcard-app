/**
 * GATE: last4-stays-local — criterion W7.  →  `LAST4-STAYS-LOCAL OK`
 *
 * last4 is confined to the encrypted local vault. It cannot reach track().
 * The only authorised path off the device is the user-initiated profile transfer.
 *
 * NEGATIVE CONTROL (contract §7.1 W7): pass a UserCard carrying last4 to track()
 * and watch the analytics boundary refuse it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['W7'];
export const SENTINEL = 'LAST4-STAYS-LOCAL OK';
export const MEASURES = 'unit+source';

const TRACK = 'src/analytics/track.ts';
const UNIT = 'src/analytics/__tests__/last4StaysLocal.test.ts';
const TRANSFER = 'src/types/profileShare.types.ts';
const JEST_CONFIG = 'jest.config.cjs';

const UNIT_CASES = [
  'passing a UserCard carrying last4 to track() is refused and sends nothing',
  'a bare last4 prop is refused the same way',
  'declared props without last4 still send — the control',
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
  for (const file of [TRACK, UNIT, TRANSFER]) {
    if (!existsSync(join(root, file))) {
      return fail(file + ' does not exist — W7 has no last4 boundary to measure');
    }
  }

  const track = readFileSync(join(root, TRACK), 'utf8');
  for (const needle of ['findLast4Carrier', 'last4 cannot leave the encrypted vault', 'profile transfer']) {
    if (!track.includes(needle)) return fail(TRACK + ' lost ' + needle);
  }
  if (track.includes("from '../types/card.types'") || track.includes("from '../../types/card.types'")) {
    return fail(TRACK + ' imports a vault type — B7 forbids vault types at the analytics boundary');
  }

  const transfer = readFileSync(join(root, TRANSFER), 'utf8');
  if (!transfer.includes('export interface TransferCard') || !/\blast4\s*:\s*string/.test(transfer)) {
    return fail(TRANSFER + ' lost TransferCard.last4 — that user-initiated export is the authorised off-device path');
  }

  const unitSrc = readFileSync(join(root, UNIT), 'utf8');
  if (!unitSrc.includes('UserCard') || !unitSrc.includes('last4')) {
    return fail(UNIT + ' no longer passes a UserCard carrying last4 to track()');
  }

  const unitCfg = projectConfig(root, 'unit', UNIT);
  if (unitCfg.error) return fail(unitCfg.error);
  const unit = requireJestCases(root, UNIT, UNIT_CASES, [
    '--config', JSON.stringify(unitCfg.config),
  ]);
  if (unit.problems.length) return fail(unit.problems.join(' · '), unit.summary ?? undefined);

  return ok(SENTINEL, [
    TRACK + ' refuses last4 after consent, without importing UserCard',
    TRANSFER + ' keeps TransferCard.last4 as the authorised user-initiated export',
    UNIT + ' · ' + unit.summary,
  ].join('\n'));
};
