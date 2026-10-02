/**
 * SHARED REPORTING FOR THE P3 HARNESS — the same two rules the P2 harness encodes, for the same
 * reasons. Duplicated into tools/p3 rather than imported across campaign tooling, so neither
 * campaign's harness can drift because the other's moved:
 *
 *   1. DECIDE ON PRINTED OUTPUT, NEVER ON AN EXIT CODE.
 *   2. A POSITIVE SENTINEL, NEVER THE ABSENCE OF A FAILURE STRING.
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
 * Spawn jest on one suite and require a set of NAMED test results to have passed — by matching the
 * verbose reporter's check marks against the names. A suite that compiles and passes without ever
 * running a required case fails here; so does a skipped one.
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
