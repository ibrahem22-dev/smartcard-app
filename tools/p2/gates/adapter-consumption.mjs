/**
 * GATE: adapter-consumption — criterion D1.  →  `ADAPTER-CONSUMPTION OK`
 *
 *   > **D1.** *"The app consumes the **published adapter package** at a **pinned version**, with the
 *   > compatibility matrix **enforced at load**."*
 *
 *   > **OD-20.** *"The adapter is PIPELINE-OWNED… The app pins a version of this package and reads
 *   > through it; **it does not reimplement any of it**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "PINNED" IS THE WORD THIS GATE TAKES SERIOUSLY
 *
 * The usual reading is a semver range, and a range accepts a build nobody in this repository has
 * seen. Worse, during development the package resolves through a `file:` link, which pins NOTHING —
 * it follows whatever is on disk, so an adapter rebuilt in the pipeline changes the app's behaviour
 * with no diff in the app and no review of the change.
 *
 * So the pin is a declaration the app makes and this gate checks: `PINNED_ADAPTER` names the
 * `adapterVersion` AND the `builtFromCommit`, and both must match the package that actually
 * installed. The commit is the load-bearing half — two builds can carry one version number and
 * different behaviour, and a commit cannot.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * FIVE CHECKS
 *
 *   1. **The package is a dependency**, and it is the published adapter by name.
 *   2. **The installed build matches the declared pin**, both halves.
 *   3. **The compatibility matrix is enforced at load** — the app calls the adapter's own
 *      `assertPackCompatible`, and does not carry a copy of the matrix.
 *   4. **The refusal is proven**, by running the test that feeds an unreadable format and requires
 *      a refusal rather than a partial read.
 *   5. **Only `src/data/adapter/**` names the package.** D2's claim, and the reason this directory
 *      exists: a second importer is a second reading of the boundary.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['D1'];
export const SENTINEL = 'ADAPTER-CONSUMPTION OK';

const PACKAGE = '@smartcard/data-authority-adapter';
const SEAM = 'src/data/adapter/index.ts';
const TEST = 'src/data/adapter/__tests__/adapterSeam.test.ts';
const REQUIRED_CASE = 'REFUSES a pack format the adapter cannot read, and says which two versions disagree';

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

const stripComments = (src) => {
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (m, b, c) => b + blank(c));
};

const lineAt = (code, i) => code.slice(0, i).split('\n').length;
const escapeForRegExp = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, String.fromCharCode(92) + '$&');

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  // ── 1. the package is a dependency ───────────────────────────────────────────────
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const declared = pkg.dependencies?.[PACKAGE];
  if (!declared) {
    return fail('package.json does not depend on ' + PACKAGE + '. D1 says the app consumes the '
      + 'PUBLISHED adapter package; a gate that passed without it would be describing an intention');
  }

  const installedPath = join(root, 'node_modules', PACKAGE, 'package.json');
  if (!existsSync(installedPath)) {
    return fail(PACKAGE + ' is declared and not installed — nothing can be read through it');
  }
  const installed = JSON.parse(readFileSync(installedPath, 'utf8'));

  // ── 2. the installed build matches the declared pin ──────────────────────────────
  if (!existsSync(join(root, SEAM))) {
    return fail(SEAM + ' does not exist. D2 says nothing outside data/adapter/** touches the pack '
      + 'boundary, and there is no seam for anything to go through');
  }
  const seam = stripComments(readFileSync(join(root, SEAM), 'utf8'));

  const pinnedVersion = (seam.match(/adapterVersion:\s*'([^']+)'/) ?? [])[1];
  const pinnedCommit = (seam.match(/builtFromCommit:\s*'([^']+)'/) ?? [])[1];
  if (!pinnedVersion || !pinnedCommit) {
    problems.push(SEAM + ' declares no PINNED_ADAPTER with both an adapterVersion and a '
      + 'builtFromCommit. A semver range accepts a build nobody here has seen, and a file: link '
      + 'follows whatever is on disk — neither is a pin');
  } else {
    if (installed.smartcard?.adapterVersion !== pinnedVersion) {
      problems.push('the installed adapterVersion is ' + installed.smartcard?.adapterVersion
        + ' and the app pins ' + pinnedVersion);
    }
    if (installed.smartcard?.builtFromCommit !== pinnedCommit) {
      problems.push('the installed adapter was built from ' + installed.smartcard?.builtFromCommit
        + ' and the app pins ' + pinnedCommit + '. Two builds can carry one version number and '
        + 'different behaviour; the commit is the half that cannot');
    }
  }
  lines.push('package         ' + PACKAGE + ' · declared as ' + declared);
  lines.push('installed       v' + installed.version + ' · adapterVersion '
    + installed.smartcard?.adapterVersion + ' · built from ' + String(installed.smartcard?.builtFromCommit).slice(0, 12));
  lines.push('pinned to       adapterVersion ' + pinnedVersion + ' · commit ' + String(pinnedCommit).slice(0, 12));

  // ── 3. the matrix is enforced at load, and not copied ────────────────────────────
  if (!/assertPackCompatible/.test(seam)) {
    problems.push(SEAM + ' never calls assertPackCompatible. D1 says the matrix is ENFORCED AT '
      + 'LOAD, and the adapter\'s own module says a rule that lives in a README is true until '
      + 'somebody does not read the README');
  }
  // A copy of the matrix is IF-7 re-derived — the handoff's "a load-time check replaced by prose".
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files — an empty population proves nothing');

  const copies = [];
  const importers = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));
    if (code.includes(PACKAGE)) {
      importers.push({ file: rel, line: lineAt(code, code.indexOf(PACKAGE)) });
    }
    for (const m of code.matchAll(/(const|let)\s+\w*(COMPATIBILITY_MATRIX|CompatibilityMatrix)\w*\s*=\s*\[/g)) {
      copies.push({ file: rel, line: lineAt(code, m.index) });
    }
  }
  for (const c of copies) {
    problems.push(c.file + ':' + c.line + ' declares its own compatibility matrix. handoff §2 IF-7: '
      + 're-deriving it means "a load-time check replaced by prose nobody enforces"');
  }

  // ── 5. only the seam directory names the package ─────────────────────────────────
  const outside = importers.filter((i) => !i.file.startsWith('src/data/adapter/'));
  for (const o of outside.slice(0, 4)) {
    problems.push(o.file + ':' + o.line + ' imports ' + PACKAGE + ' directly. D2: nothing outside '
      + 'data/adapter/** touches the pack boundary, and a second importer is a second reading of it');
  }
  lines.push('importers       ' + importers.length + ' file(s) name the package · ' + outside.length
    + ' outside src/data/adapter/**');

  // ── 4. the refusal is proven by running it ───────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(join(root, TEST))) {
    problems.push(TEST + ' does not exist — Gate 7 asks for load-time rejection PROVEN');
  } else if (!existsSync(jest)) {
    problems.push('no jest binary — the refusal cannot be proven by running it');
  } else {
    const r = spawnSync(process.execPath, [jest, TEST, '--verbose', '--ci'], {
      cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    });
    const out = String(r.stdout ?? '') + String(r.stderr ?? '');
    const passed = new RegExp('[√✓]\\s*' + escapeForRegExp(REQUIRED_CASE)).test(out);
    const skipped = new RegExp('skipped\\s+' + escapeForRegExp(REQUIRED_CASE)).test(out);
    if (skipped) problems.push('the load-time refusal case is SKIPPED');
    else if (!passed) problems.push('the load-time refusal case did not pass: "' + REQUIRED_CASE + '"');
    const summary = (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim();
    lines.push('refusal proven  ' + (passed ? 'yes' : 'NO') + ' · ' + summary);
  }

  lines.push('formats         adapter reads ' + JSON.stringify(installed.smartcard?.supportedPackFormats));

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
