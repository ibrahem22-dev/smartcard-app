/**
 * GATE: income-anchor — criterion O5.  →  `INCOME-ANCHOR OK`
 *
 * Income and payday round-trip the vault parser and are consumed by
 * evaluatePurchaseVerdict as the load-ratio anchor. Skipped income does not
 * become a fabricated zero.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['O5'];
export const SENTINEL = 'INCOME-ANCHOR OK';
export const MEASURES = 'artifact';

const MAPPER = 'src/screens/check/incomeAnchor.ts';
const TYPES = 'src/types/user.types.ts';
const PARSE = 'src/store/userProfileParsing.ts';
const SUITE = 'src/screens/check/__tests__/incomeAnchor.test.ts';
const JEST_CONFIG = 'jest.config.cjs';

const REQUIRED_CASES = [
  'a stored income+payday profile round-trips and becomes engine context',
  'skipped income does not invent a zero for the engine',
  'the verdict engine consumes the vault income as the load-ratio anchor',
  'payday chips map to the next ISO date the engine receives',
];

const unitConfigFor = (root) => {
  const configPath = join(root, JEST_CONFIG);
  if (!existsSync(configPath)) return { error: JEST_CONFIG + ' does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const unit = projects.find((p) => p && p.displayName === 'unit');
  if (!unit) return { error: JEST_CONFIG + ' has no "unit" project' };
  return {
    config: {
      ...unit,
      rootDir: root,
      testMatch: ['**/' + SUITE],
    },
  };
};

export const run = async ({ root }) => {
  if (REQUIRED_CASES.length === 0) {
    return fail('this gate requires no cases — a check over zero items is not a check (§2 rule 5)');
  }
  for (const rel of [MAPPER, TYPES, PARSE, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist');
  }

  const { config, error } = unitConfigFor(root);
  if (error) return fail(error);

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }
  return ok(SENTINEL, [
    SUITE + ' proves O5: vault parse → mapper → evaluatePurchaseVerdict:',
    '  · income and payday round-trip; nextPayday is an ISO date from the chip',
    '  · skipped income returns no context — never a fabricated zero',
    '  · halving vault income doubles the engine projected load ratio',
    'all ' + REQUIRED_CASES.length + ' cases required BY NAME · ' + summary,
  ].join('\n'));
};
