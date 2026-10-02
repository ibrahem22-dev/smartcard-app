/**
 * SHARED REPORTING FOR THE P4 HARNESS.
 *
 * Duplicated into tools/p4 rather than imported from tools/p2 or tools/p3, for the reason P3's
 * copy states in its own header: neither campaign's harness may drift because the other's moved.
 * P2 and P3 are closed. A closed campaign's evidence must keep meaning what it meant, and it cannot
 * if a live campaign is editing the code that produced it.
 *
 * The two rules both predecessors encode, carried unchanged:
 *
 *   1. DECIDE ON PRINTED OUTPUT, NEVER ON AN EXIT CODE. Exit codes are advisory in this project and
 *      have been observed false — a Windows-only shim once exited 1 on Linux, and its sibling
 *      returned OK for any runtime at all from behind a comment insisting it was not a no-op.
 *   2. A POSITIVE SENTINEL, NEVER THE ABSENCE OF A FAILURE STRING. A process killed halfway also
 *      produces absence.
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
 * PORTED FROM `tools/p3/lib/report.mjs`, UNCHANGED IN BEHAVIOUR, for the reason this file's header
 * gives: P4 keeps its own copy so that neither campaign's harness can drift because the other's
 * moved. `extraArgs` is how a caller adds what its own suite needs — P4's screen criteria are
 * measured by RENDERING (contract §2 rule 9), and the rendering project's configuration travels
 * through here rather than being assumed.
 *
 * WHY THE NAMES AND NOT THE COUNT. "the suite passed" is satisfied by a suite whose only remaining
 * case is `it('exists')`. Requiring each case by name means deleting the assertion that carries a
 * clause of the criterion fails the gate, which is the whole point of naming criteria in the first
 * place.
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
  console.log('  ' + mark(r) + '  ' + String(r.step).padEnd(26) + String(r.ms).padStart(6) + 'ms  ' + String(r.line).slice(0, 96));
