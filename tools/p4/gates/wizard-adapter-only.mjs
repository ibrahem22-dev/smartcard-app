/**
 * GATE: wizard-adapter-only — criterion W5.  →  `WIZARD-ADAPTER-ONLY OK`
 *
 * The created card reaches the vault through the adapter. No wizard path writes a
 * raw dataset value (pack row, packStore, units JSON).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['W5'];
export const SENTINEL = 'WIZARD-ADAPTER-ONLY OK';
export const MEASURES = 'unit+source';

const ADAPTER = 'src/data/adapter/wizardVault.ts';
const UNIT = 'src/data/adapter/__tests__/wizardVault.test.ts';
const SCREEN = 'src/screens/AddCardScreen.tsx';
const STORE = 'src/store/useCardsStore.ts';
const JEST_CONFIG = 'jest.config.cjs';

const UNIT_CASES = [
  'a catalog pick persists a UserCard whose product id is the catalog id',
  'the generic path mints a local product id that is not a catalog row',
  'refuses a catalog id that is not a CURRENT product rather than writing a dataset row',
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
  for (const file of [ADAPTER, UNIT, SCREEN, STORE]) {
    if (!existsSync(join(root, file))) {
      return fail(file + ' does not exist — W5 has no adapter vault write to measure');
    }
  }

  const adapter = readFileSync(join(root, ADAPTER), 'utf8');
  for (const needle of ['writeWizardCard', 'UserCard', 'CardProduct', 'isRawDatasetValue']) {
    if (!adapter.includes(needle)) return fail(ADAPTER + ' lost ' + needle);
  }

  const screen = readFileSync(join(root, SCREEN), 'utf8');
  if (!screen.includes('writeWizardCard')) {
    return fail(SCREEN + ' does not write through writeWizardCard');
  }
  if (!screen.includes('addVaultEntry')) {
    return fail(SCREEN + ' does not persist through addVaultEntry');
  }
  if (screen.includes('createManualCard')) {
    return fail(SCREEN + ' still writes via createManualCard — that mixed EngineCard is not the adapter vault path');
  }
  for (const forbidden of ['pack.json', 'packStore', 'putPackRow', 'units']) {
    if (screen.includes(forbidden)) {
      return fail(SCREEN + ' writes or names a raw dataset path (' + forbidden + ')');
    }
  }

  const store = readFileSync(join(root, STORE), 'utf8');
  if (!store.includes('addVaultEntry')) {
    return fail(STORE + ' has no addVaultEntry — the wizard has nowhere adapter-shaped to persist');
  }

  const unitCfg = projectConfig(root, 'unit', UNIT);
  if (unitCfg.error) return fail(unitCfg.error);
  const unit = requireJestCases(root, UNIT, UNIT_CASES, [
    '--config', JSON.stringify(unitCfg.config),
  ]);
  if (unit.problems.length) return fail(unit.problems.join(' · '), unit.summary ?? undefined);

  return ok(SENTINEL, [
    ADAPTER + ' writes UserCard + CardProduct; catalog ids stay catalog ids; generic is local',
    SCREEN + ' calls writeWizardCard then addVaultEntry — no pack.json / packStore / createManualCard',
    UNIT + ' · ' + unit.summary,
  ].join('\n'));
};
