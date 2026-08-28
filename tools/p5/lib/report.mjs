/**
 * SHARED REPORTING FOR THE P5 HARNESS.
 *
 * Duplicated into tools/p5 rather than imported from tools/p2, tools/p3 or tools/p4, for the reason
 * each predecessor's copy states in its own header: no campaign's harness may drift because
 * another's moved. P2, P3 and P4 are closed. A closed campaign's evidence must keep meaning what it
 * meant, and it cannot if a live campaign is editing the code that produced it.
 *
 * The two rules every predecessor encodes, carried unchanged:
 *
 *   1. DECIDE ON PRINTED OUTPUT, NEVER ON AN EXIT CODE. Exit codes are advisory in this project and
 *      have been observed false — a Windows-only shim once exited 1 on Linux, and its sibling
 *      returned OK for any runtime at all from behind a comment insisting it was not a no-op.
 *   2. A POSITIVE SENTINEL, NEVER THE ABSENCE OF A FAILURE STRING. A process killed halfway also
 *      produces absence.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ONE THING IS NEW IN P5, AND IT IS THE ONLY DIFFERENCE FROM tools/p4/lib/report.mjs.
 *
 * P5 is the first phase with five surfaces reading the same five engines, so `MEASURES` gains a
 * fourth value, `'agreement'` — a claim that two or more surfaces produce the same value for the
 * same inputs, obtained in ONE run from ONE engine call. Contract §2 rule 10:
 *
 *   > *"An agreement claim is measured across surfaces in one run. Two passing per-surface tests do
 *   > not compose into an agreement: they can both be right about themselves and disagree with each
 *   > other."*
 *
 * The value is recorded in the ladder's report so that a criterion about agreement can be audited
 * for whether the thing that checked it ever compared two surfaces to each other. It is a label,
 * not a proof — `campaign-p5/bin/p5-agreement.mjs --audit` is what reads the gate source and looks
 * for the four structural signals, and closure test 2 runs it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** A gate's own result. NOT_IMPLEMENTED is a first-class state and is deliberately NOT ok. */
export const ok = (sentinel, detail) => ({ ok: true, sentinel, detail: detail ?? null });
export const fail = (message, detail) => ({ ok: false, message, detail: detail ?? null });
export const notImplemented = (owedBy) => ({
  ok: false,
  notImplemented: true,
  message: 'NOT IMPLEMENTED' + (owedBy ? ' — owed by ' + owedBy : ''),
});

/** The four measurement kinds of P5_VALIDATION_PLAN.md §0. A gate declares which one it is. */
export const MEASUREMENT_KINDS = Object.freeze(['source', 'render', 'artifact', 'agreement']);

/**
 * Run a step and decide on what it printed.
 *
 * `sentinel` is what success looks like; `failure` is a pattern that makes the result a failure even
 * if the sentinel also appears, which matters for tools that print a summary line and an error.
 * A step is ok only when the sentinel matched, no failure pattern matched, and the process was not
 * killed by a signal — because a killed process produces neither a sentinel nor an error.
 */
export const runStep = async (name, cmd, args, { sentinel, failure, cwd, skip } = {}) => {
  if (skip) return { step: name, ok: false, skipped: true, ms: 0, decidedOn: 'not run', line: 'SKIPPED — ' + skip, processStatus: null, tail: '' };
  const started = process.hrtime.bigint();
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: false });
  const ms = Number((process.hrtime.bigint() - started) / 1000000n);
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');
  const killed = Boolean(r.signal || r.error);
  const hit = sentinel ? (out.match(sentinel) ?? [null])[0] : null;
  const bad = failure ? (out.match(failure) ?? [null])[0] : null;
  const good = Boolean(hit) && !bad && !killed;
  return {
    step: name,
    ok: good,
    skipped: false,
    ms,
    decidedOn: 'output',
    line: good ? String(hit).trim()
      : killed ? 'KILLED — ' + (r.signal ?? r.error?.message ?? 'no signal reported') + ' (absence of a failure string is not a pass)'
      : bad ? String(bad).trim()
      : 'no sentinel printed',
    processStatus: r.status,
    tail: out.split('\n').filter((l) => l.trim()).slice(-6).join('\n'),
  };
};

/**
 * Spawn jest on one suite and require a set of NAMED test results to have passed — by matching the
 * verbose reporter's check marks against the names. A suite that compiles and passes without ever
 * running a required case fails here; so does a skipped one.
 *
 * WHY THE NAMES AND NOT THE COUNT. "the suite passed" is satisfied by a suite whose only remaining
 * case is `it('exists')`. Requiring each case by name means deleting the assertion that carries a
 * clause of the criterion fails the gate, which is the whole point of naming criteria in the first
 * place.
 *
 * `extraArgs` is how a caller adds what its own suite needs — P5's screen criteria are measured by
 * RENDERING (contract §2 rule 9), and the rendering project's configuration travels through here
 * rather than being assumed.
 */
export const requireJestCases = (root, suite, cases, extraArgs = []) => {
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(join(root, suite))) return { problems: [suite + ' does not exist'], summary: null };
  if (!existsSync(jest)) return { problems: ['no jest binary'], summary: null };
  const r = spawnSync(process.execPath, [jest, suite, '--verbose', '--ci', ...extraArgs], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');
  const escapeForRegExp = (t) => t.replace(/[.*+?${}()|[\]\\]/g, String.fromCharCode(92) + '$&');
  const problems = [];
  for (const name of cases) {
    const escaped = escapeForRegExp(name);
    const skipped = new RegExp('(○|skipped|todo)\\s+' + escaped).test(out);
    const passed = new RegExp('[√✓]\\s*' + escaped).test(out);
    if (skipped) problems.push('SKIPPED: "' + name + '"');
    else if (!passed) problems.push('did not pass: "' + name + '"');
  }
  const m = out.match(/Tests:\s+.*/);
  return { problems, summary: m ? m[0].trim() : '(no summary)', output: out };
};

export const mark = (r) => (r.skipped ? 'SKIP' : r.missing ? 'MISS' : r.notImplemented ? 'TODO' : r.ok ? 'ok  ' : 'FAIL');

export const printRow = (r) =>
  console.log('  ' + mark(r) + '  ' + String(r.step).padEnd(30) + String(r.ms).padStart(6) + 'ms  ' + String(r.line).slice(0, 96));
