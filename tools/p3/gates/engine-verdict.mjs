/**
 * GATE: engine-verdict — criterion N2.  →  `ENGINE-VERDICT OK`
 *
 * Watches all four states, the exact safe/hard boundaries, risk precedence, and the architectural
 * rule: pill state plus Financial Impact leave one engine call and the panel reuses its figures.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N2'];
export const SENTINEL = 'ENGINE-VERDICT OK';

const MODULE = 'src/engines/verdict.ts';
const SUITE = 'src/engines/__tests__/verdict.test.ts';
const MVP_MODULES = 'src/engines/mvpEngines.ts';

const REQUIRED_CASES = [
  'returns good to go at or below the safe threshold with no risk flags',
  'returns caution above the safe threshold through the hard threshold',
  'returns dont buy now only above the hard threshold from load alone',
  'a soft risk flag returns caution even when load is safe',
  'a hard risk flag returns dont buy now and outranks billing relief',
  'returns wait until billing passes with the date when that event makes load safe',
  'pill verdict and Financial Impact are returned by one computation with shared figures',
  'every numeric output carries canonical provenance and the result carries a reason trace',
];

export const run = async ({ root }) => {
  const modulePath = join(root, MODULE);
  if (!existsSync(modulePath)) return fail(MODULE + ' does not exist — there is no verdict engine');

  const src = readFileSync(modulePath, 'utf8');
  for (const [needle, what] of [
    ["'good_to_go'", 'Good to go state'],
    ["'caution'", 'Caution state'],
    ["'dont_buy_now'", "Don't buy now state"],
    ["'wait_until_billing_passes'", 'Wait until billing passes state'],
    ['financialImpact:', 'Financial Impact output'],
    ['thresholdMath:', 'threshold-math output'],
    ['bullets:', 'impact-bullet output'],
    ['ProvenancedNumber', 'per-figure provenance wrapper'],
    ["trace('verdict'", 'reason trace'],
  ]) {
    if (!src.includes(needle)) return fail(MODULE + ' lost its ' + what + ' (' + needle + ')');
  }

  // A second exported pill computation is the exact P0 regression N2 exists to prevent.
  const exportedComputations = [...src.matchAll(/export function\s+(\w+)/g)].map((match) => match[1]);
  if (exportedComputations.length !== 1 || exportedComputations[0] !== 'evaluatePurchaseVerdict') {
    return fail(MODULE + ' must expose one computation, evaluatePurchaseVerdict; found '
      + (exportedComputations.join(', ') || 'none'));
  }
  if (/function\s+(?:compute|calculate|derive|get)\w*(?:Pill|Verdict)/i.test(src)) {
    return fail(MODULE + ' contains a second pill/verdict calculation path — N2 requires one');
  }

  const population = readFileSync(join(root, MVP_MODULES), 'utf8');
  const list = population.match(/MVP_ENGINE_MODULES\s*=\s*\[([^\]]*)\]/)?.[1] ?? '';
  if (!list.includes("'verdict.ts'")) {
    return fail(MVP_MODULES + ' does not list verdict.ts — T1/T2 would inspect the wrong population');
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    MODULE + ': all four states and exact 35%/50% boundaries are exercised;',
    'hard/soft risk precedence and safe-after-billing wait state are exercised;',
    'one exported computation returns pill state + Financial Impact with shared provenanced figures',
    summary,
  ].join('\n'));
};
