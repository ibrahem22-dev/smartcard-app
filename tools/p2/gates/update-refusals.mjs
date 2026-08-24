/**
 * GATE: update-refusals — criterion C5.  →  `UPDATE-REFUSALS OK — 4 refusals, 2 constants compiled in`
 *
 *   > **C5.** *"The update client verifies signature, `minAppVersion` and `datasetId` **on device**,
 *   > with `EXPECTED_DATASET_ID` and the trust store **compiled in** and **provably not loadable
 *   > from a pack**; a `smartcard-canonical-v1` pack is refused; `DATASET_ID_REFUSED` is reported
 *   > **distinctly** from a signature failure."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "PROVABLY NOT LOADABLE FROM A PACK" IS THE HARD HALF
 *
 * A test can show that a hostile manifest carrying its own `expectedDatasetId` and `trustStore`
 * changes nothing — and it does, and this gate requires that test to pass. But a test only covers
 * the path it walks. The structural half is what makes the claim general:
 *
 *   · `checkUpdate` takes **one argument**. There is no options object, so there is no field a
 *     caller could set and no field a pack could populate.
 *   · The constants are **module-level `const`s**, not parameters with defaults. A default is a
 *     value somebody can override at a call site nobody reviewed.
 *   · **Nothing anywhere assigns them from parsed content.** The gate scans for an assignment whose
 *     right-hand side comes from a manifest, a `JSON.parse`, or anything named like a pack.
 *
 * That third check is the one a code review misses, because the dangerous line looks ordinary:
 * `const trustStore = manifest.trustStore ?? TRUST_STORE;`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE FOUR REFUSALS ARE COUNTED FROM THE CODE, NOT FROM THE SENTINEL
 *
 * The contract's sentinel says four. This gate reads `UPDATE_REFUSAL_CODES` out of the module and
 * requires the suite to have DRIVEN each one — a code nobody can produce is a code that describes
 * an intention, and a fifth added without a fifth test fails here rather than passing quietly.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['C5'];
export const SENTINEL = 'UPDATE-REFUSALS OK — 4 refusals, 2 constants compiled in';

const CLIENT = 'src/data/adapter/import/updateClient.ts';
const CONSTANTS = 'src/data/adapter/import/packSetImport.ts';
const SUITE = 'src/data/adapter/import/__tests__/updateRefusals.test.ts';

const REQUIRED_CASES = [
  ['accepts the real pack — the control that keeps the four refusals honest',
    'without it every refusal below passes against a client that refuses everything'],
  ['REFUSES a smartcard-canonical-v1 pack — the previous estate generation', 'C5 names this case'],
  ['reports DATASET_ID_REFUSED DISTINCTLY from a signature failure', 'the obligation itself'],
  ['REFUSES a pack whose minAppVersion is above this build, and says to update the app', 'minAppVersion'],
  ['REFUSES a pack format this adapter build cannot read', 'shape skew'],
  ['REFUSES an altered pack as a possible tampering, and says not to retry', 'signature'],
  ['every declared refusal code is reachable — none is decoration', 'no code is decoration'],
  ['a pack carrying its OWN datasetId and trustStore fields changes neither', 'not loadable from a pack'],
];

/** The two constants C5 names. */
const COMPILED_CONSTANTS = ['expectedDatasetId', 'trustStore'];

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

  for (const rel of [CLIENT, CONSTANTS, SUITE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist');
  }

  // ── the four codes, read from the module ─────────────────────────────────────────
  const client = stripComments(readFileSync(join(root, CLIENT), 'utf8'));
  const listed = (client.match(/UPDATE_REFUSAL_CODES[^=]*=\s*\[([^\]]*)\]/) ?? [])[1];
  if (!listed) {
    return fail(CLIENT + ' exports no UPDATE_REFUSAL_CODES list. The count in the sentinel would '
      + 'then be a number this gate took on trust, which is the thing it exists not to do');
  }
  const codes = [...listed.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  if (codes.length === 0) return fail('UPDATE_REFUSAL_CODES is empty — a client with no refusals refuses nothing');
  if (codes.length !== 4) {
    problems.push('the client declares ' + codes.length + ' refusal code(s) and the contract\'s '
      + 'sentinel says four: ' + codes.join(', ') + '. Either a refusal was added without the '
      + 'contract noticing, or one was removed');
  }
  for (const required of ['DATASET_ID_REFUSED', 'SIGNATURE_REFUSED']) {
    if (!codes.includes(required)) problems.push('C5 names ' + required + ' and the client does not declare it');
  }

  // ── the constants: compiled in, and no argument for them ─────────────────────────
  const constants = stripComments(readFileSync(join(root, CONSTANTS), 'utf8'));
  const compiled = (constants.match(/COMPILED_IN\s*=\s*\{([\s\S]*?)\}\s*as const/) ?? [])[1] ?? '';
  for (const name of COMPILED_CONSTANTS) {
    if (!new RegExp('\\b' + name + '\\s*:').test(compiled)) {
      problems.push('COMPILED_IN does not carry ' + name + ' — C5 names both constants, and one '
        + 'compiled in beside one passed as an argument is not two compiled in');
    }
  }

  // The signature is the structural enforcement: one argument, nowhere to pass an override.
  const signature = (client.match(/export function checkUpdate\(([^)]*)\)/) ?? [])[1] ?? '';
  const params = signature.split(',').map((s) => s.trim()).filter(Boolean);
  if (params.length !== 1) {
    problems.push('checkUpdate takes ' + params.length + ' parameter(s). C5 requires the constants '
      + 'to be COMPILED IN: a second parameter is a place a caller can pass an override, and an '
      + 'override is a value a pack can eventually reach');
  }

  // ── nothing assigns either constant from parsed content ──────────────────────────
  //
  // The dangerous line looks ordinary: `const trustStore = manifest.trustStore ?? TRUST_STORE;`
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files — an empty population proves nothing');
  const loadable = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));
    for (const name of COMPILED_CONSTANTS) {
      const re = new RegExp('\\b' + name + '\\s*[:=]\\s*[^,;\\n]*\\b(manifest|pack|payload|JSON\\.parse|body|response)\\b', 'g');
      for (const m of code.matchAll(re)) {
        loadable.push({ file: rel, line: lineAt(code, m.index), name, text: m[0].trim().slice(0, 80) });
      }
    }
  }
  for (const l of loadable.slice(0, 4)) {
    problems.push(l.file + ':' + l.line + ' assigns ' + l.name + ' from parsed content: "' + l.text
      + '". C5 requires it PROVABLY NOT LOADABLE FROM A PACK — a constant a pack can influence is '
      + 'not a check, and a trust store a pack could supply answers "is this signed by whoever '
      + 'signed it?"');
  }

  // ── run the suite ────────────────────────────────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(jest)) return fail('no jest binary — none of this can be proven by running it');
  const r = spawnSync(process.execPath, [jest, SUITE, '--verbose', '--ci'], {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  const out = String(r.stdout ?? '') + String(r.stderr ?? '');
  for (const [name, why] of REQUIRED_CASES) {
    const passed = new RegExp('[√✓]\\s*' + escapeForRegExp(name)).test(out);
    const skipped = new RegExp('(○|skipped)\\s+' + escapeForRegExp(name)).test(out);
    if (skipped) problems.push('SKIPPED: "' + name + '" (' + why + ')');
    else if (!passed) problems.push('did not pass: "' + name + '" (' + why + ')');
  }

  lines.push('refusals        ' + codes.length + ' declared, each driven by a real input');
  for (const c of codes) lines.push('  ' + c);
  lines.push('constants       ' + COMPILED_CONSTANTS.length + ' compiled in · checkUpdate takes '
    + params.length + ' argument, so there is nowhere to pass an override');
  lines.push('not loadable    ' + loadable.length + ' assignment(s) from parsed content in ' + files.length + ' files');
  lines.push('suite           ' + (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim());
  lines.push('');
  lines.push('THE FOUR CODES EXIST BECAUSE THEY HAVE FOUR DIFFERENT FIXES. Collapsing "this is not our');
  lines.push('  data" or "your app is too old" into "this may have been altered" sends somebody');
  lines.push('  hunting for corruption that is not there — and teaches them that tampering warnings');
  lines.push('  are routine, which is how a device eventually accepts a forged pack.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
