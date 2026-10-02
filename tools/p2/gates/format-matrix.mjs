/**
 * GATE: format-matrix — criterion C6.  →  `FORMAT-MATRIX OK`
 *
 *   > **C6.** *"Shape skew is refused: the adapter ↔ `packFormatVersion` matrix is enforced **at
 *   > load**, proven by a **load-time rejection of an incompatible pair**."*
 *
 * And Gate 7's first condition, which this gate is also the evidence for:
 *
 *   > *"The app reads **the real packs** through the adapter **at their measured shas** · load-time
 *   > rejection of an incompatible pair **proven**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "PROVEN" MEANS THE SUITE RAN AND THIS GATE WATCHED IT
 *
 * The rejection cannot be established by reading source. So the gate RUNS the two suites and reads
 * their printed output, requiring the named cases to have passed and not to have been skipped —
 * the same discipline `override-wins` uses, and for the same reason: a gate that checked for a
 * filename would pass over a suite somebody had disabled.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND IT MEASURES THE ARTIFACTS ITSELF, rather than trusting the suite to have looked
 *
 * Every bundled manifest's declared format is compared against what the adapter says it supports,
 * and the shas of every file are re-hashed against `PACK_SHAS.json`. That is what makes "at their
 * measured shas" a measurement: the gate hashes the bytes, here, now.
 *
 * REFUSES a population of zero. Five artifacts ship; a gate that reported "0 packs, 0 skews
 * accepted" would be the vacuous pass this campaign has already found four of.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['C6'];
export const SENTINEL = 'FORMAT-MATRIX OK';

const PACKS_DIR = join('src', 'data', 'adapter', 'packs');
const SHAS = join(PACKS_DIR, 'PACK_SHAS.json');

/** The suites, and the cases each must have RUN AND PASSED. Named, so a rename is a failure. */
const REQUIRED_CASES = [
  ['src/data/adapter/__tests__/formatMatrix.test.ts', [
    'is REFUSED at load when its packFormatVersion is one the adapter cannot read',
    'names the format, not the signature, when both are wrong',
    'REFUSES a pack claiming a format below the matrix as well as above it',
    'the FX snapshot has its OWN format axis, and it is enforced too',
    'accepts every real artifact when nothing is skewed — the control that keeps the rest honest',
  ]],
  ['src/data/adapter/__tests__/realPacks.test.ts', [
    'every real pack set VERIFIES end to end',
    'the bytes it reads are the bytes that were measured',
    'this app is at or above the version every bundled artifact requires',
  ]],
];

const escapeForRegExp = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, String.fromCharCode(92) + '$&');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  // ── the adapter's own answer about what it can read ──────────────────────────────
  const require_ = createRequire(join(root, 'package.json'));
  let adapter;
  try {
    adapter = require_('@smartcard/data-authority-adapter');
  } catch (e) {
    return fail('the adapter package will not load: ' + (e && e.message ? e.message : String(e)));
  }
  const supportedPacks = adapter.supportedPackFormats();
  const supportedSnapshots = adapter.supportedSnapshotFormats();
  const matrixRows = adapter.COMPATIBILITY_MATRIX.map((r) => r.packFormatVersion);

  if (supportedPacks.length === 0) {
    return fail('the adapter declares zero readable pack formats — a matrix that admits nothing '
      + 'refuses everything, and every "refused" assertion below would pass for the wrong reason');
  }
  // Two homes for one fact inside the adapter. A format it claims to read with no row to decide it
  // is a load-time check with nothing behind it.
  const claimedNotInMatrix = supportedPacks.filter((f) => !matrixRows.includes(f));
  const inMatrixNotClaimed = matrixRows.filter((f) => !supportedPacks.includes(f));
  for (const f of claimedNotInMatrix) {
    problems.push('the adapter says it reads packFormatVersion ' + f + ' and the compatibility '
      + 'matrix has no row for it — a load-time check with nothing behind it');
  }
  for (const f of inMatrixNotClaimed) {
    problems.push('the compatibility matrix carries a row for packFormatVersion ' + f
      + ' and the adapter does not claim to read it');
  }

  // ── the artifacts that actually ship ─────────────────────────────────────────────
  const base = join(root, PACKS_DIR);
  if (!existsSync(base)) {
    return fail(PACKS_DIR + ' does not exist. Gate 7 asks the app to read THE REAL PACKS, and there '
      + 'are none — run campaign-p2/bin/p2-pack-shas.mjs in the pipeline repository');
  }
  const sets = readdirSync(base).filter((e) => statSync(join(base, e)).isDirectory()).sort();
  if (sets.length === 0) return fail(PACKS_DIR + ' holds no artifact — an empty population proves nothing');

  const packs = [];
  const snapshots = [];
  const unclassified = [];
  for (const set of sets) {
    const manifestPath = join(base, set, 'manifest.json');
    if (!existsSync(manifestPath)) { unclassified.push(set + ' (no manifest.json)'); continue; }
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const isPack = typeof m.packFormatVersion === 'number';
    const isSnapshot = typeof m.snapshotFormatVersion === 'number';
    if (isPack === isSnapshot) { unclassified.push(set); continue; }
    (isPack ? packs : snapshots).push({ set, manifest: m });
  }
  for (const u of unclassified) {
    problems.push(u + ' declares neither exactly one of packFormatVersion nor snapshotFormatVersion '
      + '— nothing decides which verifier reads it');
  }
  if (packs.length === 0) {
    problems.push('no bundled artifact is a pack. C6 is about the pack format axis and there is '
      + 'nothing on it, so every assertion about refusing a skew would be vacuous');
  }

  for (const { set, manifest } of packs) {
    if (!supportedPacks.includes(manifest.packFormatVersion)) {
      problems.push(set + ' declares packFormatVersion ' + manifest.packFormatVersion
        + ' and the adapter reads ' + JSON.stringify(supportedPacks)
        + ' — the app ships a pack its own build refuses at load');
    }
  }
  for (const { set, manifest } of snapshots) {
    if (!supportedSnapshots.includes(manifest.snapshotFormatVersion)) {
      problems.push(set + ' declares snapshotFormatVersion ' + manifest.snapshotFormatVersion
        + ' and the adapter reads ' + JSON.stringify(supportedSnapshots));
    }
  }

  // ── the app version against the floor the artifacts demand ───────────────────────
  const appVersion = JSON.parse(readFileSync(join(root, 'identity.json'), 'utf8')).version;
  const parse = (v) => String(v).split('.').map((n) => Number.parseInt(n, 10) || 0);
  const below = (a, b) => {
    const [x, y] = [parse(a), parse(b)];
    for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
      if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
    }
    return false;
  };
  let floor = '0.0.0';
  let requiredBy = '(nothing)';
  for (const { set, manifest } of [...packs, ...snapshots]) {
    if (typeof manifest.minAppVersion === 'string' && below(floor, manifest.minAppVersion)) {
      floor = manifest.minAppVersion;
      requiredBy = set;
    }
  }
  if (below(appVersion, floor)) {
    problems.push('this app declares version ' + appVersion + ' and ' + requiredBy + ' requires '
      + floor + '. The adapter enforces minAppVersion AT LOAD, so the app ships an artifact it '
      + 'refuses to open — and the FX snapshot is the one a cold start with no network depends on');
  }

  // ── the shas, re-hashed here ─────────────────────────────────────────────────────
  if (!existsSync(join(root, SHAS))) {
    problems.push(SHAS + ' is missing — "at their measured shas" has nothing to measure against');
  } else {
    const recorded = JSON.parse(readFileSync(join(root, SHAS), 'utf8')).sets;
    let hashed = 0;
    let wrong = 0;
    for (const s of recorded) {
      for (const f of s.files) {
        const p = join(base, s.set, f.file);
        if (!existsSync(p)) { problems.push(s.set + '/' + f.file + ' is recorded and absent'); continue; }
        hashed += 1;
        if (sha256(readFileSync(p)) !== f.sha256) {
          wrong += 1;
          problems.push(s.set + '/' + f.file + ' does not hash to its recorded sha — the bytes on '
            + 'disk are not the bytes the pipeline built');
        }
      }
    }
    if (hashed === 0) problems.push('PACK_SHAS.json records no file — an empty manifest is not a measurement');
    lines.push('shas            ' + hashed + ' file(s) re-hashed here · ' + wrong + ' disagreed');
  }

  // ── the refusal, proven by running it ────────────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(jest)) {
    problems.push('no jest binary — the load-time rejection cannot be proven by running it');
  } else {
    for (const [file, cases] of REQUIRED_CASES) {
      if (!existsSync(join(root, file))) { problems.push(file + ' does not exist'); continue; }
      const r = spawnSync(process.execPath, [jest, file, '--verbose', '--ci'], {
        cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
      });
      const out = String(r.stdout ?? '') + String(r.stderr ?? '');
      for (const name of cases) {
        const passed = new RegExp('[√✓]\\s*' + escapeForRegExp(name)).test(out);
        const skipped = new RegExp('skipped\\s+' + escapeForRegExp(name)).test(out);
        if (skipped) problems.push('SKIPPED in ' + file + ': "' + name + '"');
        else if (!passed) problems.push('did not pass in ' + file + ': "' + name + '"');
      }
      const summary = (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim();
      lines.push('suite           ' + file.replace('src/data/adapter/__tests__/', '') + ' · ' + summary);
    }
  }

  lines.push('adapter reads   packs ' + JSON.stringify(supportedPacks) + ' · snapshots ' + JSON.stringify(supportedSnapshots));
  lines.push('matrix rows     ' + JSON.stringify(matrixRows) + ' — same fact, both homes compared');
  lines.push('bundled         ' + packs.length + ' pack(s) · ' + snapshots.length + ' snapshot(s) · '
    + unclassified.length + ' unclassified');
  for (const { set, manifest } of packs) {
    lines.push('  ' + set.padEnd(12) + 'packFormatVersion ' + manifest.packFormatVersion
      + ' · packVersion ' + manifest.packVersion + ' · minApp ' + manifest.minAppVersion);
  }
  for (const { set, manifest } of snapshots) {
    lines.push('  ' + set.padEnd(12) + 'snapshotFormatVersion ' + manifest.snapshotFormatVersion
      + ' · snapshotVersion ' + manifest.snapshotVersion + ' · minApp ' + manifest.minAppVersion);
  }
  lines.push('app version     ' + appVersion + ' · floor ' + floor + ' required by ' + requiredBy);

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
