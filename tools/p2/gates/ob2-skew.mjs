/**
 * GATE: ob2-skew — criterion C4.  →  `OB-2 OK — skew renders absent`
 *
 *   > **C4.** *"A cross-pack-set reference miss renders as **absent, never as an error**, proven at
 *   > **genuinely mixed pack versions** (`catalog` at one `packVersion`, `benefits` at a newer
 *   > one)."*
 *
 *   > **OB-2.** *"A device may hold `catalog` from Tuesday and `benefits` from Friday…
 *   > `minAppVersion` and `packFormatVersion` protect against **shape** mismatch; they say nothing
 *   > about **content** skew."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "GENUINELY MIXED" IS MEASURED FROM THE SHIPPED MANIFESTS
 *
 * Not staged, and not asserted in prose: the gate reads every bundled manifest's `packVersion` and
 * requires at least two distinct ones. The set really is mixed — `catalog` and `benefits` at
 * `2026.08.22+3`, `content` and `taxonomy` at `+2`, each signed at the version it carries — and if
 * a future rebuild made them uniform, this criterion would be proven against a state that no longer
 * exists, so the gate fails instead.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "NEVER AS AN ERROR" IS A SCAN, NOT A PROMISE
 *
 * The test proves the component renders `null`. That covers the component. What it cannot cover is
 * the next call site, where somebody wraps a resolution in a `try/catch` and renders "something
 * went wrong" — so the gate scans every file that touches a reference resolution for error, retry
 * and loading vocabulary sitting beside it.
 *
 * That is the failure mode OB-2 is actually about. Nobody sets out to report skew as an error; they
 * write a defensive `catch` around a lookup that used to throw, and the sentence a user reads is
 * "we could not load your benefits" when nothing failed at all.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['C4'];
export const SENTINEL = 'OB-2 OK — skew renders absent';

const PACKS_DIR = join('src', 'data', 'adapter', 'packs');
const RESOLVER = 'src/data/adapter/crossSet.ts';
const COMPONENT = 'src/components/CrossSetReference.tsx';
const SUITES = [
  ['src/data/adapter/__tests__/crossSetSkew.test.ts', [
    'the shipped pack sets really are at mixed versions — measured, not staged',
    'every benefits reference resolves against the catalog the device actually holds',
    'a card the older catalog does not carry resolves as ABSENT_IN_THIS_VERSION',
    'NEVER throws, whatever it is handed',
    'distinguishes a MALFORMED reference from a legal miss',
  ]],
  ['src/components/__tests__/CrossSetReference.render.test.tsx', [
    'renders the referent when it is present — the control',
    'renders NOTHING when the referent is absent in this version',
    'never renders the value when the state is not PRESENT',
  ]],
];

/**
 * The vocabulary that turns absence into a fault.
 *
 * Three languages, because the sentence a Hebrew reader sees is the one that matters to them — the
 * same reason the OB-3 gate checks all three.
 */
const ERROR_VOCABULARY = [
  [/\berror\b/i, 'en: "error"'],
  [/\bfailed\b|\bfailure\b/i, 'en: "failed"'],
  [/\bretry\b|\btry again\b/i, 'en: "retry"'],
  [/\bunavailable\b/i, 'en: "unavailable"'],
  [/\bloading\b|\bspinner\b/i, 'en: "loading"'],
  [/שגיאה/, 'he: "שגיאה" (error)'],
  [/נסה שוב/, 'he: "try again"'],
  [/טוען/, 'he: "loading"'],
  [/خطأ/, 'ar: "خطأ" (error)'],
  [/جاري التحميل/, 'ar: "loading"'],
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
const escapeForRegExp = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, String.fromCharCode(92) + '$&');

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  for (const rel of [RESOLVER, COMPONENT]) {
    if (!existsSync(join(root, rel))) {
      return fail(rel + ' does not exist. C4 is about what a miss RENDERS, and a criterion satisfied '
        + 'by the absence of a resolver would be satisfied by an app that resolves nothing');
    }
  }

  // ── genuinely mixed pack versions, measured ──────────────────────────────────────
  const base = join(root, PACKS_DIR);
  if (!existsSync(base)) return fail(PACKS_DIR + ' does not exist — there are no versions to be mixed');
  const sets = readdirSync(base).filter((e) => statSync(join(base, e)).isDirectory()).sort();
  const versions = [];
  for (const set of sets) {
    const p = join(base, set, 'manifest.json');
    if (!existsSync(p)) continue;
    const m = JSON.parse(readFileSync(p, 'utf8'));
    versions.push({ set, packVersion: m.packVersion ?? m.snapshotVersion ?? '(none)' });
  }
  const distinct = new Set(versions.map((v) => v.packVersion));
  if (versions.length === 0) return fail('no bundled manifest carries a version — nothing to compare');
  if (distinct.size < 2) {
    problems.push('every bundled artifact is at the same version (' + [...distinct][0] + '). C4 asks '
      + 'for GENUINELY MIXED pack versions, and a criterion proven against a mixed set that has '
      + 'since become uniform is proven against a state that no longer exists');
  }

  // ── the resolver cannot throw, structurally ──────────────────────────────────────
  const resolver = stripComments(readFileSync(join(root, RESOLVER), 'utf8'));
  if (/\bthrow\b/.test(resolver)) {
    problems.push(RESOLVER + ' contains a throw. OB-2 says a miss is an EXPECTED STATE, and a throw '
      + 'forces every caller to invent a policy — the policy invented under pressure is a catch '
      + 'that renders "something went wrong"');
  }
  for (const state of ['ABSENT_IN_THIS_VERSION', 'UNRESOLVABLE_REFERENCE', 'PRESENT']) {
    if (!resolver.includes(state)) problems.push(RESOLVER + ' does not declare the state ' + state);
  }

  // ── no error vocabulary beside a resolution ──────────────────────────────────────
  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('scanned 0 files — an empty population proves nothing');
  const touching = [];
  const offenders = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));
    if (!/ABSENT_IN_THIS_VERSION|ReferenceResolution|resolveReference|CrossSetReference/.test(code)) continue;
    touching.push(rel);
    for (const [re, label] of ERROR_VOCABULARY) {
      const m = re.exec(code);
      if (m) offenders.push({ file: rel, line: lineAt(code, m.index), label });
    }
  }
  if (touching.length === 0) {
    problems.push('no file references a cross-set resolution. The resolver exists and nothing uses '
      + 'it, so this gate would be reporting on a module that cannot affect what anybody sees');
  }
  for (const o of offenders.slice(0, 5)) {
    problems.push(o.file + ':' + o.line + ' carries ' + o.label + ' in a file that handles a '
      + 'cross-set reference. A device holding Tuesday\'s catalog beside Friday\'s benefits is '
      + 'WORKING CORRECTLY: there is nothing to report, nothing to retry, and nothing for a person '
      + 'to do');
  }

  // ── run both halves ──────────────────────────────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(jest)) return fail('no jest binary — none of this can be proven by running it');
  for (const [suite, cases] of SUITES) {
    if (!existsSync(join(root, suite))) { problems.push(suite + ' does not exist'); continue; }
    const r = spawnSync(process.execPath, [jest, suite, '--verbose', '--ci'], {
      cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    });
    const out = String(r.stdout ?? '') + String(r.stderr ?? '');
    for (const name of cases) {
      const passed = new RegExp('[√✓]\\s*' + escapeForRegExp(name)).test(out);
      const skipped = new RegExp('(○|skipped)\\s+' + escapeForRegExp(name)).test(out);
      if (skipped) problems.push('SKIPPED: "' + name + '"');
      else if (!passed) problems.push('did not pass: "' + name + '"');
    }
    lines.push('suite           ' + suite.split('/').pop() + ' · ' + (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim());
  }

  lines.push('versions        ' + distinct.size + ' distinct across ' + versions.length + ' artifact(s)');
  for (const v of versions) lines.push('  ' + v.set.padEnd(12) + v.packVersion);
  lines.push('resolver        ' + RESOLVER + ' · 3 states · no throw');
  lines.push('handled in      ' + touching.length + ' file(s) · ' + offenders.length + ' with error vocabulary');
  lines.push('                scanned in he · ar · en');
  lines.push('');
  lines.push('SKEW IS NOT A FAULT. It is the price of benefits.pack being republishable without');
  lines.push('  catalog.pack — the argument OD-17 accepted when it made G06b a parallel lane. A miss');
  lines.push('  renders as nothing, and the row around it is simply shorter.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
