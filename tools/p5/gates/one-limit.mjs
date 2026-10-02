/**
 * GATE: one-limit — criterion A4.  →  `ONE-LIMIT OK`
 *
 *   > **A4.** *"Wallet's limit bar, Card DNA §D's utilization and the Verdict's impact strip all
 *   > read `cardLimits` from the load engine, and Paid early moves all three in the same run."*
 *
 * MEASURES: 'agreement'. Contract §2 rule 10 requires the compared values to be **rendered**, so the
 * property mounts the real components and reads what they painted; that cannot happen in a `.mjs`
 * gate, so the property lives in the suite named below and this gate runs it by named case.
 *
 * `AGREEMENT_PROPERTY` is what `campaign-p5/bin/p5-agreement.mjs --audit` follows: the auditor reads
 * THAT file and looks for the four structural signals — an engine result obtained, two surfaces in
 * one assertion, iteration over a derived population, and no numeric literal in an expectation.
 * Auditing this file instead would audit a file with no property in it, and inlining a copy of the
 * property here to satisfy the audit would give the property two homes. See campaign D-008.
 *
 * IT IS RED AT PHASE-1 AND THAT IS THE DESIGN. `P5_EXECUTION_PLAN.md` §1.1: *"PHASE-1 delivers A1
 * through A5 as failing properties with nothing to satisfy them yet… a property that has never been
 * red is a property nobody has watched."* Wallet's bar arrives in PHASE-4 and Card DNA §D in
 * PHASE-3; until then the property fails naming them, rather than quietly comparing the one built
 * surface with itself.
 *
 * NEGATIVE CONTROL (contract §6 A4): recompute the limit on one surface from limit minus holds and
 * watch this property fail.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';
import { agreementConfigFor } from '../lib/agreementProject.mjs';

export const CRITERIA = ['A4'];
export const SENTINEL = 'ONE-LIMIT OK';
export const MEASURES = 'agreement';
export const AGREEMENT_PROPERTY = 'src/surfaces/__tests__/oneLimit.agreement.render.test.tsx';

const REQUIRED_CASES = [
  'every participant the criterion names has a reader',
  'Wallet, Card DNA and the Verdict all render one cardLimits position, over the derived population',
  'Paid early moves Wallet, Card DNA and the Verdict together, by the engine’s own released amount',
];

export const run = async ({ root }) => {
  if (!existsSync(join(root, AGREEMENT_PROPERTY))) {
    return fail(AGREEMENT_PROPERTY + ' does not exist — A4 has no property');
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
    /* The property's own message is the useful part of a red line, so it is carried up rather than
       replaced by "the suite failed". */
    const why = String(output ?? '').split('\n').filter((l) => /painted nothing|painted \d|moved by|no reader yet/.test(l)).slice(0, 6);
    return fail(problems.join(' · '), why.length ? why.join('\n') : (summary ?? undefined));
  }
  if (!/Tests:\s+\d+ passed/.test(String(summary ?? ''))) {
    return fail('the suite reported no passing tests: ' + String(summary));
  }
  return ok(SENTINEL, [
    AGREEMENT_PROPERTY + ' compares, in ONE run per context:',
    '  · the load engine’s cardLimits position for the card',
    '  · Wallet’s bar against availableAfterEarlyPayoffIls — limit minus ACTIVE holds minus logged',
    '  · Card DNA §D and the Verdict’s impact strip against availableAfterChangesIls',
    '  · and all three moving by releasedByEarlyPayoffIls when a commitment is Paid early',
    'over the derived population, with no expected number anywhere in the file.',
    REQUIRED_CASES.length + ' case(s) required BY NAME · ' + claim + ' · ' + summary,
  ].join('\n'));
};
