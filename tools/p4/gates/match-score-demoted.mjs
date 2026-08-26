/**
 * GATE: match-score-demoted — criterion D4.  →  `MATCH-SCORE-DEMOTED OK`
 *
 *   > **D4.** *"Match Score renders as a small secondary chip with an explainer and
 *   > never as a hero number."*
 *
 * MEASURES: 'render'. The suite mounts the screen with a `scoreCards` result (the
 * N1 engine) and asserts the painted chip against that object's score. A grep of
 * the source for "Match Score" would prove the comment.
 *
 * NEGATIVE CONTROL (contract §9 D4): promote Match Score to the hero slot and
 * watch this gate fail.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['D4'];
export const SENTINEL = 'MATCH-SCORE-DEMOTED OK';
export const MEASURES = 'render';

const SCREEN = 'src/screens/check/CheckVerdictScreen.tsx';
const SUITE = 'src/screens/check/__tests__/checkVerdict.matchScore.render.test.tsx';
const JEST_CONFIG = 'jest.config.cjs';
const RENDER_PROJECT = 'render';

const REQUIRED_CASES = [
  "Match Score paints the scoring engine's number, not a surface recomputation",
  'Match Score renders as a small secondary chip, never as the hero',
  'the chip carries a how-scores-work explainer',
  'the recommendation hero is Best for this purchase plus the card name, not the score',
  'omitting the recommendation omits Match Score rather than inventing one',
];

const renderConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) {
    return { error: JEST_CONFIG + ' does not exist — there is no rendering harness to measure D4 with' };
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
    return fail(SCREEN + ' does not exist — there is no Check Verdict surface for D4 to be about');
  }
  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — D4 is measured by rendering Match Score as a chip');
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
    SUITE + ' mounts ' + SCREEN + ' with scoreCards output (the N1 engine):',
    '  · Match Score chip paints that object\'s score; the hero is Best for this purchase',
    '  · chip is text-xs, not a heading size; explainer is present; omission does not invent a score',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
