/**
 * GATE: engine-risk — criterion N5.  →  `ENGINE-RISK OK`
 *
 * Watches the named N5 behaviours by executable test name, the single evaluator surface,
 * per-figure provenance, reason trace and membership in the centrally-derived MVP population.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N5'];
export const SENTINEL = 'ENGINE-RISK OK';

const MODULE = 'src/engines/risk.ts';
const SUITE = 'src/engines/__tests__/risk.test.ts';
const MVP_MODULES = 'src/engines/mvpEngines.ts';

const REQUIRED_CASES = [
  'groups same-date billing events into a deterministic billing cluster',
  'applies salary on its stated date and reports pressure through the next salary',
  'assigns per-day risk from the projected balance, danger floor and clustering',
  'returns unknown daily risk instead of inventing an omitted optional balance',
  'returns wait until billing only when ending obligations make projected load safe',
  'distinguishes no wait needed from billing that cannot make load safe',
  'treats an entered zero balance as data and supports leap-day UTC projections',
  'projects an entered negative balance as critical rather than rejecting overdraft',
  'every numeric output carries canonical provenance and the result carries a reason trace',
  'refuses invalid ranges, dates, duplicates, invalid amounts, UNKNOWN values and zero income',
];

export const run = async ({ root }) => {
  const modulePath = join(root, MODULE);
  if (!existsSync(modulePath)) return fail(MODULE + ' does not exist — there is no risk engine');

  const src = readFileSync(modulePath, 'utf8');
  for (const [needle, what] of [
    ['billingClusters:', 'billing-cluster output'],
    ['salaryInflowIls:', 'dated salary output'],
    ['riskLevel:', 'per-day risk output'],
    ['PressureSummary', 'pressure summary'],
    ["decision: 'WAIT_UNTIL_BILLING'", 'wait-until-billing determination'],
    ["riskLevel = 'unknown'", 'optional-balance honesty path'],
    ['ProvenancedNumber', 'per-figure provenance wrapper'],
    ["trace('risk'", 'reason trace'],
  ]) {
    if (!src.includes(needle)) return fail(MODULE + ' lost its ' + what + ' (' + needle + ')');
  }

  const exportedComputations = [...src.matchAll(/export function\s+(\w+)/g)]
    .map((match) => match[1]);
  if (exportedComputations.length !== 1 || exportedComputations[0] !== 'evaluateRiskPlanning') {
    return fail(MODULE + ' must expose one computation, evaluateRiskPlanning; found '
      + (exportedComputations.join(', ') || 'none'));
  }
  // Determinism: the engine may construct fixed dates from caller strings, but reading the CLOCK
  // would make two identical calls disagree — the one-number property N7 polices.
  if (/Date\.now\s*\(|new Date\s*\(\s*\)|Date\s*\(\s*\)/.test(src)) {
    return fail(MODULE + ' reads the clock — N5 is deterministic; every date arrives from the caller');
  }

  const population = readFileSync(join(root, MVP_MODULES), 'utf8');
  const list = population.match(/MVP_ENGINE_MODULES\s*=\s*\[([^\]]*)\]/)?.[1] ?? '';
  if (!list.includes("'risk.ts'")) {
    return fail(MVP_MODULES + ' does not list risk.ts — T1/T2 would inspect the wrong population');
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    MODULE + ': same-date billing clustering and exact salary timing are exercised;',
    'per-day risk degrades to unknown without a balance and pressure summaries retain known facts;',
    'wait-until-billing requires a named event that moves projected load under the safe threshold',
    summary,
  ].join('\n'));
};
