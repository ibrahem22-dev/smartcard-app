/**
 * GATE: one-scoring — criterion A1.  →  `ONE-SCORING OK`
 *
 *   > **A1.** *"Wallet's Best-For chips, Card DNA §C's chips and the recommendation Check would produce
 *   > for the same context are the same scoring call, measured in one run over generated contexts."*
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
 * NEGATIVE CONTROL (contract §6 A1): derive a Best-For chip from a second ranking path and watch the property fail.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';
import { agreementConfigFor } from '../lib/agreementProject.mjs';

export const CRITERIA = ['A1'];
export const SENTINEL = 'ONE-SCORING OK';
export const MEASURES = 'agreement';
export const AGREEMENT_PROPERTY = 'src/surfaces/__tests__/oneScoring.agreement.render.test.tsx';

const REQUIRED_CASES = [
  'every participant the criterion names has a reader',
  'Wallet, Card DNA §C and Check paint one ranking, in the engine’s order, over the derived population',
  'a card the engine could not price is never painted as a winner',
];

export const run = async ({ root }) => {
  if (!existsSync(join(root, AGREEMENT_PROPERTY))) {
    return fail(AGREEMENT_PROPERTY + ' does not exist — A1 has no property');
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
    '  · the scoring engine’s ranked ORDER of card ids, not the chip labels — two surfaces',
    '    can print the same words from different orderings',
    '  · every surface naming the SAME winner, each painted sequence a prefix of that order',
    '  · Check naming ranked[1] as its runner-up, so the ORDER is exercised and not just first place',
    '  · and unknownCostCards or unavailableCards never painted by any surface',
    'over the derived population, with no expected number anywhere in the file.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + claim + ' · ' + summary,
  ].join('\n'));
};
