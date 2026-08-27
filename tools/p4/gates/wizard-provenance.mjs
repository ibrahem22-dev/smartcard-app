/**
 * GATE: wizard-provenance — criterion W4.  →  `WIZARD-PROVENANCE OK`
 *
 * Catalog prefills render as Verified chips and unknowns as Estimate chips, from the
 * adapter's provenance vocabulary rather than a local restatement.
 *
 * NEGATIVE CONTROL (contract §7 W4): render a catalog prefill as an Estimate chip
 * and watch this gate fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['W4'];
export const SENTINEL = 'WIZARD-PROVENANCE OK';
export const MEASURES = 'unit+render';

const VOCAB = 'src/data/adapter/wizardProvenance.ts';
const UNIT = 'src/data/adapter/__tests__/wizardProvenance.test.ts';
const SCREEN = 'src/screens/AddCardScreen.tsx';
const RENDER = 'src/screens/__tests__/addCard.provenance.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';

const UNIT_CASES = [
  'catalog prefills are the VERIFIED member of the Data Contract vocabulary',
  'unknowns are the ESTIMATE member of the Data Contract vocabulary',
  'a VERIFIED pack chip is not remapped to ESTIMATE',
];

const RENDER_CASES = [
  'catalog name and issuer wear Verified chips, not Estimate',
  'empty unknown fields wear Estimate chips',
  'a catalog-prefilled FX fee keeps the pack Verified chip',
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
  for (const file of [VOCAB, UNIT, SCREEN, RENDER]) {
    if (!existsSync(join(root, file))) {
      return fail(file + ' does not exist — W4 has no wizard provenance to measure');
    }
  }

  const vocab = readFileSync(join(root, VOCAB), 'utf8');
  for (const needle of [
    "from '../../authority/provenanceChip'",
    'catalogPrefillChip',
    'unknownFieldChip',
    'wizardViewForPackChip',
    "ProvenanceChip = 'VERIFIED'",
  ]) {
    if (!vocab.includes(needle) && !vocab.includes(needle.replace(/'/g, '"'))) {
      return fail(VOCAB + ' lost ' + needle);
    }
  }

  const screen = readFileSync(join(root, SCREEN), 'utf8');
  if (!screen.includes('ProvenanceChip')) {
    return fail(SCREEN + ' constructs chip markup locally instead of using ProvenanceChip');
  }
  if (!screen.includes('catalogPrefillView') || !screen.includes('unknownFieldView')) {
    return fail(SCREEN + ' restates chips locally instead of asking wizardProvenance');
  }
  if (/chip:\s*['"]ESTIMATE['"]/.test(screen) || /chip:\s*['"]VERIFIED['"]/.test(screen)) {
    return fail(SCREEN + ' restates the chip vocabulary locally — W4 requires the adapter mapping');
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
    VOCAB + ' maps catalog prefills to VERIFIED and unknowns to ESTIMATE from the Data Contract vocabulary',
    UNIT + ' · ' + unit.summary,
    RENDER + ' mounts catalog Verified vs unknown Estimate · ' + rendered.summary,
  ].join('\n'));
};
