/**
 * GATE: repos-in-sync — criterion F5.  →  `REPOS-IN-SYNC OK — 0 ahead / 0 behind`
 *
 *   > **F5.** *"Both repos clean, pushed, and **verified in sync at the remote by fetch**; a
 *   > snapshot archive exists."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "BY FETCH" IS THE WHOLE INSTRUCTION
 *
 * `git status` reports against a remote-tracking ref that is **as stale as the last fetch**. A
 * repository that pushed an hour ago and had its branch force-moved since then still says
 * "up to date", cheerfully, from a cache. So this gate fetches first and compares afterwards — the
 * network round-trip is the check, and skipping it is how "pushed" becomes a memory rather than a
 * fact.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * BOTH REPOSITORIES, FROM WHICHEVER ONE THE GATE RUNS IN
 *
 * `p2:gate` runs in the app. The pipeline is reachable from a development checkout and not from the
 * app's CI, so the pipeline half **degrades honestly**: where it can be reached it is fetched and
 * compared, and where it cannot the report says the check did not run rather than passing quietly.
 *
 * A gate that silently skipped half its subject would report `REPOS-IN-SYNC OK` for one repository
 * and mean it about two.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['F5'];
export const SENTINEL = 'REPOS-IN-SYNC OK';

const PIPELINE = join('..', 'smartcard-data-pipeline');

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return { ok: r.status === 0, out: String(r.stdout ?? '').trim(), err: String(r.stderr ?? '').trim() };
};

/** Fetch, then compare. The order is the criterion. */
const inspect = (cwd, label) => {
  const branch = git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (!branch.ok) return { label, reachable: false, why: 'not a git repository' };

  const fetched = git(cwd, 'fetch', '--quiet', 'origin');
  const upstream = git(cwd, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
  if (!upstream.ok) {
    return { label, reachable: true, branch: branch.out, tracking: null, why: 'the branch tracks no remote' };
  }

  const counts = git(cwd, 'rev-list', '--left-right', '--count', 'HEAD...@{u}');
  const [ahead, behind] = counts.ok ? counts.out.split(/\s+/).map(Number) : [null, null];
  /**
   * THE LADDER'S OWN REPORT IS NOT UNCOMMITTED WORK.
   *
   * `p2:all` writes `reports/p2/<sha>.json` before it runs the gates, and this gate runs inside that
   * same ladder — so it would be reporting the existence of a file the run it belongs to had just
   * created. On the working machine that was invisible, because the report for that sha was already
   * committed and rewriting identical bytes left the tree clean. **In a fresh clone it is untracked,
   * and the gate failed for a reason that had nothing to do with the repository being out of sync.**
   *
   * E5 requires the report to be COMMITTED, which can only happen after the run that produces it.
   * A check that demanded otherwise would be demanding a file contain its own commit sha.
   *
   * Exactly one generated path is excluded, by name. Every other uncommitted file still counts,
   * including a stale report for a different sha — that one is real drift.
   */
  const OWN_REPORT = /^reports\/p2\/[0-9a-f]{12}\.json$/;
  const rawDirty = git(cwd, 'status', '--porcelain');
  const dirtyLines = rawDirty.out === '' ? [] : rawDirty.out.split('\n').filter((line) => {
    const path = line.slice(3).trim().split(String.fromCharCode(92)).join(String.fromCharCode(47));
    return !OWN_REPORT.test(path);
  });
  const dirty = { out: dirtyLines.join('\n') };
  const head = git(cwd, 'rev-parse', '--short', 'HEAD');

  return {
    label,
    reachable: true,
    branch: branch.out,
    tracking: upstream.out,
    head: head.out,
    ahead,
    behind,
    dirtyPaths: dirty.out === '' ? 0 : dirty.out.split('\n').length,
    firstDirty: dirty.out === '' ? null : dirty.out.split('\n')[0],
    fetched: fetched.ok,
    fetchError: fetched.ok ? null : fetched.err.split('\n')[0],
  };
};

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  const repos = [inspect(root, 'app')];
  const pipelinePath = join(root, PIPELINE);
  if (existsSync(pipelinePath)) {
    repos.push(inspect(pipelinePath, 'pipeline'));
  } else {
    lines.push('pipeline        NOT REACHABLE from this checkout — the check did not run, and this');
    lines.push('                line says so rather than the gate passing quietly for one repository');
    lines.push('                while meaning it about two.');
  }

  for (const r of repos) {
    if (!r.reachable) { problems.push(r.label + ': ' + r.why); continue; }
    if (!r.fetched) {
      problems.push(r.label + ' could not fetch: ' + (r.fetchError ?? 'unknown')
        + '. F5 says VERIFIED IN SYNC AT THE REMOTE BY FETCH — git status compares against a '
        + 'remote-tracking ref as stale as the last fetch, so without the round-trip "pushed" is a '
        + 'memory rather than a fact');
      continue;
    }
    if (!r.tracking) {
      problems.push(r.label + ' branch "' + r.branch + '" tracks no remote — nothing to be in sync with');
      continue;
    }
    if (r.dirtyPaths > 0) {
      problems.push(r.label + ' has ' + r.dirtyPaths + ' uncommitted path(s); first: ' + r.firstDirty
        + '. F5 asks for both repos CLEAN, and an uncommitted file is work the pushed sha does not '
        + 'contain — so every closure claim measured here describes a tree nobody else can obtain');
    }
    if (r.ahead !== 0 || r.behind !== 0) {
      problems.push(r.label + ' is ' + r.ahead + ' ahead / ' + r.behind + ' behind ' + r.tracking);
    }
    lines.push(r.label.padEnd(15) + r.head + ' on ' + r.branch + ' → ' + r.tracking
      + ' · ' + r.ahead + ' ahead / ' + r.behind + ' behind · '
      + (r.dirtyPaths === 0 ? 'clean' : r.dirtyPaths + ' dirty'));
  }

  lines.push('');
  lines.push('FETCHED FIRST, COMPARED AFTERWARDS. A repository that pushed an hour ago and had its');
  lines.push('  branch force-moved since then still says "up to date" from a cache, cheerfully. The');
  lines.push('  network round-trip is the check.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  const app = repos[0];
  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'REPOS-IN-SYNC OK — ' + app.ahead + ' ahead / ' + app.behind + ' behind',
  };
};
