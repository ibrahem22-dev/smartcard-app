/**
 * GATE: club-resolver — criterion W3.  →  `CLUB-RESOLVER OK`
 *
 * Three questions identify a club from the derived catalog population, or end honestly
 * without inventing one.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['W3'];
export const SENTINEL = 'CLUB-RESOLVER OK';
export const MEASURES = 'unit+render';

const RESOLVER = 'src/data/adapter/clubResolver.ts';
const UNIT = 'src/data/adapter/__tests__/clubResolver.test.ts';
const UI = 'src/screens/addCard/ClubResolver.tsx';
const RENDER = 'src/screens/addCard/__tests__/clubResolver.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const UNIT_CASES = [
  'the club population is derived from the shipped catalog, not listed by hand',
  'three answers that uniquely pick a remaining club identify it',
  'unsure, unsure, none ends honestly without a club',
  'a club id that is not in the remaining set is refused rather than invented',
];

const RENDER_CASES = [
  'opens on question 1 over derived institutions',
  'three unsure/none answers end honestly without a club',
  'picking a remaining club after three questions identifies it',
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
  for (const file of [RESOLVER, UNIT, UI, RENDER]) {
    if (!existsSync(join(root, file))) {
      return fail(file + ' does not exist — W3 has no club resolver to measure');
    }
  }
  const src = readFileSync(join(root, UNIT), 'utf8');
  for (const needle of ['currentCatalogClubs', 'resolveClub', 'outcome: \'unknown\'', 'q3ClubNodeId']) {
    if (!src.includes(needle) && !src.includes(needle.replace(/'/g, '"'))) {
      return fail(UNIT + ' lost ' + needle);
    }
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
    RESOLVER + ' derives CURRENT clubs; three questions identify one or end unknown',
    UNIT + ' · ' + unit.summary,
    RENDER + ' mounts three questions · ' + rendered.summary,
  ].join('\n'));
};
