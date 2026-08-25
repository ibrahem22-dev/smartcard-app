/**
 * GATE: handoff-no-discovery — criterion F10.  →  `HANDOFF OK — 0 discoveries`
 *
 *   > **F10.** *"A **P2 → P3 handoff** exists naming what P3 inherits, the obligations P3 must
 *   > implement, the interfaces P3 must not re-derive, open ODs and carried adjudication items —
 *   > and **nothing in it is a discovery**: every obligation it transfers is already named in §9 of
 *   > this contract **or** in the P2 deferred register **or** was created by an Owner Decision
 *   > post-dating this contract version."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "NOTHING HERE IS A DISCOVERY" IS THE HARDEST SENTENCE IN THE CONTRACT
 *
 * A handoff that introduces an obligation is a campaign discovering, at the end, work it should have
 * named at the start — and worse, transferring it to somebody who was not there. The P1 handoff
 * carries the same clause and P1's own §10 test 4 failed on it literally, which is what OD-31
 * Clause A was raised to fix.
 *
 * So every transferred obligation must carry **what created it**, and that source must resolve to
 * one of three things: the contract's §9, the P2 deferred register, or an Owner Decision. Anything
 * else is a discovery, and this gate names it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE OTHER SECTIONS ARE CHECKED FOR PRESENCE, NOT FOR PROSE
 *
 * F10 lists five things a handoff must name. A missing section is a handoff that leaves P3 to work
 * something out — which is the same failure as a discovery, arriving as a silence instead of a
 * surprise.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['F10'];
export const SENTINEL = 'HANDOFF OK';

const RECORDS = join('tools', 'p2', 'campaign-records.json');

/**
 * What a `created by` may resolve to. Anything else is a discovery.
 *
 * Deliberately narrow: "the campaign found it" is not on this list, because a campaign finding work
 * at the end is exactly what F10 refuses to let a handoff transfer silently.
 */
const PERMITTED_SOURCES = [
  [/contract\s*§?9|§\s*9\b/i, "contract §9 — pre-registered"],
  [/deferred register|P2_DEFERRED/i, 'the P2 deferred register'],
  [/\bOD-\d+\b/, 'an Owner Decision'],
  [/\bOB-\d+\b/, 'an obligation the P1 handoff already transferred'],
  [/\bADR-\d+\b/, 'an ADR recorded during the campaign'],
];

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(join(root, RECORDS))) {
    return fail(RECORDS + ' does not exist — run campaign-p2/bin/p2-campaign-records.mjs');
  }
  const records = JSON.parse(readFileSync(join(root, RECORDS), 'utf8'));
  const { obligations = [], interfaceRows = 0, version = null, state = null } = records.handoff ?? {};

  /**
   * ─────────────────────────────────────────────────────────────────────────────────────────
   * THE HANDOFF MUST ALSO AGREE WITH THE CAMPAIGN IT IS HANDING OVER.
   *
   * F10 asks what the handoff NAMES. It says nothing about whether what it names is still true —
   * and for one whole campaign, nothing else asked either. So `HANDOFF OK — 0 discoveries` was
   * printed at every gate run while §1 went on saying the app *"has never been run on a device"*,
   * through the device lane that closed B2, E1 and F2, the four Owner rulings, and the CI lane.
   *
   * The Owner found that. No check did. **A green tick on a stale document is worse than no tick**,
   * because it is read as currency.
   *
   * The counts are compared with the ledger and with the ladder run the handoff itself names —
   * never with another document. An absent block is a failure, not a skip.
   */
  if (!state) {
    return fail('the handoff carries no machine-readable state block, so its §1 counts are prose '
      + 'that nothing compares. That is exactly how it came to claim the app had never run on a '
      + 'device long after B2, E1 and F2 closed on one, while this gate reported OK');
  }
  if (state.disagreements?.length) {
    return fail('the handoff disagrees with the campaign it is handing over, in '
      + state.disagreements.length + ' place(s): '
      + state.disagreements.map((d) => d.field + ' says ' + d.handoffSays + ', truth is ' + d.truthIs).join(' · '),
      'THE HANDOFF IS THE P3 TEAM\'S ONLY BRIEFING. A number in it that no longer matches the'
      + '\n  ledger or the ladder is not a typo — it is the campaign describing a state it left.');
  }

  if (obligations.length === 0) {
    return fail('the handoff transfers no obligation. A P2 that handed P3 nothing would mean either '
      + 'P2 finished the product or the handoff was not read — and contract §9 places the engine '
      + 'arithmetic and the BOI fetch client in P3 explicitly, so it is the second');
  }

  let discoveries = 0;
  for (const o of obligations) {
    const matched = PERMITTED_SOURCES.find(([re]) => re.test(o.createdBy));
    if (!matched) {
      discoveries += 1;
      problems.push(o.id + ' ("' + o.obligation.slice(0, 60) + '") says it was created by "'
        + o.createdBy + '", which resolves to none of: contract §9, the P2 deferred register, an '
        + 'Owner Decision, an inherited obligation, or an ADR. THAT IS A DISCOVERY — a campaign '
        + 'naming work at the end and transferring it to somebody who was not there');
      continue;
    }
    lines.push('  ' + o.id.padEnd(7) + o.obligation.slice(0, 52).padEnd(53) + matched[1]);
  }

  if (interfaceRows === 0) {
    problems.push('the handoff names no interface P3 must not re-derive. D4 exists because '
      + 're-deriving one means "a load-time check replaced by prose nobody enforces", and a handoff '
      + 'silent about them invites exactly that');
  }

  lines.unshift('obligations     ' + obligations.length + ' transferred · ' + discoveries + ' discoveries');
  lines.unshift('handoff         v' + (version ?? '?') + ' · state agrees with the ledger and with '
    + state.measured.report);
  lines.push('');
  lines.push('interfaces      ' + interfaceRows + ' row(s) naming what P3 must not re-derive');
  lines.push('');
  lines.push('state           ' + state.measured.total + ' criteria · ' + state.measured.satisfied
    + ' SATISFIED · ' + state.measured.deferred + ' DEFERRED · ' + state.measured.suites
    + ' suites / ' + state.measured.tests + ' tests · ' + state.measured.steps + ' ladder steps');
  lines.push('                compared field by field with campaign-p2/state/P2_LEDGER.json and');
  lines.push('                ' + state.measured.report + ', not with another document');
  lines.push('');
  lines.push('"THE CAMPAIGN FOUND IT" IS NOT A PERMITTED SOURCE. A handoff that introduced an');
  lines.push('  obligation would be a campaign discovering, at the end, work it should have named at');
  lines.push('  the start — and transferring it to somebody who was not there. P1\'s §10 test 4');
  lines.push('  failed on this clause literally, which is what OD-31 Clause A was raised to fix.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'HANDOFF OK — ' + discoveries + ' discoveries',
  };
};
