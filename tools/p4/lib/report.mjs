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

export const mark = (r) => (r.skipped ? 'SKIP' : r.missing ? 'MISS' : r.notImplemented ? 'TODO' : r.ok ? 'ok  ' : 'FAIL');

export const printRow = (r) =>
  console.log('  ' + mark(r) + '  ' + String(r.step).padEnd(26) + String(r.ms).padStart(6) + 'ms  ' + String(r.line).slice(0, 96));
