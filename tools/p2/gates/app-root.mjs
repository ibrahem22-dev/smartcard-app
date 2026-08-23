/**
 * GATE: app-root — criterion F1.
 *
 * *"OD-13 is ruled and recorded, and the application root is where the ruling says, with git
 * history and remote preserved."*  →  `APP-ROOT OK — history preserved`
 *
 * WHAT "HISTORY PRESERVED" HAS TO MEAN TO BE CHECKABLE. A relocation that re-initialised the
 * repository and replayed the files would leave a working tree that looks identical and a history
 * that is a different object graph. So the gate does not ask "is there a history?" — it asks for
 * properties a fresh `git init` cannot fake:
 *
 *   - the first commit is reachable from HEAD and predates the relocation
 *   - the remote is the one the ruling names, and HEAD's branch tracks it
 *   - the object store is intact (`git fsck` reports no errors)
 *   - the root is TOP-LEVEL: no git repository exists above it
 *
 * The last is the one OD-13 is actually about. The condition it ended was an app repo nested inside
 * `SmartCard-Agent`, whose outer directory carried an unborn git repo with no commits.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['F1'];
export const SENTINEL = 'APP-ROOT OK — history preserved';

/** The remote OD-13's ruling implies: the repository this campaign was told to relocate. */
const EXPECTED_REMOTE = 'smartcard-app.git';

export const run = async ({ root }) => {
  const git = (...a) => {
    const r = spawnSync('git', a, { cwd: root, encoding: 'utf8', shell: false });
    return { ok: r.status === 0, out: String(r.stdout ?? '').trim(), err: String(r.stderr ?? '').trim() };
  };

  const problems = [];
  const lines = [];

  // --- the root itself -------------------------------------------------------------
  const top = git('rev-parse', '--show-toplevel');
  if (!top.ok) return fail('not a git repository at ' + root);
  const toplevel = resolve(top.out);
  lines.push('toplevel        ' + toplevel);

  // --- top-level: nothing above it is a repository ---------------------------------
  let nestedIn = null;
  let dir = dirname(toplevel);
  for (let i = 0; i < 16 && dir && dir !== dirname(dir); i += 1) {
    if (existsSync(join(dir, '.git'))) { nestedIn = dir; break; }
    dir = dirname(dir);
  }
  if (nestedIn) {
    problems.push('NESTED — a git repository exists at ' + nestedIn + ', above this root. OD-13 ruled this root top-level, and the nesting it ended is exactly this shape.');
  }
  lines.push('nested under    ' + (nestedIn ?? 'nothing — this is a top-level root'));

  // --- the remote ------------------------------------------------------------------
  const remote = git('remote', 'get-url', 'origin');
  if (!remote.ok) problems.push('no origin remote — OD-13 requires the remote preserved');
  else if (!remote.out.includes(EXPECTED_REMOTE)) {
    problems.push('origin is ' + remote.out + ', which does not name ' + EXPECTED_REMOTE);
  }
  lines.push('origin          ' + (remote.ok ? remote.out : '(none)'));

  // --- history: reachable, non-trivial, and older than the relocation ---------------
  const count = git('rev-list', '--count', 'HEAD');
  const n = count.ok ? Number(count.out) : 0;
  if (!Number.isFinite(n) || n < 2) {
    problems.push('HEAD has ' + count.out + ' commit(s) — a preserved history is not one commit, and a re-initialised repository is exactly what that looks like');
  }
  const first = git('rev-list', '--max-parents=0', 'HEAD');
  const firstSha = first.ok ? first.out.split('\n')[0] : null;
  const firstDate = firstSha ? git('show', '-s', '--format=%ad', '--date=short', firstSha).out : null;
  const headDate = git('show', '-s', '--format=%ad', '--date=short', 'HEAD').out;
  lines.push('commits         ' + n + '  from ' + (firstSha ? firstSha.slice(0, 8) : '?') + ' (' + firstDate + ') to HEAD (' + headDate + ')');

  /**
   * The relocation happened on 2026-08-23. A history that begins on or after that date is not a
   * preserved history — it is a new one. The date is read from the repository, never asserted.
   */
  const RELOCATED_ON = '2026-08-23';
  if (firstDate && firstDate >= RELOCATED_ON) {
    problems.push('the first commit is dated ' + firstDate + ', on or after the relocation (' + RELOCATED_ON + ') — this history was created by the move, not preserved through it');
  }

  // --- the branch tracks the remote -------------------------------------------------
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  const upstream = git('rev-parse', '--abbrev-ref', 'HEAD@{upstream}');
  lines.push('branch          ' + branch.out + (upstream.ok ? '  ->  ' + upstream.out : '  (no upstream)'));
  if (!upstream.ok) problems.push('branch ' + branch.out + ' tracks no upstream — "remote preserved" has to mean the branch still points at it');

  // --- the object store is intact ---------------------------------------------------
  const fsck = spawnSync('git', ['fsck', '--no-progress'], { cwd: root, encoding: 'utf8' });
  const fsckOut = String(fsck.stdout ?? '') + String(fsck.stderr ?? '');
  const errors = fsckOut.split('\n').filter((l) => l.trim() && !/^dangling /.test(l));
  if (errors.length) problems.push('git fsck reported ' + errors.length + ' non-dangling problem(s): ' + errors[0]);
  lines.push('fsck            ' + (errors.length ? errors.length + ' ERRORS' : 'no errors (' + fsckOut.split('\n').filter((l) => /^dangling /.test(l)).length + ' dangling objects, which are not errors)'));

  // --- linked worktrees still resolve here -------------------------------------------
  const wt = git('worktree', 'list');
  const wtLines = wt.ok ? wt.out.split('\n').filter(Boolean) : [];
  lines.push('worktrees       ' + wtLines.length + ' (' + wtLines.length + ' resolving to this root)');
  for (const w of wtLines.slice(1)) {
    const p = w.split(/\s+/)[0];
    if (!existsSync(p)) problems.push('linked worktree path does not exist: ' + p);
  }

  if (problems.length) {
    return fail(problems.length + ' problem(s): ' + problems.join(' · '), lines.join('\n'));
  }
  return ok(SENTINEL, lines.join('\n'));
};
