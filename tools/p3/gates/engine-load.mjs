/**
 * GATE: engine-load — criterion N4.  →  `ENGINE-LOAD OK`
 *
 * Watches the four named N4 behaviours by executable test name, the canonical threshold imports,
 * per-figure provenance, reason trace, and membership in the centrally-derived MVP population.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N4'];
export const SENTINEL = 'ENGINE-LOAD OK';

const MODULE = 'src/engines/load.ts';
const SUITE = 'src/engines/__tests__/load.test.ts';
const MVP_MODULES = 'src/engines/mvpEngines.ts';

const REQUIRED_CASES = [
  'divides current plus prospective monthly obligations by income',
  'classifies the exact 25, 35 and 50 percent threshold boundaries',
  'computes available limit as limit minus active holds minus logged purchases',
  'a prospective limit hold is the total hold and reports whether it fits',
  'paid early removes the monthly obligation and frees its linked-card hold immediately',
  'early payoff is recalculated before a prospective obligation and hold',
  'every numeric output carries canonical provenance and the result carries a reason trace',
  'refuses invalid income, ids, links, holds, UNKNOWN values and malformed thresholds',
];

export const run = async ({ root }) => {
  const modulePath = join(root, MODULE);
  if (!existsSync(modulePath)) return fail(MODULE + ' does not exist — there is no load engine');

  const src = readFileSync(modulePath, 'utf8');
  for (const [needle, what] of [
    ['INSTALLMENT_WARNING_RATIO_OF_INCOME', 'canonical warning threshold'],
    ['INSTALLMENT_STRONG_WARNING_RATIO_OF_INCOME', 'canonical strong-warning threshold'],
    ['INSTALLMENT_BLOCKED_RATIO_OF_INCOME', 'canonical blocked threshold'],
    ['monthlyObligationsIls:', 'monthly-obligations output'],
    ['ratioOfIncome:', 'obligations-over-income output'],
    ['activeInstallmentHoldsIls:', 'active limit-holds output'],
    ['availableAfterChangesIls:', 'available-limit output'],
    ['releasedByEarlyPayoffIls:', 'early-payoff release output'],
    ['ProvenancedNumber', 'per-figure provenance wrapper'],
    ["trace('load'", 'reason trace'],
  ]) {
    if (!src.includes(needle)) return fail(MODULE + ' lost its ' + what + ' (' + needle + ')');
  }

  const exportedComputations = [...src.matchAll(/export function\s+(\w+)/g)]
    .map((match) => match[1]);
  if (exportedComputations.length !== 1 || exportedComputations[0] !== 'evaluateFinancialLoad') {
    return fail(MODULE + ' must expose one computation, evaluateFinancialLoad; found '
      + (exportedComputations.join(', ') || 'none'));
  }

  const population = readFileSync(join(root, MVP_MODULES), 'utf8');
  const list = population.match(/MVP_ENGINE_MODULES\s*=\s*\[([^\]]*)\]/)?.[1] ?? '';
  if (!list.includes("'load.ts'")) {
    return fail(MVP_MODULES + ' does not list load.ts — T1/T2 would inspect the wrong population');
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    MODULE + ': obligations / income and exact 25%/35%/50% boundaries are exercised;',
    'available limit subtracts active holds plus cycle purchases; prospective holds are tested;',
    'Paid early removes monthly load and releases the linked-card hold before recalculation',
    summary,
  ].join('\n'));
};
