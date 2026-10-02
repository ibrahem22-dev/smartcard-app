/**
 * GATE: verdict-provenance — criterion D8.  →  `VERDICT-PROVENANCE OK`
 *
 *   > **D8.** *"Every numeric claim on the verdict carries a provenance chip,
 *   > derived by sweeping the rendered surface."*
 *
 * MEASURES: 'render'. The suite mounts a fully populated Check Verdict and walks
 * the tree for accessibilityValue texts that contain a digit. Each such claim
 * must have a shared ProvenanceChip in its parent group. A grep of the source
 * for the component name would prove the import. The named negative control is
 * rendering one bare number and watching this sweep fail.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['D8'];
export const SENTINEL = 'VERDICT-PROVENANCE OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckVerdictScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkVerdict.provenance.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'every accessibilityValue numeric claim has a ProvenanceChip in its parent group',
  'the sweep is over a fully populated verdict, not an empty mount',
  'the chips are the shared ProvenanceChip primitive, not local badge markup',
  'a runner-up without a delta is not a numeric claim',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness to measure D8 with' };
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
  if (!existsSync(join(root, SCREEN))) {
    return fail(SCREEN + ' does not exist — there is no Check Verdict surface for D8 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — D8 is measured by sweeping the rendered tree');
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
    SUITE + ' mounts ' + SCREEN + ' and walks the rendered tree:',
    '  · every accessibilityValue numeric claim has a shared ProvenanceChip in its parent group',
    '  · the population is the fully populated verdict; a runner-up with no delta is not a claim',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
