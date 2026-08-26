/**
 * GATE: verdict-layout — criterion D3.  →  `VERDICT-LAYOUT OK`
 *
 *   > **D3.** *"The layout renders in the order spec §9 fixes, top to bottom."*
 *
 * MEASURES: 'render'. The suite mounts the screen and reads testIDs in document
 * order. A grep of the source for "context line" would prove the comment.
 *
 * PHASE-2 builds the remaining §9 blocks in later packages. This gate requires
 * the sections that exist now (pill, context, Financial Impact) and asserts that
 * any later block that is already present still sits after the panel.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['D3'];
export const SENTINEL = 'VERDICT-LAYOUT OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckVerdictScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkVerdict.layout.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'renders pill, context line and Financial Impact in spec order, top to bottom',
  'the context line paints the user-entered amount, not an engine recomputation',
  'later §9 blocks, if present, still follow the spec after Financial Impact',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness to measure D3 with' };
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
    return fail(SCREEN + ' does not exist — there is no Check Verdict surface for D3 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — D3 is measured by rendering layout order');
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
    SUITE + ' mounts ' + SCREEN + ' and reads testIDs in document order:',
    '  · pill, then context line (user-entered amount · category · plan), then Financial Impact',
    '  · later §9 blocks, if already present, remain below the panel',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
