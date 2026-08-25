/**
 * GATE: full-universe — criterion S3.  →  `FULL-UNIVERSE OK`
 *
 *   > *"Scoring runs the full 378-product universe, with the population derived from the
 *   > shipped catalog rather than declared."*  (Contract §2 rule 4: derive populations,
 *   > never hand-list them.)
 *
 * Watches the scenario-suite case that scores every current product through FX + scoring.
 * The population inside that case is derived two independent ways — raw rows filtered by the
 * adapter's own current-product verdict, and CardsAdapter.countCurrentProducts — and must
 * agree; every product is then accounted for as ranked or explicitly unknown-cost. The gate
 * refuses a suite that stops deriving or stops covering the universe case.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['S3'];
export const SENTINEL = 'FULL-UNIVERSE OK';

const SUITE = 'src/engines/__tests__/p3-scenarios.test.ts';

const REQUIRED_CASES = [
  'scores the full current-product universe through FX + scoring',
];

export const run = async ({ root }) => {
  const p = join(root, SUITE);
  if (!existsSync(p)) return fail(SUITE + ' does not exist — there is no scenario battery');
  const src = readFileSync(p, 'utf8');

  for (const [needle, what] of [
    ['countsAsCurrentProduct', 'the adapter-derived population filter'],
    ['countCurrentProducts()', 'the second, independent derivation of the same population'],
    ['unknownCostCards', 'full-universe ACCOUNTING - unknown legs named, never dropped'],
  ]) {
    if (!src.includes(needle)) {
      return fail(SUITE + ' lost ' + what + ' (' + needle + ') — a universe asserted by '
        + 'declaration rather than derivation is not the universe');
    }
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    SUITE + ': every current product scored through compareAbroad + scoreCards;',
    'population derived from the shipped catalog and cross-checked against countCurrentProducts;',
    'every product accounted for - ranked, or named in unknownCostCards',
    summary,
  ].join('\n'));
};
