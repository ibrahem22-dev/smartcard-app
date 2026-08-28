#!/usr/bin/env node
/**
 * P5-ALL — criterion V1, and the command V2 and V3 run in CI and in a fresh clone.
 *
 * ONE command runs the whole P5 ladder and writes a committed, sha-named report; every step is
 * decided on a printed sentinel; a step that did not run is RECORDED AS NOT RUNNING — never as
 * green. The verdict vocabulary is P2's, P3's and P4's, carried unchanged so four campaigns' reports
 * read the same way:
 *
 *   P5-ALL OK — every step green          no failures, no skips, nothing unimplemented or missing
 *   P5-ALL INCOMPLETE — ...               nothing failed, but something did not run
 *   P5-ALL DEVICE-BLOCKED / FAILED        named separately so hardware absence is readable as
 *                                         hardware absence rather than as a regression
 *
 * THE STEP LIST IS DERIVED. Gates come from tools/p5/gates/*.mjs on disk; what MUST exist comes
 * from tools/p5/required-gates.json, mirrored from the contract by
 * campaign-p5/bin/p5-required-gates.mjs. Both populations are reported; only their intersection
 * being green can print the acceptance sentinel.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS BEFORE ANY GATE DOES, AND WHAT IT REFUSES TO SAY
 *
 * P5's execution plan asks WP-0.8 for the `p5:*` family at PHASE-0, before a single gate is
 * written, and says in as many words that it *"may not print `P5-ALL OK` over an empty ladder"*.
 * This runner cannot and does not: a ladder that runs zero gates and reports success is the exact
 * defect contract §2 rule 5 names — P1's `verify-estate` exited 0 on an empty manifest, and P4 built
 * this same runner and recorded the same refusal as its deviation D-001. With no gates written, the
 * honest verdict is `P5-ALL INCOMPLETE` naming every required gate as MISSING, and that is what it
 * prints.
 *
 * So the harness proves itself a different way: `--selfcheck` tests the RUNNER, including the
 * control that matters most today — that `verdictFor` cannot return green over an empty result set.
 * That is a positive sentinel about a thing that was actually built, rather than a green line about
 * work nobody has done.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT P5 ADDS TO P4'S RUNNER, AND WHY EACH ONE IS HERE
 *
 *   · `measures` is REQUIRED of every gate and must be one of the four kinds in
 *     P5_VALIDATION_PLAN.md §0 — source · render · artifact · agreement. It is recorded per step,
 *     so the report can answer "was this criterion measured by the right kind of check?" A
 *     criterion about a screen measured by a source grep, or an agreement criterion measured by a
 *     render assertion, is the failure that plan exists to prevent.
 *   · The AGREEMENT gates are named in the report. Contract §16 test 2 is a separate test from test
 *     1 *"because it is the one thing P5 exists to prove"*, and a report that cannot say which of
 *     its steps were the agreement properties cannot support it.
 *   · The dirty-worktree exclusion tolerates a ladder report from ANY of p3, p4 and p5, matched by
 *     the sha-named convention rather than by directory. P5 must run P4's ladder — criterion B12 —
 *     and P4's ladder writes `reports/p4/<sha>.json` by design. Without this, measuring B12 would
 *     make P5's own ladder report the worktree dirty, which is P4's PD-P4-006 one campaign later.
 *
 * Usage:  npm run p5:all  [-- --selfcheck]
 *
 * Exit codes are advisory in this project. Decide on printed output.
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gateNames, runGate, requiredGates } from './gate.mjs';
import { runStep, printRow, MEASUREMENT_KINDS } from './lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT_DIR = join(ROOT, 'reports', 'p5');

/** The five criteria contract §16 test 2 gates on, and the gates that carry them. */
const AGREEMENT_GATES = ['one-scoring', 'one-load', 'one-risk', 'one-limit', 'caches-agree'];

/**
 * THE VERDICT, AS A PURE FUNCTION, so that --selfcheck can interrogate it without running a ladder.
 * Green requires every one of these, and the empty case is called out explicitly rather than
 * falling out of the arithmetic: `results.length > 0`. Zero steps passing zero steps is the vacuous
 * pass this project has shipped before.
 */
export const verdictFor = (results, { stoppedEarly = false, deviceGates = new Set() } = {}) => {
  const failed = results.filter((r) => !r.ok && !r.skipped && !r.notImplemented && !r.missing).map((r) => r.step);
  const skipped = results.filter((r) => r.skipped).map((r) => r.step);
  const todo = results.filter((r) => r.notImplemented).map((r) => r.step);
  const missing = results.filter((r) => r.missing).map((r) => r.step);
  const green = failed.length === 0 && skipped.length === 0 && todo.length === 0
    && missing.length === 0 && !stoppedEarly && results.length > 0;
  const deviceBlocked = failed.filter((s) => deviceGates.has(s));
  const realFailures = failed.filter((s) => !deviceGates.has(s));
  const verdict = green ? 'OK'
    : failed.length === 0 ? 'INCOMPLETE'
    : realFailures.length === 0 && deviceBlocked.length > 0 ? 'DEVICE-BLOCKED'
    : 'FAILED';
  return { verdict, green, failed, skipped, todo, missing, deviceBlocked, realFailures };
};

// ─────────────────────────────────────────────────────────────────────────────── --selfcheck
if (process.argv.includes('--selfcheck')) {
  const problems = [];
  const notes = [];
  const controls = [];

  // 1. The required-gate mirror must exist, parse, and declare something.
  const { required, error } = requiredGates();
  if (error) problems.push(error);
  else {
    notes.push('required-gates.json: ' + required.gates.length + ' gate(s), '
      + (required.nonGateCriteria?.length ?? 0) + ' non-gate criteria, contract v' + required.contractVersion);
    // 2. The mirror must account for every criterion it claims to cover. A mirror that drops rows
    //    silently is the same failure as a hand-kept list.
    const covered = new Set();
    for (const g of required.gates) for (const c of g.criteria) covered.add(c);
    for (const c of required.nonGateCriteria ?? []) covered.add(c.id);
    if (covered.size !== required.criteriaCount) {
      problems.push('the mirror accounts for ' + covered.size + ' criteria but declares criteriaCount '
        + required.criteriaCount + ' — some criterion is in neither population');
    } else {
      notes.push('every one of the ' + required.criteriaCount + ' criteria is in exactly one population');
    }
    // 3. Every required gate must carry a sentinel. A gate with none cannot be decided on output.
    const sentinelless = required.gates.filter((g) => !g.sentinel);
    if (sentinelless.length) problems.push(sentinelless.length + ' required gate(s) declare no sentinel: ' + sentinelless.map((g) => g.gate).join(', '));
    // 4. P5's own: the five agreement gates contract §16 test 2 names must be in the required set.
    //    If they are not, the mirror was generated from a contract that does not carry group A, and
    //    a ladder built from it could go green having proved nothing about agreement.
    const requiredNames = new Set(required.gates.map((g) => g.gate));
    const absentAgreement = AGREEMENT_GATES.filter((g) => !requiredNames.has(g));
    if (absentAgreement.length) problems.push('the contract mirror does not require ' + absentAgreement.join(', ')
      + ' — closure test 2 gates on A1–A5 and these are the gates that carry them');
    else notes.push('all five agreement gates are required by the contract: ' + AGREEMENT_GATES.join(', '));
  }

  // 5. THE CONTROL THAT MATTERS: the verdict function must refuse to be green over nothing.
  const empty = verdictFor([]);
  if (empty.green) problems.push('verdictFor([]) returned GREEN — the ladder would report success over zero steps');
  else controls.push('vacuous pass refused: verdictFor([]) is ' + empty.verdict + ', not OK');

  const oneMissing = verdictFor([{ step: 'gate:x', ok: false, missing: true }]);
  if (oneMissing.green || oneMissing.verdict !== 'INCOMPLETE') problems.push('a MISSING gate did not produce INCOMPLETE (got ' + oneMissing.verdict + ')');
  else controls.push('a missing gate refused: verdict INCOMPLETE, not OK');

  const oneFailed = verdictFor([{ step: 'gate:x', ok: false }]);
  if (oneFailed.verdict !== 'FAILED') problems.push('a failed gate did not produce FAILED (got ' + oneFailed.verdict + ')');
  else controls.push('a failed gate refused: verdict FAILED');

  const stopped = verdictFor([{ step: 'typecheck', ok: true }], { stoppedEarly: true });
  if (stopped.green) problems.push('stoppedEarly still returned GREEN — a ladder that stopped is not a ladder that passed');
  else controls.push('an early stop refused: verdict ' + stopped.verdict + ', not OK');

  const allGreen = verdictFor([{ step: 'typecheck', ok: true }, { step: 'gate:x', ok: true }]);
  if (!allGreen.green) problems.push('verdictFor could not return green for an all-green set — the check can never pass, which is its own defect');
  else controls.push('and it CAN say OK when everything really is green, so the refusals above are not a stuck function');

  // 6. The gate runner must refuse a gate name it does not have, rather than going quiet.
  const unknown = spawnSync(process.execPath, [join(HERE, 'gate.mjs'), 'no-such-gate-exists'], { cwd: ROOT, encoding: 'utf8' });
  const unknownOut = String(unknown.stdout ?? '') + String(unknown.stderr ?? '');
  if (!/P5-GATE FAILED — unknown gate/.test(unknownOut)) problems.push('the gate runner did not refuse an unknown gate name; it printed: ' + unknownOut.trim().split('\n').slice(-1)[0]);
  else controls.push('unknown gate name refused loudly by the runner, not silently');

  /* 7. P5's own, and it runs through the REAL runGate rather than a copy of its rule — a control
        that re-implements what it is controlling proves the copy, which is the defect class this
        project keeps paying for. Two gates are planted in throwaway files and removed again: one
        that would print a sentinel while declaring a kind that is not one of the four, and one that
        would print a sentinel while declaring no kind at all. `gateNames()` ignores files beginning
        with `_`, so neither can ever join the ladder even if a run is killed before the cleanup. */
  {
    const dir = join(HERE, 'gates');
    const cases = [
      { file: '_selfcheck-measures-unknown', body: 'export const MEASURES = "vibes";', label: 'an unknown MEASURES ("vibes")' },
      { file: '_selfcheck-measures-absent', body: '', label: 'no MEASURES at all' },
    ];
    mkdirSync(dir, { recursive: true });
    for (const c of cases) {
      const probe = join(dir, c.file + '.mjs');
      try {
        writeFileSync(probe, 'export const SENTINEL = "PROBE OK";\n' + c.body + '\nexport const run = async () => ({ ok: true, sentinel: SENTINEL });\n');
        const r = await runGate(c.file);
        if (r.ok) problems.push('a gate declaring ' + c.label + ' was ACCEPTED and would have printed its sentinel — the four kinds in P5_VALIDATION_PLAN.md §0 are not being enforced');
        else controls.push('a gate declaring ' + c.label + ' refused: ' + String(r.message).slice(0, 84));
      } catch (err) {
        problems.push('the MEASURES control could not run for ' + c.file + ': ' + (err?.message ?? String(err)));
      } finally {
        rmSync(probe, { force: true });
      }
    }
    /* And the same runner must ACCEPT a well-formed one, or the two refusals above are a stuck
       function rather than a discrimination. */
    const good = join(dir, '_selfcheck-measures-good.mjs');
    try {
      writeFileSync(good, 'export const SENTINEL = "PROBE OK";\nexport const MEASURES = "source";\nexport const CRITERIA = ["_probe"];\nexport const run = async () => ({ ok: true, sentinel: SENTINEL });\n');
      const r = await runGate('_selfcheck-measures-good');
      if (!r.ok) problems.push('a well-formed gate declaring MEASURES "source" was REFUSED (' + String(r.message).slice(0, 80) + ') — the check can never pass, which is its own defect');
      else controls.push('and a well-formed gate declaring MEASURES "source" is accepted, so the two refusals are a discrimination and not a stuck function');
    } catch (err) {
      problems.push('the positive MEASURES control could not run: ' + (err?.message ?? String(err)));
    } finally {
      rmSync(good, { force: true });
    }
    notes.push('measurement kinds enforced: ' + MEASUREMENT_KINDS.join(', '));
  }

  // 8. The report directory must be writable, because V1 requires a committed sha-named report.
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    const probe = join(OUT_DIR, '.selfcheck-probe');
    writeFileSync(probe, 'probe\n');
    // Leave nothing behind: a check that litters the worktree makes criterion B9 fail on its own
    // output, and an artifact nobody meant to ship is how a repository stops being readable.
    rmSync(probe, { force: true });
    notes.push('report directory writable: reports/p5/ (probe written and removed, nothing left behind)');
  } catch (err) {
    problems.push('reports/p5/ is not writable: ' + (err?.message ?? String(err)));
  }

  const onDisk = gateNames();
  notes.push('gates on disk: ' + onDisk.length + (onDisk.length ? ' (' + onDisk.join(', ') + ')' : ' — none yet, which is correct at PHASE-0'));

  console.log('');
  console.log('P5-ALL SELFCHECK — does the harness work, before any gate exists to run through it');
  console.log('');
  for (const n of notes) console.log('  ok    ' + n);
  console.log('');
  console.log('  NEGATIVE CONTROLS — each is a way this runner could lie, watched to refuse:');
  for (const c of controls) console.log('    ·  ' + c);
  console.log('');
  if (problems.length) {
    for (const p of problems) console.log('  FAIL  ' + p);
    console.log('');
    console.log('P5-ALL SELFCHECK FAILED — ' + problems.length + ' problem(s)');
    process.exit(1);
  }
  console.log('  The harness is sound. It is NOT a statement that the ladder is green: with '
    + onDisk.length + ' gate(s)');
  console.log('  on disk and ' + (required?.gates.length ?? '?') + ' required, `npm run p5:all` correctly reports INCOMPLETE.');
  console.log('');
  console.log('P5-ALL SELFCHECK OK');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────── the real ladder
const git = (...a) => {
  const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', shell: false });
  return r.status === 0 ? String(r.stdout).trim() : null;
};
const sha = git('rev-parse', 'HEAD') ?? 'nogit';
/**
 * THE SAME EXCLUSION ITS P2, P3 AND P4 SIBLINGS USE, FOR THE SAME REASON: a check must not be broken
 * by its own output — WIDENED BY ONE CASE THAT IS P5'S.
 *
 * P4's copy excluded only its own `reports/p4/<sha>.json`. P5 must RUN P4's ladder, because
 * criterion B12 requires `P4-ALL OK` at the sha P5 closes on, and that run writes
 * `reports/p4/<sha>.json`. Excluding only P5's own report would mean that measuring B12 made P5's
 * own ladder call the worktree dirty — a check broken by a different check's output, which is
 * P4's PD-P4-006 one campaign later. Matched by the sha-named convention, so an ordinary file
 * dropped in `reports/` is still dirt.
 */
const LADDER_REPORT = /^reports[/]p[345][/][0-9a-f]{12}(-dirty)?[.]json$/;
/** Intake-pinned inherited untracked (P3 report, other-tool config). Not P5's dirt. */
const INHERITED_UNTRACKED = /^(?:\.claude\/)/;
const dirty = String(spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).stdout || '')
  .trim()
  .split(String.fromCharCode(10))
  .filter((line) => line.trim().length > 0)
  .filter((line) => {
    const path = line.slice(3).trim().split(String.fromCharCode(92)).join('/');
    return !LADDER_REPORT.test(path) && !INHERITED_UNTRACKED.test(path);
  })
  .length > 0;

console.log('');
console.log('P5-ALL — the whole P5 ladder');
console.log('  sha ' + sha.slice(0, 12) + (dirty ? ' (WORKTREE DIRTY)' : '') + '  node ' + process.version);
console.log('');

const results = [];

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
];

let stoppedEarly = false;
for (const s of STEPS) {
  const r = await runStep(s.name, s.cmd, s.args, { sentinel: s.sentinel, failure: s.failure, cwd: ROOT });
  results.push(r);
  printRow(r);
  if (!r.ok && s.name === 'typecheck') {
    console.log('');
    console.log('  ' + s.name + ' failed — every gate below reads the same tree, so their results would be noise. Stopping.');
    console.log('');
    stoppedEarly = true;
    break;
  }
}

let requiredCount = null;
let contractVersion = null;
let extraGateList = [];

if (!stoppedEarly) {
  const onDisk = gateNames();
  const { required, error: requiredProblem } = requiredGates();
  const requiredNames = required ? required.gates.map((g) => g.gate).sort() : [];
  const missingGates = requiredNames.filter((n) => !onDisk.includes(n));
  extraGateList = onDisk.filter((n) => !requiredNames.includes(n));
  requiredCount = requiredNames.length;
  contractVersion = required?.contractVersion ?? null;

  console.log('');
  if (requiredProblem) {
    results.push({ step: 'required-gates', ok: false, skipped: false, ms: 0, decidedOn: 'output', line: requiredProblem, processStatus: null, tail: '' });
    console.log('  FAIL  required-gates               0ms  ' + requiredProblem.slice(0, 96));
  }
  if (!requiredProblem && onDisk.length === 0 && requiredNames.length === 0) {
    results.push({ step: 'gates', ok: false, skipped: false, ms: 0, decidedOn: 'output', line: 'NO GATES ON DISK AND NONE REQUIRED — a ladder that runs zero gates and reports success is a vacuous pass', processStatus: null, tail: '' });
    console.log('  FAIL  gates                         0ms  NO GATES ON DISK AND NONE REQUIRED');
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
      measures: g.measures ?? null,
      agreement: AGREEMENT_GATES.includes(n),
      ms,
      decidedOn: 'output',
      line: g.ok ? (g.sentinelOverride ?? g.sentinel)
        : g.notImplemented ? 'NOT IMPLEMENTED' + (g.message ? ' — ' + g.message.replace(/^NOT IMPLEMENTED — ?/, '') : '')
        : 'FAILED — ' + (g.message ?? ''),
      processStatus: null,
      tail: String(g.detail ?? '').split('\n').slice(-6).join('\n'),
    };
    results.push(r);
    printRow(r);
  }

  for (const n of missingGates) {
    const g = required.gates.find((x) => x.gate === n);
    const r = {
      step: 'gate:' + n,
      ok: false, skipped: false, notImplemented: false, missing: true,
      criteria: g?.criteria ?? [], measures: null, agreement: AGREEMENT_GATES.includes(n),
      ms: 0, decidedOn: 'not run',
      line: 'MISSING — required by ' + (g ? g.criteria.join(',') : 'contract') + ', no tools/p5/gates/' + n + '.mjs',
      processStatus: null, tail: '',
    };
    results.push(r);
    printRow(r);
  }
}

/**
 * A DEVICE FLAG CANNOT BE CLAIMED BY HAND HERE — it is read from the mirror the pipeline generates,
 * exactly as P2, P3 and P4 do it.
 */
const { required: req2 } = requiredGates();
const deviceGates = new Set((req2?.gates ?? []).filter((g) => (g.flags ?? []).includes('DEVICE')).map((g) => 'gate:' + g.gate));

const v = verdictFor(results, { stoppedEarly, deviceGates });

/** What the report says about group A, so closure test 2 has something to read. */
const agreementRows = results.filter((r) => r.agreement);
const agreementGreen = agreementRows.length > 0 && agreementRows.every((r) => r.ok);

mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, sha.slice(0, 12) + (dirty ? '-dirty' : '') + '.json');
writeFileSync(outPath, JSON.stringify({
  $comment: 'Written by tools/p5/all.mjs. Every step decided on printed output; acceptance requires every step green.',
  sha,
  worktreeDirty: dirty,
  node: process.version,
  acceptanceRun: v.green,
  ok: v.green,
  verdict: v.verdict,
  noFailures: v.failed.length === 0,
  failed: v.failed,
  skipped: v.skipped,
  notImplemented: v.todo,
  gatesMissing: v.missing,
  gatesNotRequired: extraGateList,
  gatesRequired: requiredCount,
  contractVersion,
  agreement: {
    gates: AGREEMENT_GATES,
    present: agreementRows.map((r) => r.step),
    green: agreementGreen,
    $comment: 'Contract §16 test 2 is a separate test from test 1 because agreement is the one thing P5 exists to prove. A report that cannot say which steps were the agreement properties cannot support it.',
  },
  steps: results,
}, null, 2) + '\n');

console.log('');
console.log('  steps ' + results.length
  + ' · gates required ' + (requiredCount ?? '?')
  + ' · failed ' + v.failed.length + ' · missing ' + v.missing.length
  + ' · not implemented ' + v.todo.length + ' · skipped ' + v.skipped.length);
console.log('  agreement gates ' + agreementRows.length + ' of ' + AGREEMENT_GATES.length + ' present · ' + (agreementGreen ? 'all green' : 'NOT all green'));
console.log('  report  reports/p5/' + outPath.split(/[\\/]/).pop());
console.log('');

if (v.verdict === 'OK') {
  console.log('P5-ALL OK — every step green');
  process.exit(0);
}
if (v.verdict === 'INCOMPLETE') {
  const notRun = v.todo.length + v.skipped.length + v.missing.length;
  console.log('P5-ALL INCOMPLETE — nothing failed, but ' + notRun + ' step(s) did not run: '
    + [...v.missing.map((s) => s + ' (missing)'), ...v.todo.map((s) => s + ' (not implemented)'),
       ...v.skipped.map((s) => s + ' (skipped)')].slice(0, 6).join(', ')
    + (notRun > 6 ? ' … and ' + (notRun - 6) + ' more' : ''));
  console.log('  This is NOT an acceptance run and must not be recorded as one.');
  process.exit(1);
}
if (v.verdict === 'DEVICE-BLOCKED') {
  console.log('P5-ALL DEVICE-BLOCKED — ' + v.deviceBlocked.length + ' step(s) need hardware this '
    + 'machine does not have: ' + v.deviceBlocked.join(', '));
  console.log('  THIS IS NOT AN ACCEPTANCE RUN.');
  process.exit(1);
}
console.log('P5-ALL FAILED — ' + v.failed.length + ' step(s): ' + v.failed.slice(0, 8).join(', ')
  + (v.missing.length ? ' · missing: ' + v.missing.length : '')
  + (v.todo.length ? ' · not implemented: ' + v.todo.length : ''));
process.exit(1);
