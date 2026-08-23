/**
 * GATE: e1-backlog — criterion D7.  →  `E1-BACKLOG OK — N closed / M deferred, derived`
 *
 *   > **D7.** *"The E1 86-violation backlog is closed, or every remaining item is a dated deferral
 *   > carrying an OD id — and the count is **derived from the lint run, never restated from this
 *   > contract**."*
 *
 * SO THE GATE RUNS THE LINT. Not a stored number, not the report's totals, not the contract's `86`:
 *
 *     ESLINT_USE_FLAT_CONFIG=true eslint --config .eslintrc.boundaries.js src
 *
 * the same command that produced the backlog, the same five rules R1..R5, against the tree as it is
 * now. Both halves of `N closed / M deferred` come out of runs of that command — M from this tree,
 * N from the same command at the commit that adopted the lint, replayed in a temporary worktree.
 * **Nothing in this gate's arithmetic is copied from a document.**
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS LINT AND NOT THE §9.4 GATE, stated because the two look interchangeable and are not.
 *
 * `lint-boundaries` (D5) implements Execution Model §9.4's five rules and prints
 * `BOUNDARY-LINT OK — 5 rules, 0 violations`. When those rules first ran clean, THIS lint found 58
 * on the same tree. The successor was weaker than the predecessor whose backlog D7 exists to close,
 * and its green would have covered every one of them. Both are required now, and they answer
 * different questions: D5 asks whether the §9.4 rules find anything; D7 asks whether the ORIGINAL
 * rules find anything NOBODY HAS LOOKED AT.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * TWO WAYS TO FAIL, and the second one is the point.
 *
 *   1. A live finding matching NO disposition — something new, or something nobody triaged.
 *   2. A disposition matching NOTHING — a stale entry. An exception for a violation that is gone
 *      reads as a deliberate judgement about code that has moved on, and it would silently cover
 *      the next violation that lands in the same file with the same shape.
 */
import { readFileSync, existsSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['D7'];
export const SENTINEL = 'E1-BACKLOG OK — N closed / M deferred, derived';

const REGISTER = join(HERE, '..', 'e1-backlog.json');

/**
 * Run the E1 boundary lint in `cwd` and return one flat list of findings.
 * ESLint exits non-zero whenever it reports anything, so the exit code carries no information here
 * and is deliberately not consulted — the JSON it printed is the evidence.
 */
export const runE1Lint = (cwd, eslintJs) => {
  // ESLint IS INVOKED THROUGH `node <entry>.js`, never through node_modules/.bin/eslint.cmd.
  // Node 20 refuses to spawnSync a .cmd without `shell: true` (EINVAL), and `shell: true` on
  // Windows re-parses every argument through cmd.exe — a config path with a space would be split
  // and the gate would report "the lint did not run" for a reason having nothing to do with the
  // tree. Spawning the JS entry point directly has neither problem and behaves identically on
  // every platform, which matters because this gate must give the same answer in CI as here.
  const r = spawnSync(process.execPath, [eslintJs, '--config', '.eslintrc.boundaries.js', 'src', '-f', 'json'], {
    cwd, encoding: 'utf8', env: { ...process.env, ESLINT_USE_FLAT_CONFIG: 'true' }, shell: false,
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = String(r.stdout ?? '').trim();
  if (!out.startsWith('[')) {
    return { error: 'eslint printed no JSON. stderr: ' + String(r.stderr ?? '').split('\n').slice(0, 3).join(' / ') };
  }
  const findings = [];
  for (const f of JSON.parse(out)) {
    const file = f.filePath.split(/smartcard-app[\\/]|e1-baseline[\\/]/).pop().replace(/\\/g, '/');
    for (const m of f.messages) {
      findings.push({
        rule: String(m.ruleId ?? '?').replace('boundaries/', '').split('-')[0],
        file, line: m.line, message: String(m.message).replace(/\s+/g, ' '),
      });
    }
  }
  return { findings };
};

const matches = (d, f) =>
  d.rule === f.rule && new RegExp(d.file).test(f.file) && new RegExp(d.message).test(f.message);

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(REGISTER)) return fail('tools/p2/e1-backlog.json is missing — D7 needs a disposition per remaining item');
  const reg = JSON.parse(readFileSync(REGISTER, 'utf8'));
  const dispositions = reg.dispositions ?? [];
  if (dispositions.length === 0) return fail('the register declares no dispositions — an empty register cannot account for anything');

  const eslintJs = join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
  if (!existsSync(eslintJs)) return fail('no eslint at node_modules/eslint/bin/eslint.js — the count must come from a lint RUN, and this one cannot run');
  if (!existsSync(join(root, '.eslintrc.boundaries.js'))) {
    return fail('.eslintrc.boundaries.js is gone. It is the lint that produced this backlog; without it D7 has no derivable count and the register would be prose');
  }

  // ── the count that matters: this tree, now ────────────────────────────────────────
  const now = runE1Lint(root, eslintJs);
  if (now.error) return fail('the lint did not run: ' + now.error);
  const live = now.findings;

  // ── the count it started from: the same command at the adopting commit ────────────
  //
  // Replayed in a temporary worktree rather than read from the report, because a report is a claim
  // about a command and this gate's whole subject is deriving the number from the command itself.
  let baselineCount = null;
  let baselineNote = '';
  const adopting = String(reg.lint?.adoptedBy ?? '').split(' ')[0];
  const wt = join(tmpdir(), 'e1-baseline');
  if (/^[0-9a-f]{7,40}$/.test(adopting)) {
    try {
      if (existsSync(wt)) spawnSync('git', ['worktree', 'remove', '--force', wt], { cwd: root, encoding: 'utf8' });
      const add = spawnSync('git', ['worktree', 'add', '--detach', wt, adopting], { cwd: root, encoding: 'utf8' });
      if (add.status === 0) {
        // `.eslintrc.boundaries.js` `require`s @typescript-eslint/parser relative to ITSELF, so a
        // bare worktree cannot load it. A junction to this tree's node_modules is enough — on
        // Windows it needs no privilege, and `symlink` elsewhere. It is the DEPENDENCIES that are
        // shared, never the source: the rules the baseline runs are the ones written inline in the
        // config file AT THAT COMMIT, against the source AT THAT COMMIT. Sharing a parser build is
        // the only way to run an old config at all, and it is the part that cannot change an
        // architectural verdict.
        try {
          symlinkSync(join(root, 'node_modules'), join(wt, 'node_modules'),
            process.platform === 'win32' ? 'junction' : 'dir');
        } catch (e) {
          if (e.code !== 'EEXIST') baselineNote = 'could not link node_modules into the worktree: ' + e.code;
        }
        const before = runE1Lint(wt, eslintJs);
        if (before.findings) { baselineCount = before.findings.length; baselineNote = 'replayed at ' + adopting; }
        else baselineNote = 'the lint would not run at ' + adopting + ': ' + before.error;
      } else {
        baselineNote = 'could not create a worktree at ' + adopting + ': ' + String(add.stderr ?? '').split('\n')[0];
      }
    } finally {
      // UNLINK THE JUNCTION FIRST. `git worktree remove --force` and rmSync recurse, and a junction
      // they follow points straight back into this repository's node_modules. Removing the link
      // before the directory is the difference between cleaning up a temp folder and deleting the
      // dependencies of the tree being measured.
      try { unlinkSync(join(wt, 'node_modules')); } catch { /* absent is the state we want */ }
      spawnSync('git', ['worktree', 'remove', '--force', wt], { cwd: root, encoding: 'utf8' });
      if (existsSync(wt)) { try { rmSync(wt, { recursive: true, force: true }); } catch { /* left for the next run to clear */ } }
    }
  } else {
    baselineNote = 'the register names no commit to replay';
  }

  if (baselineCount === null) {
    problems.push('the baseline could not be derived — ' + baselineNote
      + '. D7 requires the count to come from the lint run, and "closed" is a difference between two runs');
  } else if (baselineCount < live.length) {
    problems.push('the backlog GREW: ' + baselineCount + ' at the baseline, ' + live.length + ' now');
  }

  lines.push('lint            ' + reg.lint.command);
  lines.push('baseline        ' + (baselineCount === null ? 'NOT DERIVED — ' + baselineNote : baselineCount + ' findings, ' + baselineNote));
  lines.push('now             ' + live.length + ' findings in this tree');
  lines.push('');

  // ── every live finding must be accounted for, and every entry must cover something ──
  const covered = new Map(dispositions.map((d) => [d.id, 0]));
  const orphans = [];
  for (const f of live) {
    const hit = dispositions.filter((d) => matches(d, f));
    if (hit.length === 0) { orphans.push(f); continue; }
    covered.set(hit[0].id, covered.get(hit[0].id) + 1);
  }

  for (const d of dispositions) {
    const n = covered.get(d.id);
    lines.push('  ' + String(n).padStart(3) + '  ' + d.disposition.padEnd(8) + '  ' + d.id
      + (d.disposition === 'DEFERRED' ? '   → ' + d.deferredTo + ' [' + d.od + ', ' + d.deferredAt + ']' : ''));
    if (n === 0) {
      problems.push(d.id + ' covers NOTHING — a stale disposition reads as a judgement about code that '
        + 'has moved on, and would silently cover the next violation of the same shape');
    }
    if (d.disposition === 'DEFERRED' && (!d.od || !d.deferredAt)) {
      problems.push(d.id + ' is DEFERRED without ' + (!d.od ? 'an OD id' : 'a date') + ' — D7 requires both');
    }
  }

  for (const f of orphans) {
    problems.push('UNACCOUNTED ' + f.rule + ' ' + f.file + ':' + f.line + ' — ' + f.message.slice(0, 90));
  }

  const deferred = dispositions.filter((d) => d.disposition === 'DEFERRED').reduce((a, d) => a + covered.get(d.id), 0);
  const allowed = dispositions.filter((d) => d.disposition === 'ALLOWED').reduce((a, d) => a + covered.get(d.id), 0);
  const closed = baselineCount === null ? null : baselineCount - live.length;

  lines.push('');
  lines.push('  closed          ' + (closed === null ? '?' : closed) + '   (baseline minus now, both from lint runs)');
  lines.push('  deferred        ' + deferred + '   each with a date and an OD id');
  lines.push('  allowed         ' + allowed + '   each with a reason a reviewer can disagree with');
  lines.push('  unaccounted     ' + orphans.length);

  if (problems.length) {
    return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));
  }

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'E1-BACKLOG OK — ' + closed + ' closed / ' + deferred + ' deferred, derived',
  };
};
