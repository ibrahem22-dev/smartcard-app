/**
 * GATE: purchase-logging — criterion L1.  →  `PURCHASE-LOGGING OK`
 *
 * The primary action "I made this purchase" writes the purchase to the activity store.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['L1'];
export const SENTINEL = 'PURCHASE-LOGGING OK';
export const MEASURES = 'unit+render';

const MAPPER = 'src/screens/check/activityMapper.ts';
const STORE = 'src/store/useActivityStore.ts';
const SCREEN = 'src/screens/check/CheckVerdictScreen.tsx';
const UNIT = 'src/screens/check/__tests__/purchaseLogging.test.ts';
const RENDER = 'src/screens/check/__tests__/purchaseLogging.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const UNIT_CASES = [
  'writeLoggedPurchase records amount, activityId and loggedAt',
  'refusing a non-positive amount does not invent a log',
];

const RENDER_CASES = [
  "'I made this purchase' writes the purchase to the activity store",
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
  for (const file of [MAPPER, STORE, SCREEN, UNIT, RENDER]) {
    if (!existsSync(join(root, file))) {
      return fail(file + ' does not exist — L1 has no purchase-logging path to measure');
    }
  }

  const mapper = readFileSync(join(root, MAPPER), 'utf8');
  if (!mapper.includes('writeLoggedPurchase')) {
    return fail(MAPPER + ' lost writeLoggedPurchase');
  }

  const store = readFileSync(join(root, STORE), 'utf8');
  if (!store.includes('logPurchase')) {
    return fail(STORE + ' has no logPurchase — L1 has nowhere to write');
  }
  if (!store.includes('getEncryptedStorage')) {
    return fail(STORE + ' does not persist through the encrypted vault');
  }

  const screen = readFileSync(join(root, SCREEN), 'utf8');
  if (!screen.includes("t('עשיתי את הרכישה הזאת')")) {
    return fail(SCREEN + ' lost the spec §9 primary action copy');
  }
  if (!screen.includes('check-verdict-log-purchase')) {
    return fail(SCREEN + ' has no log-purchase control');
  }
  if (!screen.includes('logPurchase(written)')) {
    return fail(SCREEN + ' does not write the activity store');
  }

  const unitCfg = projectConfig(root, 'unit', UNIT);
  if (unitCfg.error) return fail(unitCfg.error);
  const unit = requireJestCases(root, UNIT, UNIT_CASES, [
    '--config', JSON.stringify(unitCfg.config),
  ]);
  if (unit.problems.length) return fail(unit.problems.join(' · '), unit.summary ?? undefined);

  const renderCfg = projectConfig(root, 'render', RENDER);
  if (renderCfg.error) return fail(renderCfg.error);
  const rendered = requireJestCases(root, RENDER, RENDER_CASES, [
    '--config', JSON.stringify(renderCfg.config),
  ]);
  if (rendered.problems.length) {
    return fail(rendered.problems.join(' · '), rendered.summary ?? undefined);
  }

  return ok(SENTINEL, [
    SCREEN + ' primary action writes through writeLoggedPurchase → useActivityStore.logPurchase',
    UNIT + ' · ' + unit.summary,
    RENDER + ' · ' + rendered.summary,
  ].join('\n'));
};
