/**
 * GATE: catalog-reach — criterion W2.  →  `CATALOG-REACH OK`
 *
 * Population is derived from the shipped catalog through CardsAdapter, never hand-listed.
 * Search must hit every CURRENT product. The generic/manual path exists for anything absent.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['W2'];
export const SENTINEL = 'CATALOG-REACH OK';
export const MEASURES = 'unit+render';

const SEARCH = 'src/data/adapter/catalogSearch.ts';
const UNIT = 'src/data/adapter/__tests__/catalogSearch.test.ts';
const SCREEN = 'src/screens/AddCardScreen.tsx';
const RENDER = 'src/screens/__tests__/addCard.catalog.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const UNIT_CASES = [
  'the current-product population is derived from the shipped catalog and agrees with countCurrentProducts',
  'search reaches every derived current product',
  'institutions are derived from the same population, not listed by hand',
  'the generic path creates a card that is not in the catalog',
];

const RENDER_CASES = [
  'opens as a search surface, not a three-issuer picker',
  "can't-find-it opens the fully-capable generic path",
  'searching a derived product id shows that hit',
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
  for (const file of [SEARCH, UNIT, SCREEN, RENDER]) {
    if (!existsSync(join(root, file))) {
      return fail(file + ' does not exist — W2 has no catalog-reach implementation to measure');
    }
  }

  const src = readFileSync(join(root, UNIT), 'utf8');
  for (const [needle, what] of [
    ['countCurrentProducts', 'the adapter-derived population cross-check'],
    ['searchCatalog', 'search over the derived population'],
    ['currentCatalogInstitutions', 'institutions derived from the same population'],
    ['GENERIC_CATALOG_PATH', 'the generic path for anything absent'],
  ]) {
    if (!src.includes(needle)) {
      return fail(UNIT + ' lost ' + what + ' (' + needle + ')');
    }
  }
  if (/\b378\b/.test(src) || /\b17 institutions\b/.test(src)) {
    return fail(UNIT + ' hard-lists 378 or 17 — W2 derives the population from the shipped pack');
  }

  const unitCfg = projectConfig(root, 'unit', UNIT);
  if (unitCfg.error) return fail(unitCfg.error);
  const unit = requireJestCases(root, UNIT, UNIT_CASES, [
    '--config', JSON.stringify(unitCfg.config),
  ]);
  if (unit.problems.length) return fail(unit.problems.join(' · '), unit.summary ?? undefined);

  const reached = String(unit.output ?? '').match(/reached\s+(\d+)\s*\/\s*(\d+)/);
  if (!reached || reached[1] !== reached[2]) {
    return fail('the unit suite printed no "reached N / N" covering every derived CURRENT product');
  }

  const renderCfg = projectConfig(root, 'render', RENDER);
  if (renderCfg.error) return fail(renderCfg.error);
  const rendered = requireJestCases(root, RENDER, RENDER_CASES, [
    '--config', JSON.stringify(renderCfg.config),
  ]);
  if (rendered.problems.length) {
    return fail(rendered.problems.join(' · '), rendered.summary ?? undefined);
  }

  return ok(SENTINEL, [
    SEARCH + ' derives CURRENT products through CardsAdapter; search hits every one',
    `reached ${reached[1]} / ${reached[2]}`,
    UNIT + ' · ' + unit.summary,
    RENDER + ' mounts ' + SCREEN + ' as search-first with a generic path · ' + rendered.summary,
  ].join('\n'));
};
