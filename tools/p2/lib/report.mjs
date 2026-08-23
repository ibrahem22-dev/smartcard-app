/**
 * SHARED REPORTING FOR THE P2 HARNESS.
 *
 * Two rules are encoded here rather than left to each caller to remember, because P1 lost real
 * evidence to both:
 *
 *   1. DECIDE ON PRINTED OUTPUT, NEVER ON AN EXIT CODE. Exit codes are advisory in this project
 *      and have been observed false — a wrapper reported exit 0 over a worker that exited 1 having
 *      written nothing, and `npm run --silent check 2>&1 | tail -20` printed EXIT=0 while the check
 *      had FAILED, because `$?` was `tail`'s status. Every step declares a POSITIVE sentinel and a
 *      failure marker; the process status is recorded for the log and is never the decision.
 *
 *   2. A POSITIVE SENTINEL, NEVER THE ABSENCE OF A FAILURE STRING. A killed process also produces
 *      absence. `silentSuccess` does not exist here on purpose.
 */
import { spawnSync } from 'node:child_process';

/** A step that ran and was decided on what it printed. */
export const runStep = (name, cmd, args, { sentinel, failure, cwd, skip }) => {
  if (skip) {
    return { step: name, ok: false, skipped: true, ms: 0, decidedOn: 'not run', line: 'SKIPPED — ' + skip, processStatus: null, tail: '' };
  }
  const started = process.hrtime.bigint();
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  const text = String(r.stdout ?? '') + String(r.stderr ?? '');
  const ms = Number((process.hrtime.bigint() - started) / 1000000n);
  const failed = failure ? failure.test(text) : false;
  const passed = Boolean(sentinel && sentinel.test(text)) && !failed;
  const line = (sentinel && (text.match(sentinel) ?? [])[0])
    ?? (failed ? (text.match(failure) ?? [])[0] : '(no sentinel found)');
  return {
    step: name,
    ok: passed,
    skipped: false,
    ms,
    decidedOn: 'output',
    line: String(line).trim(),
    processStatus: r.status,
    tail: text.trim().split('\n').slice(-8).join('\n'),
  };
};

export const mark = (r) => (r.skipped ? 'SKIP' : r.ok ? 'ok  ' : 'FAIL');

export const printRow = (r) =>
  console.log('  ' + mark(r) + '  ' + String(r.step).padEnd(26) + String(r.ms).padStart(6) + 'ms  ' + r.line.slice(0, 96));

/**
 * A gate's own result. `NOT_IMPLEMENTED` is a first-class state and is deliberately NOT `ok`:
 * a gate that has not been written yet must never be able to print a green sentinel, and must
 * never be silently absent either. Both of those are how a campaign closes over work it did not do.
 */
export const ok = (sentinel, detail) => ({ ok: true, sentinel, detail: detail ?? null });
export const fail = (message, detail) => ({ ok: false, message, detail: detail ?? null });
export const notImplemented = (owedBy) => ({
  ok: false,
  notImplemented: true,
  message: 'NOT IMPLEMENTED' + (owedBy ? ' — owed by ' + owedBy : ''),
});
