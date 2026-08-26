/**
 * GATE: verdict-fx-block — criterion D6.  →  `VERDICT-FX-BLOCK OK`
 *
 *   > **D6.** *"The FX block renders when the purchase is foreign, ending in the
 *   > link to the shared compare sheet."*
 *
 * MEASURES: 'render'. The suite mounts the screen with a `compareAbroad` quote
 * (the N3 engine) and asserts the painted rate, fee and estimated cost against
 * that object. A shekel mount omits the block. A grep of the source for "FX"
 * would prove the comment.
 *
 * The shared compare sheet itself is PHASE-3 (X1). This gate requires the
 * verdict's ending link, not a second implementation of the sheet.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['D6'];
export const SENTINEL = 'VERDICT-FX-BLOCK OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckVerdictScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkVerdict.fx.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'omits the FX block when the purchase is not foreign',
  'paints the compareAbroad quote: BOI rate, date, card fee and estimated ILS cost',
  'the estimated cost is the engine quote, not a surface recomputation of amount × rate',
  'the block ends in the compare-sheet link',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness to measure D6 with' };
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
    return fail(SCREEN + ' does not exist — there is no Check Verdict surface for D6 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — D6 is measured by rendering the FX block');
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
    SUITE + ' mounts ' + SCREEN + ' with compareAbroad output (the N3 engine):',
    '  · shekel omits the block; foreign paints rate, date, fee and estimated ILS from the quote',
    '  · the block ends in the compare-sheet link (the sheet itself is PHASE-3 / X1)',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
