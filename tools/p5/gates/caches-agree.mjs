/**
 * GATE: caches-agree — criterion A5.  →  `CACHES-AGREE OK`
 *
 *   > **A5.** *"Every derived cache value equals a fresh engine call for the same inputs, and a cache
 *   > that cannot be shown current is invalidated rather than rendered."*
 *
 * MEASURES: 'agreement'. Contract §2 rule 10 requires the compared values to be **rendered**, so the
 * property mounts the real components and reads what they painted; that cannot happen in a `.mjs`
 * gate, so the property lives in the suite named below and this gate runs it by named case.
 *
 * `AGREEMENT_PROPERTY` is what `campaign-p5/bin/p5-agreement.mjs --audit` follows: the auditor reads
 * THAT file and looks for the four structural signals. Inlining a copy of the property here to
 * satisfy the audit would give the property two homes. See campaign D-008.
 *
 * IT IS RED AT PHASE-1 AND THAT IS THE DESIGN. `P5_EXECUTION_PLAN.md` §1.1: *"a property that has
 * never been red is a property nobody has watched."*
 *
 * NEGATIVE CONTROL (contract §6 A5): stale one cache entry behind an engine input change and watch the gate refuse to render it.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';
import { createRequire } from 'node:module';

/** The `unit` project, for the mechanism suite. The property itself is claimed by `agreement`. */
const unitConfigFor = (root, suite) => {
  const configPath = join(root, 'jest.config.cjs');
  if (!existsSync(configPath)) return { error: 'jest.config.cjs does not exist' };
  const config = createRequire(import.meta.url)(configPath);
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const unit = projects.find((p) => p && p.displayName === 'unit');
  if (!unit) return { error: 'jest.config.cjs has no "unit" project' };
  return { config: { ...unit, rootDir: root, testMatch: ['**/' + suite] } };
};
import { agreementConfigFor } from '../lib/agreementProject.mjs';

export const CRITERIA = ['A5'];
export const SENTINEL = 'CACHES-AGREE OK';
export const MEASURES = 'agreement';
export const AGREEMENT_PROPERTY = 'src/surfaces/__tests__/cachesAgree.agreement.render.test.tsx';

/**
 * A5's SECOND CLAUSE HAS ITS OWN SUITE, AND THIS GATE DID NOT REQUIRE IT.
 *
 * A5 says two things: every derived cache value equals a fresh engine call, AND a cache that
 * cannot be shown current is invalidated rather than rendered.
 *
 * The agreement property only ever exercises the first. It populates each cache from a fresh call
 * and reads it back with the SAME context, so the fingerprint always matches by construction. I
 * disabled the staleness check in derivedCache.ts entirely — deleted the invalidation path — and
 * this gate stayed green. The contract's own control for A5 is "stale one cache entry behind an
 * engine input change and watch the gate refuse to render it", and it could not be observed here.
 *
 * The mechanism IS tested, in the unit suite below, whose cases are exactly the missing half. The
 * gate simply never asked for them. So it asks now: a criterion with two clauses needs evidence
 * for both, and a green built on half of one is the shape §2 rule 7 exists to refuse.
 */
const MECHANISM_SUITE = 'src/surfaces/__tests__/derivedCache.test.ts';
const MECHANISM_CASES = [
  'returns a cached value when the inputs have not changed',
  'returns nothing when an input has changed',
  'is in-memory only and reaches no store',
];

const REQUIRED_CASES = [
  'every cache the criterion names has a reader',
  'each cached value equals what the engine says now, for the same inputs, and no cache is empty',
];

export const run = async ({ root }) => {
  if (!existsSync(join(root, AGREEMENT_PROPERTY))) {
    return fail(AGREEMENT_PROPERTY + ' does not exist — A5 has no property');
  }
  /* One shared resolver, which also asserts this property is claimed by the `agreement` jest
     project and NOT by `render` — a property claimed by neither would be silently absent, and
     five green gates over a property nobody ran is the worst outcome available here. */
  if (!existsSync(join(root, MECHANISM_SUITE))) {
    return fail(MECHANISM_SUITE + ' does not exist — A5\'s invalidation clause would have no evidence');
  }

  const { config, claim, error } = agreementConfigFor(root, AGREEMENT_PROPERTY);
  if (error) return fail(error);

  /* The invalidation half first, because it is the half that was silently unmeasured. */
  const unitCfg = unitConfigFor(root, MECHANISM_SUITE);
  if (unitCfg.error) return fail(unitCfg.error);
  const mech = requireJestCases(root, MECHANISM_SUITE, MECHANISM_CASES, [
    '--config', JSON.stringify(unitCfg.config),
  ]);
  if (mech.problems.length) return fail(mech.problems.join(' · '), mech.summary ?? undefined);

  const { problems, summary, output } = requireJestCases(root, AGREEMENT_PROPERTY, REQUIRED_CASES, [
    '--config', JSON.stringify(config),
  ]);
  if (problems.length) {
    const why = String(output ?? '').split('\n').filter((l) => /painted nothing|painted |no reader yet|compared with nothing|readable yet/.test(l)).slice(0, 6);
    return fail(problems.join(' · '), why.length ? why.join('\n') : (summary ?? undefined));
  }
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }
  return ok(SENTINEL, [
    AGREEMENT_PROPERTY + ' compares, in ONE run per context:',
    '  · every cached value against a FRESH engine call for the same inputs — not against the',
    '    value that was cached, which is the same number by construction',
    '  · and a cache with no engine field to be re-derived from, which cannot be shown current',
    'over the derived population, with no expected number anywhere in the file.',
    'AND the invalidation clause, which this gate did not used to require: ' + MECHANISM_SUITE
      + ' proves a changed input yields NOTHING rather than the old value, and that the cache',
    '  reaches no store. Without those, deleting the staleness check left this gate green — a',
    '  criterion with two clauses needs evidence for both.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + claim + ' · ' + summary,
  ].join('\n'));
};
