/**
 * GATE: loop-provenance — criterion R5.  →  `LOOP-PROVENANCE OK`
 *
 *   > **R5.** *"Every figure in the loop carries a provenance chip and every asset
 *   > resolving above the generated tier carries its attribution, as a derived
 *   > sweep of the rendered surfaces."*
 *
 * MEASURES: 'render'. The suite mounts Check Input, Check Verdict and FX Compare
 * and walks each tree for accessibilityValue texts that contain a digit. Each
 * such claim must have a shared ProvenanceChip in its parent group (the X3
 * NEUTRAL BOI badge counts as the chip for the reference rate). CardTile is
 * mounted generated (no collected attribution) and with a CLEARED benefit-lane
 * fixture that resolves above generated (attribution + chip). The named
 * negative control is planting one bare number and watching the sweep report it.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['R5'];
export const SENTINEL = 'LOOP-PROVENANCE OK';
export const MEASURES = 'render';

const INPUT = 'src/screens/check/CheckInputScreen.tsx';
const VERDICT = 'src/screens/check/CheckVerdictScreen.tsx';
const FX = 'src/screens/fx/FxCompareSheet.tsx';
const TILE = 'src/components/CardTile.tsx';
const SUITE = 'src/screens/check/__tests__/loopProvenance.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'every Check Input numeric claim has a ProvenanceChip in its parent group',
  'every Check Verdict numeric claim has a ProvenanceChip in its parent group',
  'every FX Compare numeric claim has a chip in its parent group, including the open explainer',
  'a generated CardTile does not wear collected-asset attribution',
  'an asset resolving above the generated tier carries attribution and a provenance chip',
  'a planted bare number is detected as bare — the sweep is not a vacuous pass',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness to measure R5 with' };
  }
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const render = projects.find((p) => p && p.displayName === RENDER_PROJECT);
  if (!render) {
    return { error: JEST_CONFIG + ' has no "' + RENDER_PROJECT + '" project' };
  }
  return {
    config: {
      ...render,
      rootDir: root,
      testMatch: ['**/' + SUITE],
    },
  };
};

export const run = async ({ root }) => {
  if (REQUIRED_CASES.length === 0) {
    return fail('this gate requires no cases — a check over zero items is not a check (§2 rule 5)');
  }
  for (const file of [INPUT, VERDICT, FX, TILE, SUITE]) {
    if (!existsSync(join(root, file))) {
      return fail(file + ' does not exist — R5 has no loop surface to sweep');
    }
  }

  const { config, error } = renderConfigFor(root);
  if (error) return fail(error);

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }

  return ok(SENTINEL, [
    SUITE + ' mounts Check Input, Check Verdict, FX Compare and CardTile and walks the trees:',
    '  · every accessibilityValue numeric claim has a chip in its parent group',
    '  · generated tiles wear no collected attribution; a CLEARED above-generated fixture does',
    '  · planting a bare number is detected as bare',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
