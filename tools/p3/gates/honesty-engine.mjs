/**
 * GATE: honesty-engine — criterion T3.  →  `HONESTY-ENGINE OK`
 *
 *   > *"No unlabelled number reaches an engine output."*  (P2's L10 honesty rule, carried to
 *   > the engine surface.)
 *
 * Runs the honesty walk over every MVP engine executed on real inputs: every number in the
 * output tree must be provenance-wrapped or explicitly declared bare with a reason. The walk's
 * own negative control is part of the suite and is watched here by name.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['T3'];
export const SENTINEL = 'HONESTY-ENGINE OK';

const SUITE = 'src/engines/__tests__/honestyEngine.test.ts';
const MVP_MODULES = 'src/engines/mvpEngines.ts';

const REQUIRED_CASES = [
  'walks every MVP engine output and finds only wrapped or declared-bare numbers',
  'a bare undeclared number fails the honesty walk',
];

export const run = async ({ root }) => {
  const p = join(root, SUITE);
  if (!existsSync(p)) return fail(SUITE + ' does not exist — there is no honesty walk');

  const src = readFileSync(p, 'utf8');
  if (!/DECLARED_BARE\s*[:=]/.test(src)) {
    return fail(SUITE + ' declares no DECLARED_BARE registry - a walk without declarations '
      + 'is either vacuous or dishonest about what the engines emit');
  }
  for (const [needle, what] of [
    ['walkHonesty(output', 'executes the walk against live engine output'],
    ['violations.length).toBe(1)', 'the walk can fail'],
  ]) {
    if (!src.includes(needle)) return fail(SUITE + ' lost its ' + what);
  }

  // Every MVP module must be exercised by the walk, not a hand-picked subset.
  const suiteText = src;
  const population = readFileSync(join(root, MVP_MODULES), 'utf8')
    .match(/MVP_ENGINE_MODULES\s*=\s*\[([^\]]*)\]/)?.[1] ?? '';
  for (const mod of [...population.matchAll(/'([^']+)'/g)].map((m) => m[1])) {
    const stem = mod.replace(/\.ts$/, '');
    if (!suiteText.includes("from '../" + stem + "'")) {
      return fail(SUITE + ' never executes ' + mod + ' — the walk must cover every MVP engine');
    }
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    SUITE + ': every MVP engine executed; every output number wrapped or declared bare with',
    'a cited reason; the walk proven able to fail',
    summary,
  ].join('\n'));
};
