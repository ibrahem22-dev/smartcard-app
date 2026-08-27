/**
 * GATE: limit-consumption — criterion L2.  →  `LIMIT-CONSUMPTION OK`
 *
 * A logged purchase consumes available limit; the next verdict's impact strip
 * reflects the load engine's availableAfterChangesIls.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['L2'];
export const SENTINEL = 'LIMIT-CONSUMPTION OK';
export const MEASURES = 'unit+render';

const MAPPER = 'src/screens/check/activityMapper.ts';
const LOOP = 'src/screens/check/checkLoop.ts';
const SCREEN = 'src/screens/check/CheckVerdictScreen.tsx';
const UNIT = 'src/screens/check/__tests__/limitConsumption.test.ts';
const RENDER = 'src/screens/check/__tests__/limitConsumption.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const UNIT_CASES = [
  'the load engine availableAfterChangesIls drops by the logged amount',
  "the next verdict's impact strip reflects the logged purchase",
];

const RENDER_CASES = [
  'paints the post-log load-engine availableAfterChangesIls, not a surface subtraction',
  'the next strip is lower than the pre-log strip by the logged amount',
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
  for (const file of [MAPPER, LOOP, SCREEN, UNIT, RENDER]) {
    if (!existsSync(join(root, file))) {
      return fail(file + ' does not exist — L2 has no limit-consumption path to measure');
    }
  }

  const mapper = readFileSync(join(root, MAPPER), 'utf8');
  for (const needle of ['loadCardsFromVault', 'loggedThisCyclePurchasesIls']) {
    if (!mapper.includes(needle)) return fail(MAPPER + ' lost ' + needle);
  }

  const loop = readFileSync(join(root, LOOP), 'utf8');
  if (!loop.includes('evaluateFinancialLoad')) {
    return fail(LOOP + ' does not call the load engine for the impact strip');
  }
  if (!loop.includes('loadCardsFromVault')) {
    return fail(LOOP + ' does not feed logged purchases into the load engine');
  }
  if (!loop.includes('availableAfterChangesIls')) {
    return fail(LOOP + ' does not paint availableAfterChangesIls');
  }

  const screen = readFileSync(join(root, SCREEN), 'utf8');
  if (screen.includes('evaluateFinancialLoad')) {
    return fail(SCREEN + ' calls the load engine — the strip must arrive as a prop');
  }
  if (/creditLimit.*=.*logged|loggedThisCycle/.test(screen)) {
    return fail(SCREEN + ' subtracts logged purchases itself');
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
    LOOP + ' feeds logged purchases into evaluateFinancialLoad; the strip is availableAfterChangesIls',
    UNIT + ' · ' + unit.summary,
    RENDER + ' · ' + rendered.summary,
  ].join('\n'));
};
