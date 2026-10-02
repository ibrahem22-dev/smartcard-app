/**
 * GATE: impact-and-freshness — criterion D7.  →  `IMPACT-AND-FRESHNESS OK`
 *
 *   > **D7.** *"The impact strip shows available limit after the purchase, read
 *   > from the load engine's cardLimits rather than recomputed, and the
 *   > freshness footer carries its informational-only disclaimer."*
 *
 * MEASURES: 'render'. The suite mounts the screen with `evaluateFinancialLoad`
 * output (N4) and asserts the painted strip against `availableAfterChangesIls`.
 * Subtracting limit − holds − logged on the surface is the defect this gate
 * exists to catch (that subtraction is the BEFORE figure, not after the purchase).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['D7'];
export const SENTINEL = 'IMPACT-AND-FRESHNESS OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckVerdictScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkVerdict.impact.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'paints availableAfterChangesIls from the load engine, not a surface subtraction',
  'the freshness footer carries the informational-only disclaimer',
  'omitting the strip omits the available-limit row rather than inventing one',
  'the claimed available limit is the engine field availableAfterChangesIls',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness to measure D7 with' };
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
    return fail(SCREEN + ' does not exist — there is no Check Verdict surface for D7 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — D7 is measured by rendering the impact strip');
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
    SUITE + ' mounts ' + SCREEN + ' with evaluateFinancialLoad output (the N4 engine):',
    '  · strip paints availableAfterChangesIls; a limit−holds−logged subtraction is the BEFORE figure',
    '  · freshness footer carries the informational-only disclaimer; omitting the strip invents nothing',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
