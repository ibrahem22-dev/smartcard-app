#!/usr/bin/env node
/**
 * P2 PREFLIGHT (app side) — criterion F3.
 *
 * *"The app repo toolchain is pinned and enforced by a preflight that HARD-FAILS on Node mismatch,
 * missing binaries or a dirty worktree — the app-side analogue of `scripts/preflight.mjs`."*
 *
 * It hard-fails rather than warns, and it never repairs what it measures. `pin-node.mjs` writes the
 * shims; this only checks them. A gate that silently fixes its own subject can never be observed to
 * fail, and a check that has never failed is not yet a check.
 *
 *   npm run p2:preflight              # full
 *   npm run p2:preflight -- --runtime # the subset safe to run inside another npm script
 *   npm run p2:preflight -- --json
 *
 * Decide on printed output:  PREFLIGHT OK — N of N   /   PREFLIGHT FAILED — ...
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUNTIME_ONLY = process.argv.includes('--runtime');
const JSON_MODE = process.argv.includes('--json');

const results = [];
const record = (name, ok, detail, fatal = true) => { results.push({ name, ok, detail, fatal }); return ok; };
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: false, ...opts });

// ---------------------------------------------------------------- 1. the runtime this is ON
{
  const want = existsSync(join(ROOT, '.nvmrc')) ? readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim().replace(/^v/, '') : null;
  const have = process.versions.node;
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const engines = pkg.engines?.node ?? null;
  const ok = want !== null && have === want;
  record('node version', ok,
    ok ? 'running v' + have + '; .nvmrc pins ' + want + (engines ? '; engines.node = ' + engines : '')
       : want === null ? 'no .nvmrc — the pinned runtime is not stated anywhere'
       : 'running v' + have + ' but .nvmrc pins ' + want);
}

// ---------------------------------------------------------------- 2. the runtime a CHILD gets
/**
 * The check that actually matters on this machine. The runtime THIS process is on says nothing
 * about the runtime a spawned build step gets: a machine-wide Node 24 precedes everything a
 * non-administrator can add to PATH, and npm scripts inherit that raw PATH. Only the
 * node_modules/.bin shims change it, and only for npm-spawned children.
 */
{
  const r = run(process.execPath, [join(ROOT, 'tools', 'p2', 'pin-node.mjs'), '--check']);
  const text = (String(r.stdout || '') + String(r.stderr || '')).trim();
  const ok = /PIN-NODE OK/.test(text);
  record('npm-script runtime', ok, ok ? text.split('\n')[0] : text.split('\n').join(' / '));
}

// ---------------------------------------------------------------- 3. required binaries
for (const [bin, args] of [['git', ['--version']], ['npm', ['--version']]]) {
  const r = run(bin, args, { shell: true });
  record('binary: ' + bin, r.status === 0, r.status === 0 ? String(r.stdout).trim().split('\n')[0] : 'NOT FOUND on PATH');
}

// ---------------------------------------------------------------- 4. the dependency tree matches the lockfile
/**
 * `npm ls --all` is too slow to run every time and too noisy to decide on. What matters for
 * reproducibility is narrower: the lockfile exists, it is the version npm ci understands, and
 * node_modules was actually installed from it rather than assembled by hand.
 */
{
  const lockPath = join(ROOT, 'package-lock.json');
  if (!existsSync(lockPath)) {
    record('lockfile', false, 'package-lock.json is missing — npm ci cannot run and no install is reproducible');
  } else {
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    const installed = existsSync(join(ROOT, 'node_modules', '.package-lock.json'));
    const ok = Number(lock.lockfileVersion) >= 2 && installed;
    record('lockfile', ok,
      ok ? 'package-lock.json v' + lock.lockfileVersion + ', node_modules installed from it'
         : !installed ? 'node_modules/.package-lock.json absent — node_modules was not installed by npm ci/install'
         : 'lockfileVersion ' + lock.lockfileVersion + ' is older than v2');
  }
}

// ---------------------------------------------------------------- 5. worktree cleanliness and branch
if (!RUNTIME_ONLY) {
  /**
   * THE LADDER'S OWN REPORT IS NOT UNCOMMITTED WORK.
   *
   * `p2:all` writes `reports/p2/<sha>.json` and then runs this preflight on the next invocation, so
   * a clone that has run the ladder once can never run it again: the first run's output is the
   * second run's dirt. E5 requires that report to be COMMITTED, which can only happen after the run
   * that produces it -- and committing it moves HEAD, so the next run writes a differently-named
   * file and the tree is dirty again. The loop has no exit.
   *
   * `tools/p2/gates/repos-in-sync.mjs` already excludes exactly this path, for exactly this reason,
   * after it failed in a fresh clone. Preflight was not taught the same thing, so the two disagreed
   * about what a clean tree is. **A check must not be broken by its own output.**
   *
   * ONE generated path, by name, for the current sha shape. Every other uncommitted file still
   * fails, including a stale report for a different sha -- that one is real drift.
   */
  const OWN_REPORT = /^reports[/]p2[/][0-9a-f]{12}[.]json$/;
  const r = run('git', ['status', '--porcelain'], { shell: true });
  const NL = String.fromCharCode(10);
  const dirty = String(r.stdout || '').trim().split(NL)
    .filter((line) => line.trim().length > 0)
    .filter((line) => !OWN_REPORT.test(line.slice(3).trim().split(String.fromCharCode(92)).join('/')))
    .join(NL);

  record('worktree clean', dirty.length === 0,
    dirty.length === 0 ? 'clean' : dirty.split('\n').length + ' modified/untracked path(s); first: ' + dirty.split('\n')[0]);

  const b = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { shell: true });
  const branch = String(b.stdout || '').trim();
  record('branch', branch.length > 0, 'on ' + (branch || '(none)'), false);

  const top = run('git', ['rev-parse', '--show-toplevel'], { shell: true });
  const toplevel = String(top.stdout || '').trim();
  /**
   * OD-13: the repository is at a TOP-LEVEL root and is not nested inside another working tree.
   * The condition OD-13 ended was an app repo living inside `SmartCard-Agent`, whose outer
   * directory carried an unborn git repo. Nesting is checked by walking up from the root and
   * looking for another `.git`; finding one means the ruling has been undone.
   */
  let nestedIn = null;
  let dir = dirname(toplevel);
  for (let i = 0; i < 12 && dir && dir !== dirname(dir); i += 1) {
    if (existsSync(join(dir, '.git'))) { nestedIn = dir; break; }
    dir = dirname(dir);
  }
  record('not nested (OD-13)', nestedIn === null,
    nestedIn === null ? toplevel + ' has no git repository above it'
      : 'NESTED — a .git exists at ' + nestedIn + ', above this repository. OD-13 ruled this root top-level.');
}

// ---------------------------------------------------------------- report
const failed = results.filter((r) => r.fatal && !r.ok);
if (JSON_MODE) {
  console.log(JSON.stringify({ node: process.versions.node, mode: RUNTIME_ONLY ? 'runtime' : 'full', results, failed: failed.length }, null, 2));
} else {
  console.log('');
  console.log('P2 PREFLIGHT — ' + (RUNTIME_ONLY ? 'runtime subset' : 'full session-start gate'));
  for (const r of results) console.log('  ' + (r.ok ? 'ok  ' : 'FAIL') + '  ' + r.name.padEnd(22) + ' ' + r.detail);
  console.log('');
}

const fatalCount = results.filter((r) => r.fatal).length;
if (failed.length === 0) {
  console.log('PREFLIGHT OK — ' + fatalCount + ' of ' + fatalCount);
  process.exit(0);
}
console.log('PREFLIGHT FAILED — ' + failed.length + ' hard check(s): ' + failed.map((r) => r.name).join(', '));
process.exit(1);
