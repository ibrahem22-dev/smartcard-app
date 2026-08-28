/**
 * GATE: one-load — criterion A2.  →  `ONE-LOAD OK`
 *
 *   > **A2.** *"Home's load bar, Plan Commitments' sticky summary, Card DNA §D's utilization and the
 *   > Verdict's impact strip are four renders of one load-engine result for the same inputs,
 *   > measured in one run."*
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
 * NEGATIVE CONTROL (contract §6 A2): perturb one surface's threshold and watch the property fail.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';
import { agreementConfigFor } from '../lib/agreementProject.mjs';

export const CRITERIA = ['A2'];
export const SENTINEL = 'ONE-LOAD OK';
export const MEASURES = 'agreement';
export const AGREEMENT_PROPERTY = 'src/surfaces/__tests__/oneLoad.agreement.render.test.tsx';

const REQUIRED_CASES = [
  'every participant the criterion names has a reader',
  'Home, Plan Commitments, Card DNA and the Verdict render one load ratio over the derived population',
  'the BAND agrees too, which is where a >= and a > disagree and the ratio does not',
];

export const run = async ({ root }) => {
  if (!existsSync(join(root, AGREEMENT_PROPERTY))) {
    return fail(AGREEMENT_PROPERTY + ' does not exist — A2 has no property');
  }
  /* One shared resolver, which also asserts this property is claimed by the `agreement` jest
     project and NOT by `render` — a property claimed by neither would be silently absent, and
     five green gates over a property nobody ran is the worst outcome available here. */
  const { config, claim, error } = agreementConfigFor(root, AGREEMENT_PROPERTY);
  if (error) return fail(error);

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
    '  · the load engine’s current.ratioOfIncome and projected.ratioOfIncome',
    '  · Home, Plan Commitments and Card DNA §D against the current ratio',
    '  · the Verdict’s Financial Impact panel against the projected ratio',
    '  · and the BAND, which is where a >= and a > disagree and the ratio does not',
    'over the derived population, with no expected number anywhere in the file.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + claim + ' · ' + summary,
  ].join('\n'));
};
