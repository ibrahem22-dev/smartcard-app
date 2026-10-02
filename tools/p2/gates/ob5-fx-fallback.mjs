/**
 * GATE: ob5-fx-fallback — criterion C8.  →  `OB-5 OK — JPY control 934.85`
 *
 *   > **C8.** *"The bundled FX snapshot is used **only as a cold-start fallback**: manifest and
 *   > detached signature verified before any rate is read; the rate's own date always rendered,
 *   > never "today"; an undeclared `snapshotFormatVersion` refused; a currency the snapshot lacks
 *   > yields `COMPARISON_INCOMPLETE`, never zero; **nothing on the app side divides by
 *   > `quoteUnit`**."*
 *
 *   > **OB-5.** *"It exists so a device that has never been online can still compare a foreign
 *   > purchase. **It is not a rate feed.**"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE JPY CONTROL IS COMPUTED HERE, FROM THE ARTIFACT
 *
 * The gate reads the snapshot, takes JPY's `quoteUnit` and `rateIlsPerQuoteUnit`, and computes both
 * candidate answers for 50,000 JPY. The correct one must be **934.85** and the one that ignores the
 * unit must be **93,485.00** — a factor of one hundred, silently, which is the whole reason the two
 * fields may never be collapsed.
 *
 * Not read from the test's output: computed, here, so the sentinel is a measurement. If a
 * republished snapshot changed the rate, this gate would fail with the new figure rather than
 * quietly certifying a control that no longer holds.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "NOTHING ON THE APP SIDE DIVIDES BY `quoteUnit`" IS A SCAN
 *
 * The app ships no converter, because OD-23a puts the divide in the engine and the engine is P3.
 * So the gate looks for one: any division or multiplication involving `quoteUnit` outside a test.
 * A single such line is the 93,485 answer entering the product.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE FETCH LANE IS ABSENT ON PURPOSE, WHICH THIS GATE SAYS OUT LOUD
 *
 * OB-5's first obligation is to fetch live and use the bundle only until the first successful
 * fetch. The BOI client is P3 and this campaign is forbidden to build it. A gate that printed six
 * green obligations would be claiming a lane exists. Instead the report names the missing one, and
 * requires the code to carry `fallbackOnly` and `BUNDLED` through to every value — so a device can
 * tell it is on the fallback rather than being unable to.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['C8'];
export const SENTINEL = 'OB-5 OK';

const FX_DIR = join('src', 'data', 'adapter', 'packs', 'fx-rates');
const MODULE = 'src/data/adapter/fx.ts';
const SUITE = 'src/data/adapter/__tests__/fxColdStart.test.ts';

const REQUIRED_CASES = [
  ['50,000 JPY is 934.85 ILS — and 93,485.00 if the unit is ignored', 'the acceptance test'],
  ['offers NO per-one field a consumer could read instead', 'the structural half'],
  ['REFUSES a snapshotFormatVersion the adapter does not declare', 'a consumer written for 0 must not read 1'],
  ['REFUSES a manifest edited after signing', 'verify before reading a rate'],
  ['a weekend probe resolves to the previous publication, labelled with THAT date', "the rate's own date"],
  ['a currency the snapshot does not carry yields COMPARISON_INCOMPLETE', 'never zero'],
  ['asOf is an argument — this module never reads a clock', 'never "today"'],
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

  if (!existsSync(join(root, MODULE))) {
    return fail(MODULE + ' does not exist. C8 is about how the bundled snapshot is USED, and a '
      + 'criterion satisfied by never reading it would be satisfied by an app with no FX at all');
  }
  if (!existsSync(join(root, FX_DIR))) {
    return fail(FX_DIR + ' does not exist — there is no snapshot to control');
  }

  // ── the JPY control, computed here from the artifact ─────────────────────────────
  const require_ = createRequire(join(root, 'package.json'));
  let adapter;
  try {
    adapter = require_('@smartcard/data-authority-adapter');
  } catch (e) {
    return fail('the adapter will not load: ' + (e && e.message ? e.message : String(e)));
  }

  let slice;
  try {
    const opened = adapter.openVerifiedFxSnapshot({
      snapshotBytes: new Uint8Array(readFileSync(join(root, FX_DIR, 'snapshot.json'))),
      manifest: JSON.parse(readFileSync(join(root, FX_DIR, 'manifest.json'), 'utf8')),
      envelope: JSON.parse(readFileSync(join(root, FX_DIR, 'manifest.sig.json'), 'utf8')),
      trustStore: adapter.TRUST_STORE,
      expectedDatasetId: JSON.parse(readFileSync(join(root, FX_DIR, 'manifest.json'), 'utf8')).datasetId,
      appVersion: JSON.parse(readFileSync(join(root, 'identity.json'), 'utf8')).version,
      requireRelease: false,
    });
    slice = opened.slice;
  } catch (e) {
    return fail('the bundled snapshot does not open: ' + (e && e.message ? e.message : String(e))
      + '. OB-5 requires the manifest and detached signature verified BEFORE any rate is read, and '
      + 'this gate cannot control a snapshot the app itself would refuse');
  }

  const jpy = slice.rate('JPY');
  if (!jpy) {
    return fail('the snapshot carries no JPY rate. The JPY control is C8\'s acceptance test '
      + 'precisely because JPY is quoted per 100, and without it this gate would be certifying '
      + 'a control it did not run');
  }
  if (jpy.quoteUnit === 1) {
    problems.push('JPY is quoted per 1 in this snapshot. The control exists because it is quoted '
      + 'per 100: at a unit of 1 the two candidate answers are identical and the control proves '
      + 'nothing');
  }

  const AMOUNT = 50_000;
  const correct = ((AMOUNT / jpy.quoteUnit) * jpy.rateIlsPerQuoteUnit).toFixed(2);
  const ignoringUnit = (AMOUNT * jpy.rateIlsPerQuoteUnit).toFixed(2);
  if (correct !== '934.85' || ignoringUnit !== '93485.00') {
    problems.push('the JPY control does not hold: ' + AMOUNT + ' JPY computes to ' + correct
      + ' ILS with the unit and ' + ignoringUnit + ' without it. The contract names 934.85 and '
      + '93485.00 — a republished snapshot changed the rate, and the control must be re-derived '
      + 'rather than quietly certified');
  }

  // The per-one field the artifact must not carry.
  const forbidden = ['rateIls', 'rate', 'perOne', 'rateIlsPerUnit', 'ilsPerUnit', 'value'];
  const present = forbidden.filter((f) => Object.prototype.hasOwnProperty.call(jpy, f));
  for (const f of present) {
    problems.push('the rate object carries "' + f + '", a field a consumer could read instead of '
      + 'the pair. assertNoPerOneField exists so the wrong number is not obtainable by accident');
  }

  // ── nothing OUTSIDE THE ENGINE divides by quoteUnit ─────────────────────────────
  // P2's rule was "nothing on the app side": true then, because the divide belonged to a phase
  // that had not run. P3's X1 built it — OD-23b puts conversion in the ENGINE, and the engine is
  // the one module allowed to divide. The scan therefore polices every layer EXCEPT
  // src/engines/**, where tools/p3/gates/quote-unit.mjs requires exactly one dividing site.
  const files = walk(join(root, 'src')).filter((f) => !/[\\/]src[\\/]engines[\\/]/.test(f));
  if (files.length === 0) return fail('scanned 0 files — an empty population proves nothing');
  const converters = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));
    for (const m of code.matchAll(/[/*]\s*\w*\.?quoteUnit\b|\bquoteUnit\s*[*/]/g)) {
      converters.push({ file: rel, line: lineAt(code, m.index), text: m[0].trim() });
    }
  }
  for (const c of converters.slice(0, 4)) {
    problems.push(c.file + ':' + c.line + ' computes with quoteUnit ("' + c.text + '"). C8 says '
      + 'NOTHING ON THE APP SIDE DIVIDES BY quoteUnit: OD-23a puts the divide in the engine, the '
      + 'engine is P3, and a converter here is the 93,485 answer entering the product');
  }

  // ── the fallback is visible as a fallback ────────────────────────────────────────
  const moduleSource = stripComments(readFileSync(join(root, MODULE), 'utf8'));
  if (/new Date\s*\(\s*\)|Date\.now/.test(moduleSource)) {
    problems.push(MODULE + ' reads a clock. OB-5 requires the RATE\'S OWN DATE to be rendered, and '
      + 'a module that knows what today is will eventually label a Friday rate with a Sunday');
  }
  if (!/COMPARISON_INCOMPLETE/.test(moduleSource)) {
    problems.push(MODULE + ' never names COMPARISON_INCOMPLETE. OD-23b: a missing rate is a missing '
      + 'answer, not a free conversion');
  }
  for (const marker of ['fallbackOnly', 'BUNDLED']) {
    if (!new RegExp(marker).test(moduleSource)) {
      problems.push(MODULE + ' never mentions ' + marker + '. The live lane is P3 and absent, so the '
        + 'only thing that lets a device tell it is on the fallback is the artifact saying so');
    }
  }

  // ── run the suite ────────────────────────────────────────────────────────────────
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

  lines.push('snapshot        ' + slice.snapshotDate + ' · ' + slice.currencies.length + ' currencies');
  lines.push('JPY             quoteUnit ' + jpy.quoteUnit + ' · ' + jpy.rateIlsPerQuoteUnit + ' ILS per ' + jpy.quoteUnit + ' · ' + jpy.rateDate);
  lines.push('JPY control     ' + AMOUNT + ' JPY = ' + correct + ' ILS  ·  ' + ignoringUnit + ' if the unit is ignored');
  lines.push('per-one fields  ' + present.length + ' on the rate object — a consumer cannot obtain the wrong number by accident');
  lines.push('converters      ' + converters.length + ' site(s) computing with quoteUnit in ' + files.length + ' files');
  lines.push('');
  lines.push('THE LIVE LANE NOW EXISTS — BUILT BY P3 (handoff P3-1). This gate\'s original text');
  lines.push('  reported it absent because it was: the BOI client was P3\'s to build. It is built:');
  lines.push('  src/data/fx/** carries fetch, cache and lane, proven by tools/p3/gates/boi-*.mjs.');
  lines.push('  The converter scan above still polices every layer EXCEPT src/engines/**, where');
  lines.push('  OD-23b places the divide and tools/p3/gates/quote-unit.mjs requires exactly one site.');
  lines.push('');
  lines.push('AND THE HOLIDAY HALF IS UNPROVEN. The weekend half is proven on 84 real probes in P1');
  lines.push('  and re-measured here; a market holiday is P1_DEFERRED §2.11 and criterion C9.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'OB-5 OK — JPY control ' + correct,
  };
};
