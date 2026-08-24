/**
 * GATE: ob4-refusals — criterion C1.  →  `OB-4 OK — 10 of 10 refusals proven`
 *
 *   > **C1.** *"The device import client implements **all ten OB-4 refusals**, none softened, with
 *   > **one test per refusal named by the refusal**."*
 *
 * C3 — the three things P1 could not prove — is a DIFFERENT criterion with a different gate,
 * `ob4-unproven-three`. They share a suite and they are not the same claim: this one is about a
 * contract being implemented, that one is about gaps being closed or honestly named.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE POPULATION IS THE HANDOFF'S, NOT THIS FILE'S
 *
 * `tools/p2/ob4-refusals.json` is parsed out of `authority/P1_TO_P2_HANDOFF.md` by the pipeline and
 * compared back by `p2-ob4-refusals.mjs --check`. This gate reads that file and requires a passing
 * test for every obligation in it.
 *
 * So "all ten" is checkable rather than asserted. Add an eleventh obligation to the handoff and
 * this gate fails until an eleventh test exists. Delete one and the parity check fails first. A
 * list of ten typed into a gate would be correct on the day it was typed and a claim about a
 * document nobody re-read thereafter — which is the defect class this campaign was built to hunt.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "NAMED BY THE REFUSAL" IS MATCHED, NOT TRUSTED
 *
 * The gate RUNS the suite and reads its printed output, matching each obligation's own text against
 * the test titles that actually passed. A test that was renamed stops matching. A test that was
 * skipped is reported as skipped, not as absent — those are different failures and the second one
 * hides the first.
 *
 * REFUSES a run in which the honest-control case did not pass. Every refusal test asserts that
 * something was refused, and all of them would pass against an importer that refused everything.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['C1'];
export const SENTINEL = 'OB-4 OK';

const REFUSALS = join('tools', 'p2', 'ob4-refusals.json');
const SUITE = 'src/data/adapter/import/__tests__/ob4Refusals.test.ts';
const POWER_LOSS = 'src/data/adapter/import/POWER_LOSS.md';

/** The control that keeps every refusal test honest. */
const ALSO_REQUIRED = [
  ['imports the real set end to end when nothing is wrong — the control that keeps the rest honest',
    'without it, every refusal below passes against an importer that refuses everything'],
];

/** Markdown emphasis is presentation. The obligation is the sentence under it. */
const plain = (text) => text.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();

const escapeForRegExp = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, String.fromCharCode(92) + '$&');

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  // ── the obligations, from the handoff by way of the mirror ───────────────────────
  if (!existsSync(join(root, REFUSALS))) {
    return fail(REFUSALS + ' does not exist. C1 is a claim about ALL TEN obligations, and without '
      + 'the parsed list this gate could only check the ones somebody remembered — run '
      + 'campaign-p2/bin/p2-ob4-refusals.mjs in the pipeline repository');
  }
  const parsed = JSON.parse(readFileSync(join(root, REFUSALS), 'utf8'));
  const refusals = parsed.refusals ?? [];
  if (refusals.length === 0) {
    return fail(REFUSALS + ' records no obligation — an empty population would let this gate report '
      + '"0 of 0 refusals proven" and call it green');
  }
  if (parsed.statedInContract !== refusals.length) {
    problems.push('the mirror records ' + refusals.length + ' obligation(s) and the contract states '
      + parsed.statedInContract + ' — the two documents have moved apart');
  }

  if (!existsSync(join(root, SUITE))) {
    return fail(SUITE + ' does not exist — there is nothing to prove the refusals with');
  }
  if (!existsSync(join(root, POWER_LOSS))) {
    problems.push(POWER_LOSS + ' does not exist. C3 asks for power loss to be CHARACTERISED, and a '
      + 'characterisation nobody wrote down is a claim');
  }

  // ── run it, and read what actually happened ──────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(jest)) return fail('no jest binary — the refusals cannot be proven by running them');

  const r = spawnSync(process.execPath, [jest, SUITE, '--verbose', '--ci'], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');

  const passed = (title) => new RegExp('[√✓]\\s*' + escapeForRegExp(title)).test(out);
  const skipped = (title) => new RegExp('(○|skipped)\\s+' + escapeForRegExp(title)).test(out);

  let proven = 0;
  for (const obligation of refusals) {
    const title = plain(obligation.obligation);
    if (skipped(title)) {
      problems.push('SKIPPED: "' + title + '" — a skipped refusal is worse than a missing one, '
        + 'because the count still looks right');
      continue;
    }
    if (!passed(title)) {
      problems.push('no passing test named by the refusal "' + title + '". C1 asks for ONE TEST PER '
        + 'REFUSAL NAMED BY THE REFUSAL, so the title is the link between the obligation and its '
        + 'evidence — a test that drifts from its obligation stops matching rather than quietly '
        + 'covering something else');
      continue;
    }
    proven += 1;
  }

  for (const [title, why] of ALSO_REQUIRED) {
    if (skipped(title)) problems.push('SKIPPED: "' + title + '" (' + why + ')');
    else if (!passed(title)) problems.push('did not pass: "' + title + '" (' + why + ')');
  }

  const summary = (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim();
  const failedLine = (out.match(/Tests:.*?(\d+) failed/) ?? [])[1];
  if (failedLine && Number(failedLine) > 0) problems.push(summary);

  lines.push('obligations     ' + refusals.length + ' parsed from ' + parsed.source);
  lines.push('proven          ' + proven + ' of ' + refusals.length + ', each by a test NAMED BY THE REFUSAL');
  for (const o of refusals) {
    lines.push('  ' + (passed(plain(o.obligation)) ? 'ok ' : 'NO ') + plain(o.obligation));
  }
  lines.push('');
  lines.push('suite           ' + summary);
  lines.push('C3              a separate criterion with a separate gate: ob4-unproven-three');
  lines.push('');
  lines.push('NOT PROVEN HERE, and said rather than implied:');
  lines.push('  a real power-loss crash. These interruptions are injected exceptions, which unwind a');
  lines.push('  stack where a power cut unwinds nothing. ' + POWER_LOSS + ' characterises the gap;');
  lines.push('  C2 closes it, on a device, in Phase 11.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'OB-4 OK — ' + proven + ' of ' + refusals.length + ' refusals proven',
  };
};
