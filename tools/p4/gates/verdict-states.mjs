/**
 * GATE: verdict-states — criterion D1.  →  `VERDICT-STATES OK`
 *
 *   > **D1.** *"Exactly four verdict states render, each carrying an icon and a word as well
 *   > as a colour."*  (spec §9; colour is never the only carrier)
 *
 * MEASURES: 'render'. The suite mounts the screen with engine-produced results (the B1 seam)
 * and asserts icon + word + colour role on the rendered pill. A grep of the source for the
 * four English names would prove the file mentions them.
 *
 * The suite is named `*.render.test.tsx` so it also runs in the app's default render project.
 * This gate still requires each case BY NAME.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['D1'];
export const SENTINEL = 'VERDICT-STATES OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckVerdictScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkVerdict.states.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  'produces all four engine states for this suite, so every pill is a real verdict',
  'renders good_to_go with an icon, a word and the positive colour role',
  'renders caution with an icon, a word and the advisory colour role',
  'renders dont_buy_now with an icon, a word and the danger colour role',
  'renders wait_until_billing_passes with an icon, a word and the slate colour role',
  'colour is never the only carrier — the label always carries the word and the icon',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness to measure D1 with' };
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
    return fail(SCREEN + ' does not exist — there is no Check Verdict surface for D1 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — D1 is measured by rendering the four states');
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
    SUITE + ' mounts ' + SCREEN + ' with engine-produced results (the B1 seam):',
    '  · four states, each icon + word + colour role from the token module',
    '  · accessibility label carries the word, so colour is never the only carrier',
    '  · wait uses slate/neutral, matching spec §9 and A8',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
