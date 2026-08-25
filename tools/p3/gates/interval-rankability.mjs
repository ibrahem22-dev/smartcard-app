/**
 * GATE: interval-rankability — criterion K3.  →  `INTERVAL-RANKABILITY OK`
 *
 *   > **K3.** *"`intervalRankability` is consumed from the adapter and never recomputed."*
 *
 * Handoff §3 row 4: *"**Not yet consumed anywhere** — `rankab` appears 0 times in the app's source
 * — and never computed. `ob3-ob6-prohibitions` refuses a local classifier, so **the first consumer
 * must be the adapter's**."* P3 is the phase that changes that row, and this gate is what holds it
 * changed.
 *
 * THE CHAIN, AND WHO OWNS EACH LINK
 *
 *   pipeline build-time gate  →  stamps `disagreementAxis` into records at republication
 *   adapter                   →  `intervalRankabilityOf` reads those axes, exports the verdict
 *   app seam                  →  `src/data/adapter/conflictRender.ts` re-exposes THAT function
 *   everything else           →  asks the seam, or an adapter-produced value; computes nothing
 *
 * FOUR CHECKS
 *
 *   1. The seam REALLY consumes the adapter: it imports `intervalRankabilityOf` from
 *      `@smartcard/data-authority-adapter` and calls it. A seam that merely mentions the name would
 *      make this criterion a decoration.
 *   2. The pinned adapter build actually declares the export — so a future pin bump cannot drop
 *      the symbol while this gate keeps printing its sentinel against a stale memory of the API.
 *   3. No module outside the seam imports rankability vocabulary straight from the adapter package:
 *      one consumption point, or the point stops being one.
 *   4. No classifier shape anywhere in src/ — nothing derives a rankability or writes an axis.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['K3'];
export const SENTINEL = 'INTERVAL-RANKABILITY OK';

const SEAM = 'src/data/adapter/conflictRender.ts';
const PACKAGE = '@smartcard/data-authority-adapter';

const RANKABILITY = [
  'RANKABLE',
  'NOT_RANKABLE_NO_ENUMERABLE_CANDIDATES',
  'NOT_RANKABLE_SCOPE_DISAGREEMENT',
  'NOT_RANKABLE_AXIS_NOT_CLASSIFIED',
];

const CLASSIFIER_SHAPES = [
  [/\bdisagreementAxis\s*[:=](?!=)/g, 'assigns disagreementAxis — only the pipeline build-time gate may write it'],
  [/\bfunction\s+\w*(classifyAxis|classifyDisagreement|deriveAxis|computeAxis)\w*\s*\(/g, 'defines an axis classifier'],
  [/\bintervalRankability\s*[:=](?!=)\s*['"`]/g, 'assigns an intervalRankability from a literal'],
  [/\bfunction\s+\w*(computeRankability|deriveRankability|rankConflict)\w*\s*\(/g, 'computes a rankability'],
];

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

/** The rankability symbols a file could import to bypass the seam. */
const importsFromPackage = (code) =>
  new RegExp("from\\s+['\"]" + PACKAGE.replace('/', '\\/') + "['\"]").test(code)
  && /intervalRankability/i.test(code);

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  // ── 1. the seam consumes the adapter, really ─────────────────────────────────────
  const seamPath = join(root, SEAM);
  if (!existsSync(seamPath)) return fail(SEAM + ' does not exist — the consumption point has no home');
  const seamSrc = readFileSync(seamPath, 'utf8');
  const seamCode = stripComments(seamSrc);
  const importsIt = new RegExp("import\\s*\\{[^}]*\\bintervalRankabilityOf\\b[^}]*\\}\\s*from\\s*['\"]"
    + PACKAGE.replace('/', '\\/') + "['\"]").test(seamCode);
  const callsIt = /\bintervalRankabilityOf\s*\(/.test(seamCode);
  if (!importsIt) {
    problems.push(SEAM + ' does not import intervalRankabilityOf from ' + PACKAGE
      + '. K3: the first consumer must be the adapter\'s — a seam that names the concept without '
      + 'consuming it is the handoff\'s "not yet consumed anywhere" wearing a comment');
  }
  if (!callsIt) {
    problems.push(SEAM + ' imports intervalRankabilityOf but never calls it — a consumption '
      + 'point nobody consumes is a vacuous pass');
  }
  lines.push('seam            ' + SEAM + ': '
    + (importsIt ? 'imports' : 'does NOT import') + ' intervalRankabilityOf from the adapter'
    + (callsIt ? ', calls it' : ', NEVER calls it'));

  // ── 2. the pinned build still declares the export ────────────────────────────────
  let declared = null;
  const pkgDir = join(root, 'node_modules', ...PACKAGE.split('/'));
  if (!existsSync(pkgDir)) {
    problems.push(PACKAGE + ' is not installed under node_modules — the seam imports a package that is not there');
  } else {
    const dts = [];
    const walkDts = (dir) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walkDts(p);
        else if (p.endsWith('.d.ts')) dts.push(p);
      }
    };
    walkDts(pkgDir);
    declared = dts.some((p) => /\bintervalRankabilityOf\b/.test(readFileSync(p, 'utf8')));
    if (!declared) {
      problems.push('no .d.ts under the installed ' + PACKAGE + ' declares intervalRankabilityOf — '
        + 'the pinned build does not export what the seam consumes');
    }
    lines.push('adapter         installed build ' + (declared ? 'declares' : 'does NOT declare')
      + ' intervalRankabilityOf (' + dts.length + ' declaration files inspected)');
  }

  // ── 3. one consumption point: nothing else imports the vocabulary from the package ──
  // ── 4. and nothing anywhere classifies ────────────────────────────────────────
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files under src/ — an empty population proves nothing');
  let bypasses = 0;
  let classifiers = 0;
  let consumers = 0;
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));

    if (rel !== SEAM.replace(/\\/g, '/') && importsFromPackage(code)) {
      bypasses += 1;
      problems.push(rel + ':' + lineAt(code, code.search(/intervalRankability/i)) + ' reaches '
        + PACKAGE + ' for rankability vocabulary outside the seam. One consumption point, or the '
        + 'point stops being one (K3; D2\'s boundary discipline applied to this interface)');
    }

    for (const [re, what] of CLASSIFIER_SHAPES) {
      for (const m of code.matchAll(re)) {
        classifiers += 1;
        problems.push(rel + ':' + lineAt(code, m.index) + ' ' + what + '. The adapter decides '
          + 'rankability from axes the pipeline classified; recomputing it here is the local '
          + 'classifier OB-6 forbids');
      }
    }

    if (/intervalRankability/i.test(code)) consumers += 1;
  }
  lines.push('population      ' + files.length + ' file(s): ' + bypasses + ' package bypass(es), '
    + classifiers + ' classifier shape(s), ' + consumers + ' file(s) touching rankability');

  if (consumers === 0) {
    problems.push('0 files touch rankability — K3 says CONSUMED, not merely permitted. The seam must '
      + 'exist and something must reach rankability through it, or the handoff row did not move');
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
