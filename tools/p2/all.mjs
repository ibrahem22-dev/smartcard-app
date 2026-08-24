#!/usr/bin/env node
/**
 * P2-ALL — criterion E5, and the command E7 and F4 run in a fresh clone and in CI.
 *
 * *"ONE command runs the whole P2 ladder and writes a committed, sha-named report; every step
 * decides on a printed sentinel; a step that is skipped is RECORDED AS A SKIP, NEVER OMITTED, and
 * a skipped step can never read as green."*
 *
 * THE TWO THINGS THIS GETS RIGHT FROM DAY ONE, because P1 got both wrong and paid for it:
 *
 *   1. THE STEP LIST IS DERIVED. The gates come from `tools/p2/gates/*.mjs` on disk, not from an
 *      array here. P1's ladder carried a hand-maintained list of eighteen harnesses and would have
 *      printed total success over a nineteenth that nobody listed.
 *
 *   2. A SKIP CANNOT READ AS GREEN. P1's `--quick` DELETED the lint step from its array and then
 *      printed the identical full-green sentinel; only `"quick": true` buried in the JSON told the
 *      difference. Here a skipped or unimplemented step is present, printed, counted, written to
 *      the report, and makes the acceptance sentinel unprintable. There are THREE verdicts:
 *
 *        P2-ALL OK — every step green          no failures, no skips, nothing unimplemented
 *        P2-ALL INCOMPLETE — ...               nothing failed, but something did not run
 *        P2-ALL FAILED — ...                   something ran and failed
 *
 *      Only the first contains the string the contract matches on.
 *
 * Usage:  npm run p2:all [-- --json]
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gateNames, runGate } from './gate.mjs';
import { runStep, printRow } from './lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT_DIR = join(ROOT, 'reports', 'p2');

const git = (...a) => {
  const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', shell: false });
  return r.status === 0 ? String(r.stdout).trim() : null;
};
const sha = git('rev-parse', 'HEAD') ?? 'nogit';
/**
 * THE SAME EXCLUSION PREFLIGHT AND repos-in-sync USE, FOR THE SAME REASON.
 *
 * This line is the third place in the ladder that decides what a clean tree is, and until now the
 * three disagreed: `repos-in-sync` excluded `reports/p2/<sha>.json` by name after failing in a
 * fresh clone, `preflight` was taught the same rule later, and this one was not -- so a run whose
 * only uncommitted file was the previous run's report printed WORKTREE DIRTY and wrote its report
 * as `<sha>-dirty.json`, which is gitignored. E5 requires a COMMITTED sha-named report, so the one
 * run that mattered could not produce one.
 *
 * A check must not be broken by its own output, and three checks in one ladder must not each have
 * their own opinion about it.
 */
const OWN_REPORT = /^reports[/]p2[/][0-9a-f]{12}[.]json$/;
const dirty = String(spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout || '')
  .trim()
  .split(String.fromCharCode(10))
  .filter((line) => line.trim().length > 0)
  .filter((line) => !OWN_REPORT.test(line.slice(3).trim().split(String.fromCharCode(92)).join('/')))
  .length > 0;

console.log('');
console.log('P2-ALL — the whole P2 ladder');
console.log('  sha ' + sha.slice(0, 12) + (dirty ? ' (WORKTREE DIRTY)' : '') + '  node ' + process.version);
console.log('');

const results = [];

// ---------------------------------------------------------------- the fixed steps
const STEPS = [
  {
    name: 'preflight',
    cmd: process.execPath, args: [join(HERE, 'preflight.mjs')],
    sentinel: /^PREFLIGHT OK — .*$/m, failure: /^PREFLIGHT FAILED/m,
  },
  {
    name: 'typecheck',
    cmd: process.execPath, args: [join(HERE, 'checked-step.mjs'), '--name', 'TYPECHECK', '--', 'npx', 'tsc', '--noEmit'],
    sentinel: /^TYPECHECK OK$/m, failure: /^TYPECHECK FAILED|error TS[0-9]+/m,
  },
  {
    name: 'lint',
    cmd: process.execPath, args: [join(HERE, 'checked-step.mjs'), '--name', 'LINT', '--', 'npm', 'run', '--silent', 'lint'],
    sentinel: /^LINT OK$/m, failure: /^LINT FAILED/m,
  },
  {
    name: 'suite',
    cmd: process.execPath, args: [join(HERE, 'checked-step.mjs'), '--name', 'SUITE', '--', 'npx', 'jest', '--silent'],
    sentinel: /Tests:\s+\d+ passed, \d+ total/, failure: /(Tests:.*failed)|(Test Suites:.*failed)|^SUITE FAILED/m,
  },
  /**
   * THE CI WORKFLOW DECIDES THREE CRITERIA, AND UNTIL THE OWNER INSTALLS A CREDENTIAL IT CANNOT
   * RUN AT ALL.
   *
   * `.github/workflows/ci.yml` settles F4, E7 and E6 by grepping the ladder's printed output. Its
   * predecessor was 5,946 bytes of reasoning about which gates it tolerated going red and had never
   * reached a gate in its life — every run died at `npm ci`, because the app's data dependency is a
   * relative path into a private second repository CI never checked out.
   *
   * So the new one's verdict logic is exercised HERE, on every ladder run, against inputs chosen to
   * make it fail. It belongs in the ladder rather than only in the CI job because a control that
   * runs only inside the thing it controls cannot speak before that thing works — and the whole
   * point is to be trustworthy on the first real run, not after it.
   */
  {
    name: 'ci-controls',
    cmd: process.execPath, args: [join(HERE, 'ci-workflow-controls.mjs')],
    sentinel: /^CI-WORKFLOW-CONTROLS OK/m, failure: /^CI-WORKFLOW-CONTROLS FAILED/m,
  },
];

for (const s of STEPS) {
  const r = runStep(s.name, s.cmd, s.args, { sentinel: s.sentinel, failure: s.failure, cwd: ROOT });
  results.push(r);
  printRow(r);
  if (!r.ok && (s.name === 'preflight' || s.name === 'typecheck')) {
    console.log('');
    console.log('  ' + s.name + ' failed — every gate below reads the same tree, so their results would be noise. Stopping.');
    console.log('');
    break;
  }
}

// ---------------------------------------------------------------- the gates, derived from disk
const stoppedEarly = results.some((r) => !r.ok && (r.step === 'preflight' || r.step === 'typecheck'));
const onDisk = gateNames();

/**
 * THE POPULATION IS WHAT THE CONTRACT REQUIRES, NOT WHAT HAPPENS TO BE ON DISK.
 *
 * Deriving the gate list from tools/p2/gates/*.mjs answers "did everything I have pass?". The
 * contract asks "does everything required exist and pass?". On the day this ladder was written one
 * gate module existed and the contract required forty-four — and a ladder deriving its population
 * from disk alone would have run that one, found it green, and printed "P2-ALL OK — every step
 * green" over forty-three checks nobody had written.
 *
 * tools/p2/required-gates.json is generated from the contract by the pipeline and its parity with
 * the contract is checked there on every preflight. It is here so this question can still be
 * answered in a fresh clone and in CI, where the pipeline repository does not exist.
 *
 * A gate required and absent is MISSING — counted, printed, and fatal to the acceptance sentinel.
 * A gate present and not required is reported too: it is not a failure, but an unexplained check
 * running in an acceptance ladder is something a reader should be told about.
 */
const REQUIRED_PATH = join(HERE, 'required-gates.json');
let required = null;
let requiredProblem = null;
if (!existsSync(REQUIRED_PATH)) {
  requiredProblem = 'tools/p2/required-gates.json is missing — without it this ladder can only report on the gates it happens to have, which is not what the contract asks';
} else {
  try {
    required = JSON.parse(readFileSync(REQUIRED_PATH, 'utf8'));
    if (!Array.isArray(required.gates) || required.gates.length === 0) {
      requiredProblem = 'required-gates.json declares no gates — a required set of nothing is not a requirement';
      required = null;
    }
  } catch (err) {
    requiredProblem = 'required-gates.json is unreadable: ' + (err && err.message ? err.message : String(err));
  }
}

const requiredNames = required ? required.gates.map((g) => g.gate).sort() : [];
const missingGates = requiredNames.filter((n) => !onDisk.includes(n));
const extraGates = onDisk.filter((n) => !requiredNames.includes(n));
const names = onDisk;

if (!stoppedEarly) {
  console.log('');
  if (requiredProblem) {
    results.push({ step: 'required-gates', ok: false, skipped: false, ms: 0, decidedOn: 'output', line: requiredProblem, processStatus: null, tail: '' });
    console.log('  FAIL  required-gates                 0ms  ' + requiredProblem.slice(0, 96));
  }
  if (names.length === 0) {
    results.push({ step: 'gates', ok: false, skipped: false, ms: 0, decidedOn: 'output', line: 'NO GATES ON DISK — a ladder that runs zero gates and reports success is a vacuous pass', processStatus: null, tail: '' });
    console.log('  FAIL  gates                          0ms  NO GATES ON DISK');
  }
  for (const n of names) {
    const started = process.hrtime.bigint();
    const g = await runGate(n);
    const ms = Number((process.hrtime.bigint() - started) / 1000000n);
    const r = {
      step: 'gate:' + n,
      ok: Boolean(g.ok),
      skipped: false,
      notImplemented: Boolean(g.notImplemented),
      criteria: g.criteria ?? [],
      ms,
      decidedOn: 'output',
      line: g.ok ? (g.sentinelOverride ?? g.sentinel) : (g.notImplemented ? 'NOT IMPLEMENTED' + (g.message ? ' — ' + g.message.replace(/^NOT IMPLEMENTED — ?/, '') : '') : 'FAILED — ' + (g.message ?? '')),
      processStatus: null,
      tail: String(g.detail ?? '').split('\n').slice(-6).join('\n'),
    };
    results.push(r);
    console.log('  ' + (r.ok ? 'ok  ' : r.notImplemented ? 'TODO' : 'FAIL') + '  ' + r.step.padEnd(26) + String(r.ms).padStart(6) + 'ms  ' + r.line.slice(0, 96));
  }
}

// ---------------------------------------------------------------- gates the contract requires and nobody wrote
if (!stoppedEarly && missingGates.length) {
  console.log('');
  for (const n of missingGates) {
    const g = required.gates.find((x) => x.gate === n);
    const r = {
      step: 'gate:' + n,
      ok: false,
      skipped: false,
      missing: true,
      criteria: g.criteria,
      ms: 0,
      decidedOn: 'not run',
      line: 'MISSING — required by ' + g.criteria.join(',') + ', no tools/p2/gates/' + n + '.mjs',
      processStatus: null,
      tail: '',
    };
    results.push(r);
    console.log('  MISS  ' + r.step.padEnd(26) + '     0ms  ' + r.line.slice(0, 96));
  }
}

// ---------------------------------------------------------------- the report
const missingSteps = results.filter((r) => r.missing).map((r) => r.step);
const failedSteps = results.filter((r) => !r.ok && !r.skipped && !r.notImplemented && !r.missing).map((r) => r.step);
const skippedSteps = results.filter((r) => r.skipped).map((r) => r.step);
const todoSteps = results.filter((r) => r.notImplemented).map((r) => r.step);
const green = failedSteps.length === 0 && skippedSteps.length === 0 && todoSteps.length === 0
  && missingSteps.length === 0 && required !== null && results.length > 0;

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, sha.slice(0, 12) + (dirty ? '-dirty' : '') + '.json');
writeFileSync(outPath, JSON.stringify({
  $comment:
    'Written by tools/p2/all.mjs. Every step is decided on its printed output; a process status is '
    + 'recorded for the log and is never the decision. `acceptanceRun` is true only when nothing '
    + 'failed, nothing was skipped and nothing is unimplemented — a skipped or unwritten step can '
    + 'never read as green.',
  sha,
  worktreeDirty: dirty,
  node: process.version,
  acceptanceRun: green,
  ok: green,
  noFailures: failedSteps.length === 0,
  failed: failedSteps,
  skipped: skippedSteps,
  notImplemented: todoSteps,
  gatesOnDisk: onDisk.length,
  gatesRequired: requiredNames.length,
  gatesMissing: missingGates,
  gatesNotRequired: extraGates,
  contractVersion: required?.contractVersion ?? null,
  steps: results,
}, null, 2) + '\n');

console.log('');
console.log('  steps ' + results.length + ' · gates ' + onDisk.length + ' of ' + requiredNames.length + ' required'
  + ' · failed ' + failedSteps.length + ' · missing ' + missingSteps.length
  + ' · not implemented ' + todoSteps.length + ' · skipped ' + skippedSteps.length);
if (extraGates.length) console.log('  gates present but NOT required by the contract: ' + extraGates.join(', '));
console.log('  report  reports/p2/' + outPath.split(/[\\/]/).pop());
console.log('');

if (green) {
  console.log('P2-ALL OK — every step green');
  process.exit(0);
}
if (failedSteps.length === 0) {
  const notRun = todoSteps.length + skippedSteps.length + missingSteps.length;
  console.log('P2-ALL INCOMPLETE — nothing failed, but ' + notRun + ' step(s) did not run: '
    + [...missingSteps.map((s) => s + ' (missing)'), ...todoSteps.map((s) => s + ' (not implemented)'),
       ...skippedSteps.map((s) => s + ' (skipped)')].slice(0, 6).join(', ')
    + (notRun > 6 ? ' … and ' + (notRun - 6) + ' more' : ''));
  console.log('  This is NOT an acceptance run and must not be recorded as one.');
  process.exit(1);
}
/**
 * A DEVICE-FLAGGED GATE THAT FAILS IS NAMED, NOT EXCUSED.
 *
 * The contract flags four criteria DEVICE, and `required-gates.json` carries that flag through. A
 * gate behind one cannot pass on a machine with no hardware, and reporting it as an ordinary
 * failure has a real cost: it makes CI's red indistinguishable from a regression, and **a build
 * that is always red teaches everyone to ignore it** — which is how a real failure gets through.
 *
 * So the ladder distinguishes them. **Nothing turns green.** `P2-ALL OK — every step green` is still
 * unreachable while a device gate is red, which is exactly right: criteria E5, E7 and F4 all require
 * that sentinel, and P2 is not complete without a device. What changes is that the verdict SAYS
 * which blocker it is, so a reader can tell "hardware is missing" from "something broke".
 *
 * The flag is read from the generated file, never listed here. A gate somebody flagged DEVICE by
 * hand in this script would be an excuse with a hardcoded name.
 */
const deviceGates = new Set(
  (required?.gates ?? []).filter((g) => (g.flags ?? []).includes('DEVICE')).map((g) => 'gate:' + g.gate),
);
const deviceBlocked = failedSteps.filter((s) => deviceGates.has(s));
const realFailures = failedSteps.filter((s) => !deviceGates.has(s));

if (realFailures.length === 0 && deviceBlocked.length > 0) {
  console.log('P2-ALL DEVICE-BLOCKED — ' + deviceBlocked.length + ' step(s) need hardware this '
    + 'machine does not have: ' + deviceBlocked.join(', '));
  console.log('  Everything else is green. THIS IS NOT AN ACCEPTANCE RUN: E5, E7 and F4 all require');
  console.log('  "P2-ALL OK — every step green", and that sentence is unreachable until a device run');
  console.log('  is captured. Reported separately so a reader can tell a missing device from a');
  console.log('  regression — not so it can be counted as a pass.');
  process.exit(1);
}

console.log('P2-ALL FAILED — ' + failedSteps.length + ' step(s): ' + failedSteps.slice(0, 8).join(', ')
  + (deviceBlocked.length ? ' · of which device-blocked: ' + deviceBlocked.length : '')
  + (missingSteps.length ? ' · missing: ' + missingSteps.length : '')
  + (todoSteps.length ? ' · not implemented: ' + todoSteps.length : ''));
process.exit(1);
