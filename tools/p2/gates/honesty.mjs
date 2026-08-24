/**
 * GATE: honesty — criterion E4, ladder rung L10.  →  `HONESTY OK — 4 properties`
 *
 *   > **E4.** *"**Honesty tests (L10) pass on every P2-owned surface:** no unlabelled number;
 *   > "Verified" never on a derived figure; UNKNOWN stacking never sums; a preserved conflict shows
 *   > both values."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THREE OF THE FOUR ARE PROPERTIES OF A VALUE, AND ONE IS A PROPERTY OF A FILE
 *
 * "Does this number carry a label" is a question about what a surface was handed, so it is a
 * predicate driven by tests over the real vocabulary — the contract's four provenance chips, not a
 * set invented for the occasion.
 *
 * The fourth thing a scanner IS good at is finding a surface that renders a raw number without
 * going through any of them. So the gate does both: it runs the property suite and reads its
 * output, and it scans every P2-owned surface for a bare numeric interpolation.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "EVERY P2-OWNED SURFACE" IS DERIVED, NOT LISTED
 *
 * The population is every `.tsx` under `src/components/**` and `src/screens/**` — the files that
 * render. A hand-written list of surfaces is the defect this campaign has found four times: correct
 * on the day it is written, and silent about the fifth screen somebody adds.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE FAILURE THESE PREVENT LOOKS LIKE
 *
 * Not a wrong number. **A true one, presented as more certain than it is.** A figure with no unit;
 * a computed total wearing the badge that means somebody checked it; a sum that treats "we do not
 * know" as zero; a disagreement shown as one number. Every one renders perfectly.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['E4'];
export const SENTINEL = 'HONESTY OK — 4 properties';

const MODULE = 'src/authority/honesty.ts';
const SUITE = 'src/authority/__tests__/honesty.test.ts';
const SURFACE_DIRS = ['src/components', 'src/screens'];

/** One named case per property, so a property losing its test is a failure rather than a silence. */
const REQUIRED_CASES = [
  ['REFUSES a bare number', 'no unlabelled number'],
  ['REFUSES it the moment the figure is derived', '"Verified" never on a derived figure'],
  ['REFUSES to sum when one value is unknown, and says how many', 'UNKNOWN stacking never sums'],
  ['REFUSES a render that dropped one', 'a preserved conflict shows both values'],
  // The controls. Every "REFUSES" above would pass against a predicate that refused everything.
  ['ACCEPTS a number carrying its unit and what it is of', 'control for property 1'],
  ['ACCEPTS a VERIFIED chip on a figure read straight from the estate', 'control for property 2'],
  ['SUMS when every value is known — the control', 'control for property 3'],
  ['ACCEPTS a render that kept every candidate', 'control for property 4'],
];

const walk = (dir, acc = []) => {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__') walk(p, acc); }
    else if (/\.tsx$/.test(e)) acc.push(p);
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

  if (!existsSync(join(root, MODULE))) {
    return fail(MODULE + ' does not exist. E4 names four properties, and a criterion satisfied by '
      + 'having none of them would be satisfied by an app that renders nothing');
  }

  // ── the four are declared, and counted from the code ─────────────────────────────
  const source = stripComments(readFileSync(join(root, MODULE), 'utf8'));
  const declared = (source.match(/HONESTY_PROPERTIES[^=]*=\s*\[([\s\S]*?)\]/) ?? [])[1] ?? '';
  const properties = (declared.match(/'[^']+'/g) ?? []).map((s) => s.replace(/'/g, ''));
  if (properties.length !== 4) {
    problems.push('the module declares ' + properties.length + ' propert(ies) and E4 names four: '
      + properties.join(' · ') + '. The sentinel says four, and a sentinel counting something other '
      + 'than what the code declares is a number nobody checked');
  }

  // ── the surfaces, derived ────────────────────────────────────────────────────────
  const surfaces = SURFACE_DIRS.flatMap((d) => walk(join(root, d)));
  if (surfaces.length === 0) {
    return fail('no surface found under ' + SURFACE_DIRS.join(' or ') + ' — an empty population '
      + 'would let this gate report "0 unlabelled numbers" for an app with no screens');
  }

  /**
   * A bare numeric interpolation in JSX: `{1.75}`, `{total}` where total is arithmetic, `{x + y}`.
   *
   * Deliberately narrow — a formatter call, a translated string, a testID and a style value are all
   * ordinary. What this looks for is a NUMBER reaching the tree with nothing attached to it.
   */
  const bare = [];
  for (const abs of surfaces) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));
    // Only inside JSX text position: `>{ ... }<`
    for (const m of code.matchAll(/>\s*\{([^{}]+)\}\s*</g)) {
      const expr = m[1].trim();
      if (!/^[\d\s+\-*/.()]+$/.test(expr) && !/^[\w.]+\s*[+\-*/]\s*[\w.]+$/.test(expr)) continue;
      if (/^['"`]/.test(expr)) continue;
      bare.push({ file: rel, line: lineAt(code, m.index), expr: expr.slice(0, 40) });
    }
  }
  for (const b of bare.slice(0, 5)) {
    problems.push(b.file + ':' + b.line + ' renders a bare number: {' + b.expr + '}. A figure with '
      + 'no unit is either a percentage, a fee in shekels or a number of days, and the reader has '
      + 'to guess which');
  }

  // ── run the properties ───────────────────────────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(join(root, SUITE))) problems.push(SUITE + ' does not exist');
  else if (!existsSync(jest)) problems.push('no jest binary');
  else {
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
    lines.push('suite           ' + (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim());
  }

  lines.push('properties      ' + properties.length + ', declared in ' + MODULE);
  for (const p of properties) lines.push('  ' + p);
  lines.push('surfaces        ' + surfaces.length + ' rendering file(s) under ' + SURFACE_DIRS.join(', '));
  lines.push('bare numbers    ' + bare.length + ' interpolation(s) with nothing attached');
  lines.push('');
  lines.push('THE FAILURE THESE PREVENT IS NOT A WRONG NUMBER. It is a TRUE one presented as more');
  lines.push('  certain than it is: a figure with no unit, a computed total wearing the badge that');
  lines.push('  means somebody checked it, a sum that treats "we do not know" as zero, a');
  lines.push('  disagreement shown as one number. Every one of them renders perfectly.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
