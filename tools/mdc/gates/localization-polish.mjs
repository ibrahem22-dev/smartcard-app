/**
 * GATE: localization-polish — criterion T7.  →  `LOCALIZATION-POLISH OK`
 *
 *   > **T7.** *"LOCALIZATION POLISH: the he/ar/en microcopy register pass is complete; translation
 *   > readers handle every key/value form the app writes; no raw enum or key name reaches any
 *   > surface in any locale"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE MAPS ARE LOADED, NOT MATCHED
 *
 * Every earlier reader of `src/i18n/*.ts` counted entries with a line-anchored regular expression.
 * That is how a count goes quietly wrong: 85 entries in `en.ts` put key and value on different
 * lines, because a long English sentence does not fit beside a long Hebrew one, and a line-anchored
 * pattern cannot read a pair it has to cross a newline to see. The app also writes 93 of `ar.ts`'s
 * keys UNQUOTED — Hebrew letters are legal identifier characters — and many of `en.ts`'s values as
 * references into the `en` object rather than as literals. Those are the "key/value forms the app
 * writes" that T7's middle clause is about, and a reader that handles only one of them reports a
 * smaller number without ever failing.
 *
 * So `lib/i18n-load.mjs` transpiles each module and evaluates it in a sandbox with no `require`,
 * no `process` and no filesystem. What comes back is the object the APP sees. Measured against the
 * regex this replaces: 720 real entries in `en.ts` where a naive key pattern reports 917, because
 * it also sweeps up the nested legacy `en` object in the same file and counts two maps as one.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE DECLARED CONTROL
 *
 * T7 declares `deleted-ar-key`: *"delete one Arabic key"*, expecting *"the three-language clause
 * fails on the missing key, not silently"*. Clause 1 is that clause. It compares KEY SETS rather
 * than counts, and names the missing key, because two maps can have equal totals and disagree.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY A RENDER SWEEP IS PART OF THIS AND NOT A NICETY
 *
 * The defect T7 retires could not be seen from any call site. `CardsScreen` renders
 * `t(viewModel.body)`, and the placeholder lived in `cardsEmptyState.ts` as DATA. `interpolate()`
 * returns the source unchanged when no values are given, so the characters `{{app}}` reached the
 * reader in all three languages. C9's device capture 08 recorded it and no gate did, because every
 * audit here reads `t('…literal…')` call sites and there is no literal at that one to read.
 * Clause 5 therefore asserts the TEXT THAT RENDERS, per language, from the real screens.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';
import { loadTranslationMaps } from '../lib/i18n-load.mjs';

export const SENTINEL = 'LOCALIZATION-POLISH OK';
export const FAILURE_SENTINEL = 'LOCALIZATION-POLISH FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const SURFACE_SUITE = 'src/screens/__tests__/localizationSurface.render.test.tsx';
const SURFACE_CASES = [
  'mounts screens in all three languages — and says how many, so a silent zero cannot pass',
  'renders no unresolved interpolation token, dotted key path, or raw enum',
  'renders the product name, not the characters {{app}}',
];

const PLACEHOLDER = /\{\{(\w+)\}\}/g;
const phOf = (s) => [...String(s).matchAll(PLACEHOLDER)].map((m) => m[1]);
const rel = (p) => relative(ROOT, p).split('\\').join('/');

const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__' && e !== '__snapshots__') walk(p, out); }
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
};

export const run = async () => {
  const problems = [];
  const clauses = [];

  const i18nDir = join(ROOT, 'src', 'i18n');
  if (!existsSync(i18nDir)) return fail('src/i18n does not exist — there is no register to audit');

  /* The maps, as objects. A module that stops evaluating as data fails here rather than silently
     being read as text by something less careful. */
  let maps;
  try {
    maps = loadTranslationMaps(ROOT);
  } catch (err) {
    return fail(`the translation maps could not be loaded as modules: ${err?.message ?? err}`);
  }
  const { enBySource, arBySource, translateHebrew } = maps;
  if (!enBySource || !arBySource) return fail('enBySource or arBySource is not exported — the register has changed shape');

  const enKeys = Object.keys(enBySource);
  const arKeys = Object.keys(arBySource);
  const enSet = new Set(enKeys);
  const arSet = new Set(arKeys);

  /* 1. THREE-LANGUAGE PARITY — the declared control's target.
        Key SETS, not counts: two maps can have equal totals and still disagree. */
  if (enKeys.length === 0 || arKeys.length === 0) {
    problems.push('a translation map is empty — parity over nothing is not parity');
  }
  const missingAr = enKeys.filter((k) => !arSet.has(k));
  const missingEn = arKeys.filter((k) => !enSet.has(k));
  if (missingAr.length > 0) {
    problems.push(
      `${missingAr.length} source string(s) have an English translation but NO ARABIC one: `
      + missingAr.slice(0, 3).map((k) => JSON.stringify(k.slice(0, 48))).join(', ')
      + (missingAr.length > 3 ? ` … and ${missingAr.length - 3} more` : ''),
    );
  }
  if (missingEn.length > 0) {
    problems.push(
      `${missingEn.length} source string(s) have an Arabic translation but NO ENGLISH one: `
      + missingEn.slice(0, 3).map((k) => JSON.stringify(k.slice(0, 48))).join(', ')
      + (missingEn.length > 3 ? ` … and ${missingEn.length - 3} more` : ''),
    );
  }
  clauses.push(`he/en/ar parity over ${enKeys.length} source string(s), key sets identical`);

  /* 2. EVERY VALUE IS A NON-EMPTY STRING. T7's middle clause, at the value end: `en.ts` writes many
        values as references into another object, and a reference that stops resolving yields
        `undefined` — which `t()` would hand to a reader as the word "undefined". */
  const badValues = [];
  for (const [name, map] of [['en', enBySource], ['ar', arBySource]]) {
    for (const [k, v] of Object.entries(map)) {
      if (typeof v !== 'string') badValues.push(`${name}: ${JSON.stringify(k.slice(0, 40))} → ${typeof v}`);
      else if (v.trim() === '') badValues.push(`${name}: ${JSON.stringify(k.slice(0, 40))} → empty string`);
    }
  }
  if (badValues.length > 0) problems.push(`translation values that are not usable text: ${badValues.slice(0, 4).join('; ')}`);
  if (typeof translateHebrew !== 'function') problems.push('he.ts no longer exports translateHebrew — the Hebrew reader is gone');
  clauses.push(`${enKeys.length * 2} value(s) resolve to non-empty text, Hebrew reader present`);

  /* 3. PLACEHOLDER AGREEMENT. A translation that drops or renames a placeholder either prints the
        raw token or silently loses the number the sentence was about. */
  const drift = [];
  for (const k of enKeys) {
    const want = phOf(k).slice().sort().join(',');
    for (const [name, map] of [['en', enBySource], ['ar', arBySource]]) {
      const v = map[k];
      if (typeof v !== 'string') continue;
      const got = phOf(v).slice().sort().join(',');
      if (want !== got) drift.push(`${name}: source [${want || 'none'}] vs translation [${got || 'none'}] in ${JSON.stringify(k.slice(0, 44))}`);
    }
  }
  if (drift.length > 0) problems.push(`placeholder drift between a source and its translation: ${drift.slice(0, 4).join('; ')}`);
  const withPh = enKeys.filter((k) => phOf(k).length > 0);
  clauses.push(`${withPh.length} placeholder-bearing source(s), every translation carrying the same tokens`);

  /* 4. NO PLACEHOLDER IS RENDERED UNSUPPLIED — the static half, over the AST rather than over text.
        A `t('… {{x}} …')` with no values argument returns the source unchanged, so the reader sees
        the braces. The dynamic half is clause 5, because no static reader can follow a variable. */
  let ts;
  try {
    ts = createRequire(join(ROOT, 'package.json'))('typescript');
  } catch (err) {
    return fail(`typescript is not resolvable, so t() call sites can only be guessed at: ${err?.message ?? err}`);
  }
  const unsupplied = [];
  let literalCalls = 0;
  for (const f of walk(join(ROOT, 'src'))) {
    const r = rel(f);
    if (r.startsWith('src/i18n/')) continue;
    const sf = ts.createSourceFile(r, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true,
      /\.tsx$/.test(f) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (n) => {
      if (ts.isCallExpression(n)) {
        const c = n.expression;
        const nm = ts.isIdentifier(c) ? c.text
          : (ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.name)) ? c.name.text : null;
        const a0 = n.arguments[0];
        if (nm === 't' && a0 && ts.isStringLiteral(a0)) {
          literalCalls += 1;
          const needs = phOf(a0.text);
          const supplies = n.arguments.length >= 2
            && n.arguments[1].kind !== ts.SyntaxKind.UndefinedKeyword
            && n.arguments[1].getText(sf) !== 'undefined';
          if (needs.length > 0 && !supplies) {
            const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
            unsupplied.push(`${r}:${line} needs {{${needs.join('}} {{')}}} and passes no values`);
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  if (unsupplied.length > 0) {
    problems.push(`t() calls that would print their own placeholder: ${unsupplied.slice(0, 4).join('; ')}`);
  }
  clauses.push(`${literalCalls} literal t() call(s), none of them printing an unsupplied placeholder`);

  /* 5. THE RENDERED SURFACE, PER LANGUAGE. The only clause that can see a placeholder arriving
        through a variable, which is how the one T7 retires arrived. */
  const surface = requireJestCases(ROOT, SURFACE_SUITE, SURFACE_CASES, ['--runInBand']);
  if (surface.problems.length) problems.push(...surface.problems.map((p) => 'rendered surface: ' + p));
  clauses.push('rendered surfaces swept in he, ar and en');

  const population = enKeys.length + arKeys.length + literalCalls;
  if (problems.length > 0) return fail(problems.join(' · '), { population });
  return okOverPopulation({
    population,
    unit: 'translation entr(y/ies) and literal t() call(s)',
    detail: clauses.join(' · '),
  });
};
