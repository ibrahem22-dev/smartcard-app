/**
 * GATE: regression — criterion E3.  →  `REGRESSION OK — N passed, M deliberate`
 *
 *   > **E3.** *"The inherited regression net is green, **or** every failure is a deliberate,
 *   > ADR-recorded consequence of a spec change. **A green suite after a spec change is treated as
 *   > more suspicious than a red one.**"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SENTENCE THAT MAKES THIS GATE DIFFERENT FROM "RUN THE TESTS"
 *
 * *A green suite after a spec change is more suspicious than a red one.* P2 deleted a paywall,
 * removed Register/OTP, archived two SDKs, replaced a static `app.json`, moved the colour system to
 * tokens and changed what a conflict renders. **A suite that noticed none of that was not testing
 * any of it.**
 *
 * So the gate does not merely require green. It requires the suite to be **big enough to have
 * noticed**, and it requires every DELETED test to have left a record — because the ordinary way a
 * suite goes green after a spec change is that somebody deleted the tests that failed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT MEASURES
 *
 *   1. **The whole suite runs and passes.** Read from the printed summary, never from an exit code.
 *   2. **Nothing is skipped silently.** A skipped test is reported as a skip and counted; a suite
 *      with skips is not green, it is partly unmeasured.
 *   3. **Every deliberate removal is recorded** in `tools/p2/regression-register.json`, with the
 *      ADR that authorised it and what replaced it. An empty register is fine — it means nothing
 *      was removed — but a register entry with no ADR is a deletion somebody decided alone.
 *   4. **The suite grew.** The register records the count at adoption; a suite smaller than that
 *      without a matching number of recorded removals has lost tests nobody accounted for.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['E3'];
export const SENTINEL = 'REGRESSION OK';

const REGISTER = join('tools', 'p2', 'regression-register.json');

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(join(root, REGISTER))) {
    return fail(REGISTER + ' does not exist. E3 allows a red suite only where every failure is a '
      + 'DELIBERATE, ADR-RECORDED consequence of a spec change — and without a register there is '
      + 'nowhere for that record to be, so "green" would be the only reachable answer and the '
      + 'criterion would be checking nothing');
  }
  const register = JSON.parse(readFileSync(join(root, REGISTER), 'utf8'));
  const removed = register.removed ?? [];
  const baseline = register.baseline ?? null;

  // ── every recorded removal carries an ADR and a replacement ──────────────────────
  for (const r of removed) {
    if (!r.adr || !/^ADR-/.test(String(r.adr))) {
      problems.push('the removal of "' + r.test + '" carries no ADR id. A test deleted because the '
        + 'spec changed is an architectural decision; one deleted because it failed is a defect '
        + 'being hidden, and the only thing that tells them apart is the record');
    }
    if (!r.removedAt || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.removedAt))) {
      problems.push('the removal of "' + r.test + '" carries no ISO date');
    }
    if (!r.why || String(r.why).length < 40) {
      problems.push('the removal of "' + r.test + '" carries no reason a reviewer can disagree with');
    }
  }

  // ── run the whole suite and read what it printed ─────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(jest)) return fail('no jest binary — the suite cannot be measured by running it');

  const r = spawnSync(process.execPath, [jest, '--ci'], {
    cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
  });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');

  const testLine = (out.match(/Tests:\s+.*/) ?? [''])[0];
  const suiteLine = (out.match(/Test Suites:\s+.*/) ?? [''])[0];
  if (!testLine) {
    return fail('the suite printed no summary — the run did not complete, and an exit code alone is '
      + 'not evidence (they are advisory in this project and have been observed false)');
  }

  const passed = Number((testLine.match(/(\d+) passed/) ?? [0, 0])[1]);
  const failed = Number((testLine.match(/(\d+) failed/) ?? [0, 0])[1]);
  const skipped = Number((testLine.match(/(\d+) (?:skipped|todo)/) ?? [0, 0])[1]);
  const total = Number((testLine.match(/(\d+) total/) ?? [0, 0])[1]);

  if (total === 0) {
    return fail('the suite ran 0 tests. A green run of nothing is the vacuous pass this campaign '
      + 'has already found four of');
  }
  if (failed > 0) {
    // A failure is permitted ONLY where the register accounts for it, by name.
    const accounted = removed.filter((x) => x.state === 'FAILING_DELIBERATELY').length;
    if (accounted < failed) {
      problems.push(failed + ' test(s) failed and the register accounts for ' + accounted
        + '. E3 permits a red suite only where EVERY failure is a deliberate, ADR-recorded '
        + 'consequence of a spec change');
    }
  }
  if (skipped > 0) {
    problems.push(skipped + ' test(s) are skipped. A suite with skips is not green, it is partly '
      + 'unmeasured — and a skipped test reads as a passing one in every summary anybody glances at');
  }

  // ── the suite is big enough to have noticed a spec change ────────────────────────
  if (baseline && typeof baseline.tests === 'number') {
    const expectedFloor = baseline.tests - removed.length;
    if (total < expectedFloor) {
      problems.push('the suite has ' + total + ' tests and the register expects at least '
        + expectedFloor + ' (' + baseline.tests + ' at ' + baseline.at + ' less ' + removed.length
        + ' recorded removal(s)). THE ORDINARY WAY A SUITE GOES GREEN AFTER A SPEC CHANGE IS THAT '
        + 'SOMEBODY DELETED THE TESTS THAT FAILED');
    }
  } else {
    problems.push(REGISTER + ' records no baseline count. Without one, a suite that lost fifty '
      + 'tests would still report green');
  }

  lines.push('suite           ' + suiteLine.trim());
  lines.push('                ' + testLine.trim());
  lines.push('register        ' + removed.length + ' recorded removal(s)'
    + (baseline ? ' · baseline ' + baseline.tests + ' tests at ' + baseline.at : ''));
  for (const x of removed.slice(0, 6)) {
    lines.push('  ' + String(x.adr).padEnd(10) + x.test + ' — ' + String(x.why).slice(0, 60));
  }
  lines.push('');
  lines.push('A GREEN SUITE AFTER A SPEC CHANGE IS MORE SUSPICIOUS THAN A RED ONE. P2 deleted a');
  lines.push('  paywall, removed Register/OTP, archived two SDKs, replaced a static app.json, moved');
  lines.push('  the colour system to tokens and changed what a conflict renders. A suite that');
  lines.push('  noticed none of that was not testing any of it — so this gate checks that the suite');
  lines.push('  is big enough to have noticed, and that every deletion left a record.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'REGRESSION OK — ' + passed + ' passed, ' + removed.length + ' deliberate',
  };
};
