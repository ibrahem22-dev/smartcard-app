#!/usr/bin/env node
/**
 * P3-ALL — criterion V1, and the command V2 and V3 run in CI and in a fresh clone.
 *
 * ONE command runs the whole P3 ladder and writes a committed, sha-named report; every step is
 * decided on a printed sentinel; a step that did not run is RECORDED AS NOT RUNNING — never as
 * green. The verdict vocabulary and the reasoning behind it are P2's (tools/p2/all.mjs):
 *
 *   P3-ALL OK — every step green          no failures, no skips, nothing unimplemented or missing
 *   P3-ALL INCOMPLETE — ...               nothing failed, but something did not run
 *   P3-ALL DEVICE-BLOCKED / FAILED        named separately so hardware absence is readable
 *                                         as hardware absence rather than as a regression
 *
 * THE STEP LIST IS DERIVED. Gates come from tools/p3/gates/*.mjs on disk; what MUST exist comes
 * from tools/p3/required-gates.json, generated from the contract by the pipeline. Both populations
 * are reported; only their intersection being green can print the acceptance sentinel.
 *
 * Usage:  npm run p3:all [-- --json]
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gateNames, runGate } from './gate.mjs';
import { runStep, printRow } from '../p2/lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT_DIR = join(ROOT, 'reports', 'p3');

const git = (...a) => {
  const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', shell: false });
  return r.status === 0 ? String(r.stdout).trim() : null;
};
const sha = git('rev-parse', 'HEAD') ?? 'nogit';
/**
 * THE SAME EXCLUSION ITS P2 SIBLING USES, FOR THE SAME REASON: a check must not be broken by its
 * own output. The one uncommitted file an acceptance run may legitimately have is the report of
 * the previous run at the same sha.
 */
const OWN_REPORT = /^reports[/]p3[/][0-9a-f]{12}[.]json$/;
const dirty = String(spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout || '')
  .trim()
  .split(String.fromCharCode(10))
  .filter((line) => line.trim().length > 0)
  .filter((line) => !OWN_REPORT.test(line.slice(3).trim().split(String.fromCharCode(92)).join('/')))
  .length > 0;

console.log('');
console.log('P3-ALL — the whole P3 ladder');
console.log('  sha ' + sha.slice(0, 12) + (dirty ? ' (WORKTREE DIRTY)' : '') + '  node ' + process.version);
console.log('');

const results = [];

// ---------------------------------------------------------------- the fixed steps
const STEPS = [
  {
    name: 'typecheck',
    cmd: process.execPath,
    args: [join(HERE, '..', 'p2', 'checked-step.mjs'), '--name', 'TYPECHECK', '--', 'npx', 'tsc', '--noEmit'],
    sentinel: /^TYPECHECK OK$/m, failure: /^TYPECHECK FAILED|error TS[0-9]+/m,
  },
  {
    name: 'lint',
    cmd: process.execPath,
    args: [join(HERE, '..', 'p2', 'checked-step.mjs'), '--name', 'LINT', '--', 'npm', 'run', '--silent', 'lint'],
    sentinel: /^LINT OK$/m, failure: /^LINT FAILED/m,
  },
  {
    name: 'suite',
    cmd: process.execPath,
    args: [join(HERE, '..', 'p2', 'checked-step.mjs'), '--name', 'SUITE', '--', 'npx', 'jest', '--silent'],
    sentinel: /Tests:\s+\d+ passed, \d+ total/,
    failure: /(Tests:.*failed)|(Test Suites:.*failed)|^SUITE FAILED/m,
  },
  {
    name: 'scenarios',
    cmd: process.execPath,
    args: [join(HERE, '..', 'p2', 'checked-step.mjs'), '--name', 'SCENARIOS', '--', 'npm', 'run', '--silent', 'p3:scenarios'],
    sentinel: /^SCENARIOS OK/m, failure: /^SCENARIOS FAILED/m,
  },
];

let stoppedEarly = false;
for (const s of STEPS) {
  const r = await runStep(s.name, s.cmd, s.args, { sentinel: s.sentinel, failure: s.failure, cwd: ROOT });
  results.push(r);
  printRow(r);
  if (!r.ok && (s.name === 'typecheck')) {
    console.log('');
    console.log('  ' + s.name + ' failed — every gate below reads the same tree, so their results would be noise. Stopping.');
    console.log('');
    stoppedEarly = true;
  }
}

// ---------------------------------------------------------------- the gates, derived from disk
if (!stoppedEarly) {
  const onDisk = gateNames();

  /**
   * WHAT MUST EXIST, mirrored from the contract by the pipeline (campaign-p3/bin/p3-required-gates.mjs).
   * A gate required and absent is MISSING — counted, printed, fatal to the acceptance sentinel.
   */
  const REQUIRED_PATH = join(HERE, 'required-gates.json');
  let required = null;
  let requiredProblem = null;
  if (!existsSync(REQUIRED_PATH)) {
    requiredProblem = 'tools/p3/required-gates.json is missing — without it this ladder can only report on the gates it happens to have, which is not what the contract asks';
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

  console.log('');
  if (requiredProblem) {
    results.push({ step: 'required-gates', ok: false, skipped: false, ms: 0, decidedOn: 'output', line: requiredProblem, processStatus: null, tail: '' });
    console.log('  FAIL  required-gates                 0ms  ' + requiredProblem.slice(0, 96));
  }
  if (!requiredProblem && onDisk.length === 0) {
    results.push({ step: 'gates', ok: false, skipped: false, ms: 0, decidedOn: 'output', line: 'NO GATES ON DISK — a ladder that runs zero gates and reports success is a vacuous pass', processStatus: null, tail: '' });
    console.log('  FAIL  gates                          0ms  NO GATES ON DISK');
  }
  for (const n of onDisk) {
    const started = process.hrtime.bigint();
    const g = await runGate(n);
    const ms = Number((process.hrtime.bigint() - started) / 1000000n);
    const r = {
      step: 'gate:' + n,
      ok: Boolean(g.ok),
      skipped: false,
      notImplemented: Boolean(g.notImplemented),
      missing: false,
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

  for (const n of missingGates) {
    const g = required.gates.find((x) => x.gate === n);
    const r = {
      step: 'gate:' + n,
      ok: false, skipped: false, notImplemented: false, missing: true,
      criteria: g?.criteria ?? [], ms: 0, decidedOn: 'not run',
      line: 'MISSING — required by ' + (g ? g.criteria.join(',') : 'contract') + ', no tools/p3/gates/' + n + '.mjs',
      processStatus: null, tail: '',
    };
    results.push(r);
    console.log('  MISS  ' + r.step.padEnd(26) + '     0ms  ' + r.line.slice(0, 96));
  }

  // ---------------------------------------------------------------- the report
  var missingSteps = results.filter((r) => r.missing).map((r) => r.step);
  var extraGateList = extraGates;
  var requiredCount = requiredNames.length;
  var contractVersion = required?.contractVersion ?? null;
}

// ---------------------------------------------------------------- the report
const missingStepsFinal = typeof missingSteps !== 'undefined' ? missingSteps : [];
const failedSteps = results.filter((r) => !r.ok && !r.skipped && !r.notImplemented && !r.missing).map((r) => r.step);
const skippedSteps = results.filter((r) => r.skipped).map((r) => r.step);
const todoSteps = results.filter((r) => r.notImplemented).map((r) => r.step);
const green = failedSteps.length === 0 && skippedSteps.length === 0 && todoSteps.length === 0
  && missingStepsFinal.length === 0 && !stoppedEarly && results.length > 0;

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, sha.slice(0, 12) + (dirty ? '-dirty' : '') + '.json');
writeFileSync(outPath, JSON.stringify({
  $comment: 'Written by tools/p3/all.mjs. Every step decided on printed output; acceptance requires every step green.',
  sha,
  worktreeDirty: dirty,
  node: process.version,
  acceptanceRun: green,
  ok: green,
  noFailures: failedSteps.length === 0,
  failed: failedSteps,
  skipped: skippedSteps,
  notImplemented: todoSteps,
  gatesMissing: missingStepsFinal,
  gatesNotRequired: typeof extraGateList !== 'undefined' ? extraGateList : [],
  gatesRequired: typeof requiredCount !== 'undefined' ? requiredCount : null,
  contractVersion: typeof contractVersion !== 'undefined' ? contractVersion : null,
  steps: results,
}, null, 2) + '\n');

console.log('');
console.log('  steps ' + results.length
  + ' · gates required ' + (typeof requiredCount !== 'undefined' ? requiredCount : '?')
  + ' · failed ' + failedSteps.length + ' · missing ' + missingStepsFinal.length
  + ' · not implemented ' + todoSteps.length + ' · skipped ' + skippedSteps.length);
console.log('  report  reports/p3/' + outPath.split(/[\\/]/).pop());
console.log('');

if (green) {
  console.log('P3-ALL OK — every step green');
  process.exit(0);
}
if (failedSteps.length === 0) {
  const notRun = todoSteps.length + skippedSteps.length + missingStepsFinal.length;
  console.log('P3-ALL INCOMPLETE — nothing failed, but ' + notRun + ' step(s) did not run: '
    + [...missingStepsFinal.map((s) => s + ' (missing)'), ...todoSteps.map((s) => s + ' (not implemented)'),
       ...skippedSteps.map((s) => s + ' (skipped)')].slice(0, 6).join(', ')
    + (notRun > 6 ? ' … and ' + (notRun - 6) + ' more' : ''));
  console.log('  This is NOT an acceptance run and must not be recorded as one.');
  process.exit(1);
}
/**
 * A DEVICE FLAG CANNOT BE CLAIMED BY HAND HERE — it is read from the mirror the pipeline
 * generates, exactly as P2 does it.
 */
const REQUIRED_AGAIN = join(HERE, 'required-gates.json');
let deviceGates = new Set();
if (existsSync(REQUIRED_AGAIN)) {
  try {
    const req = JSON.parse(readFileSync(REQUIRED_AGAIN, 'utf8'));
    deviceGates = new Set((req.gates ?? []).filter((g) => (g.flags ?? []).includes('DEVICE')).map((g) => 'gate:' + g.gate));
  } catch { /* already reported above */ }
}
const deviceBlocked = failedSteps.filter((s) => deviceGates.has(s));
const realFailures = failedSteps.filter((s) => !deviceGates.has(s));

if (realFailures.length === 0 && deviceBlocked.length > 0) {
  console.log('P3-ALL DEVICE-BLOCKED — ' + deviceBlocked.length + ' step(s) need hardware this '
    + 'machine does not have: ' + deviceBlocked.join(', '));
  console.log('  THIS IS NOT AN ACCEPTANCE RUN.');
  process.exit(1);
}

console.log('P3-ALL FAILED — ' + failedSteps.length + ' step(s): ' + failedSteps.slice(0, 8).join(', ')
  + (missingStepsFinal.length ? ' · missing: ' + missingStepsFinal.length : '')
  + (todoSteps.length ? ' · not implemented: ' + todoSteps.length : ''));
process.exit(1);
