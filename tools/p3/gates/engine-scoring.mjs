/**
 * GATE: engine-scoring — criterion N1.  →  `ENGINE-SCORING OK`
 *
 * Watches the contract's four named outputs/inputs by executable test name and checks that the
 * scoring module is part of the centrally-derived MVP engine population.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N1'];
export const SENTINEL = 'ENGINE-SCORING OK';

const MODULE = 'src/engines/scoring.ts';
const SUITE = 'src/engines/__tests__/scoring.test.ts';
const MVP_MODULES = 'src/engines/mvpEngines.ts';

const REQUIRED_CASES = [
  'ranks available cards by effective cost and returns score, trace and deltas',
  'benefits are optional: omission and an empty list produce identical ranking',
  'an optional matched benefit changes effective cost without changing the input shape',
  'unavailable cards never rank and receive no fabricated numeric output',
  'an unmodified cost keeps the provenance it arrived with — a derivation alone earns ESTIMATE',
  'when the comparison suppresses deltas, scored deltas are omitted entirely',
  'a card with no resolved cost lands in unknownCostCards, never ranked',
];

export const run = async ({ root }) => {
  const modulePath = join(root, MODULE);
  if (!existsSync(modulePath)) return fail(MODULE + ' does not exist — there is no scoring engine');

  const src = readFileSync(modulePath, 'utf8');
  for (const [needle, what] of [
    ['ranked:', 'ranked-card output'],
    ['score:', 'score output'],
    ['deltaFromBestIls', 'delta output'],
    ['trace:', 'reason-trace output'],
    ['benefits?:', 'optional benefits input'],
    ['deltasSuppressed', 'the D1 suppression passthrough'],
    ['unknownCostCards:', 'the unknown-cost lane'],
    ['ProvenancedNumber', 'per-figure provenance wrapper'],
  ]) {
    if (!src.includes(needle)) return fail(MODULE + ' lost its ' + what + ' (' + needle + ')');
  }
  // The engine consumes resolved ILS costs; it never touches a rate, so it must never divide one.
  if (/rateIlsPerQuoteUnit\s*\//.test(src)) {
    return fail(MODULE + ' divides a rate. The divide lives in currency.ts perOne and nowhere '
      + 'else (OD-23b) — scoring ranks resolved costs');
  }

  const population = readFileSync(join(root, MVP_MODULES), 'utf8');
  const list = population.match(/MVP_ENGINE_MODULES\s*=\s*\[([^\]]*)\]/)?.[1] ?? '';
  if (!list.includes("'scoring.ts'")) {
    return fail(MVP_MODULES + ' does not list scoring.ts — T1/T2 would inspect the wrong population');
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    MODULE + ': ranks available cards; emits provenanced score, effective cost and delta;',
    'deltas obey the D1 suppression passthrough; unknown-cost cards named, never ranked;',
    'benefits remain optional; no rate arithmetic',
    summary,
  ].join('\n'));
};
