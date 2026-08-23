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

/**
 * The remote OD-13's ruling implies: the repository this campaign was told to relocate.
 *
 * MATCHED ON IDENTITY, NOT ON SPELLING. This used to require the literal string
 * `smartcard-app.git`, and CI failed on it: `actions/checkout` writes the origin as
 * `https://github.com/<owner>/smartcard-app` with no `.git` suffix. Both name the same repository,
 * and a gate that fails on which of two equivalent spellings a client happened to write is checking
 * punctuation rather than the thing OD-13 cared about. The owner and the repository name are both
 * still required — this is narrower than a substring match, not wider.
 */
const EXPECTED_REMOTE = 'ibrahem22-dev/smartcard-app';
const remoteMatches = (url) =>
  new RegExp('(^|[/:])' + EXPECTED_REMOTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\.git)?/?$')
    .test(String(url).trim());

/**
 * THE MATCHER'S OWN CONTROL — `node tools/p2/gates/app-root.mjs --self-test`.
 *
 * Four of the nine cases MUST NOT match. A matcher that accepts everything would pass a test suite
 * made only of things that should match, which is how a check stops being a check. What it does NOT
 * check is the host, and that is stated in the table rather than left for someone to discover: this
 * asserts WHICH repository, not which server, because OD-13 was a ruling about the repository.
 */
export const REMOTE_CASES = [
  ['https://github.com/ibrahem22-dev/smartcard-app', true, 'CI: actions/checkout writes no .git suffix'],
  ['https://github.com/ibrahem22-dev/smartcard-app.git', true, 'local: as git remote add wrote it'],
  ['https://github.com/ibrahem22-dev/smartcard-app/', true, 'trailing slash'],
  ['git@github.com:ibrahem22-dev/smartcard-app.git', true, 'ssh form'],
  ['https://github.com/someoneelse/smartcard-app', false, 'WRONG OWNER'],
  ['https://github.com/ibrahem22-dev/smartcard-app-fork', false, 'different repo sharing the prefix'],
  ['https://github.com/ibrahem22-dev/smartcard-data-pipeline.git', false, 'the OTHER repository in this campaign'],
  ['https://evil.example/ibrahem22-dev/smartcard-app.git', true, 'host is deliberately NOT checked'],
  ['', false, 'empty'],
];

export const selfTest = () => {
  let bad = 0;
  for (const [url, want, why] of REMOTE_CASES) {
    const got = remoteMatches(url);
    if (got !== want) bad += 1;
    console.log((got === want ? '  ok   ' : '  WRONG') + '  ' + String(got).padEnd(5)
      + ' (want ' + String(want).padEnd(5) + ')  ' + (url || '(empty)').padEnd(60) + why);
  }
  const mustNot = REMOTE_CASES.filter((c) => !c[1]).length;
  console.log('');
  console.log(bad === 0
    ? 'APP-ROOT SELF-TEST OK — ' + REMOTE_CASES.length + ' cases, ' + mustNot + ' of them must NOT match'
    : 'APP-ROOT SELF-TEST FAILED — ' + bad + ' case(s) wrong');
  return bad === 0;
};

if (process.argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);

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
  else if (!remoteMatches(remote.out)) {
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
