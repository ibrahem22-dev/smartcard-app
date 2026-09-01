/**
 * C10 — STALE DATA.
 *
 * The render suite controls the clock and proves the same FX figure crosses the adapter-owned
 * threshold without losing its Estimate chip. The source half derives the affected surfaces from
 * that suite's import closure and rejects a literal staleness verdict before Jest runs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';
import { stripCommentsAndStrings } from '../lib/source.mjs';

export const SENTINEL = 'STALE-DATA OK';
export const FAILURE_SENTINEL = 'STALE-DATA FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SUITE = 'src/screens/check/__tests__/staleData.render.test.tsx';
const SUITE_PATH = join(ROOT, SUITE);
const CHIP = join(ROOT, 'src', 'components', 'ProvenanceChip.tsx');
const FX_STALENESS = join(ROOT, 'src', 'data', 'adapter', 'fxStaleness.ts');
const CHECK_INPUT = join(ROOT, 'src', 'screens', 'check', 'CheckInputScreen.tsx');
const REQUIRED_CASES = [
  'renders the same FX figure fresh before the threshold',
  'renders the same FX figure Stale after the threshold',
  'renders asOfDate whenever the FX figure is Stale',
  'keeps the Estimate chip unchanged across the staleness transition',
];

const rel = path => relative(ROOT, path).split('\\').join('/');

const sourceFile = (path, source) => ts.createSourceFile(
  path,
  source,
  ts.ScriptTarget.Latest,
  true,
  path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
);

const moduleSpecifiers = (path, source) => {
  const specifiers = [];
  sourceFile(path, source).forEachChild(node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier !== undefined
      && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
  });
  return specifiers;
};

const resolveSourceImport = (fromPath, specifier) => {
  if (!specifier.startsWith('.')) return undefined;
  const base = join(dirname(fromPath), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find(candidate => existsSync(candidate) && /\.tsx?$/.test(candidate));
};

const importClosure = entry => {
  const queue = [entry];
  const seen = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    if (path === undefined || seen.has(path)) continue;
    seen.add(path);
    const source = readFileSync(path, 'utf8');
    for (const specifier of moduleSpecifiers(path, source)) {
      const dependency = resolveSourceImport(path, specifier);
      if (dependency !== undefined && rel(dependency).startsWith('src/')) queue.push(dependency);
    }
  }
  return [...seen].sort();
};

/**
 * A CHIP IS NOT ALWAYS A FIGURE — and C10 governs figures.
 *
 * The criterion is "the documented aging policy renders Stale on every affected FIGURE once
 * thresholds pass". A figure is a value the packs date and the aging policy can age. Not every
 * ProvenanceChip in the app sits beside one: `src/components/CardTile.tsx` chips the provenance of
 * a CARD IMAGE, resolved by `resolveMedia`, and `src/media/types.ts` gives that record `attribution`
 * and `provenanceChip` and NEITHER `stale` NOR `asOfDate`. Bundled artwork has no threshold to pass,
 * so `stale: false` there is not a hardcoded verdict — it is the true one.
 *
 * This matters because the first version of this gate counted every chip-rendering module, which
 * made CardTile look like an unfixed surface. It is pinned by an earlier campaign's boundary record
 * (P5's wallet-tile gate, D-021), so the gate was demanding an edit the campaign is not permitted
 * to make, for a figure that does not exist.
 *
 * THE EXCLUSION IS DERIVED AND IT EXPIRES BY ITSELF. A surface drops out only when every chip it
 * renders is chipped from a media resolution, and only while media records genuinely carry no
 * staleness. If `src/media/types.ts` ever gains `stale` or `asOfDate`, media values become
 * aging-governed, the justification is gone, and this gate FAILS rather than going on excluding
 * them — the same rule the U5 exemption is held to.
 */
const MEDIA_TYPES = join(ROOT, 'src', 'media', 'types.ts');

const mediaRecordsCarryStaleness = () => {
  if (!existsSync(MEDIA_TYPES)) return null;
  const stripped = stripCommentsAndStrings(readFileSync(MEDIA_TYPES, 'utf8'));
  return /\bstale\b/.test(stripped) || /\basOfDate\b/.test(stripped);
};

/**
 * THE SPECIFIER IS READ FROM RAW, THE STRUCTURE FROM STRIPPED — and the first version of this
 * function got that backwards, which is worth leaving written down.
 *
 * A module specifier IS a string body, so `stripCommentsAndStrings` blanks it: searching the
 * stripped copy for '../media/resolveMedia' can never match however correct the file is. That is
 * the same mistake OQ-MDC-010's sweep was ruled about, made here by the supervisor while repairing
 * a gate. The import is therefore matched against the RAW text; the chip structure, where a comment
 * could otherwise masquerade as a call, is matched against the stripped copy.
 */
const isMediaOnlyChipSurface = (raw, stripped) => {
  if (!/from\s*['"][^'"]*media\/resolveMedia['"]/.test(raw)) return false;
  const chipViews = [...stripped.matchAll(/<ProvenanceChip\b[\s\S]{0,240}?\/>/g)].map(m => m[0]);
  if (chipViews.length === 0) return false;
  /* Every chip in the file must read from the media resolution. One figure chip and it stays in. */
  return chipViews.every(view => /resolution\s*[.?]/.test(view));
};

const affectedSurfacePopulation = closure => closure.filter(path => {
  if (!path.endsWith('.tsx') || rel(path).includes('/__tests__/')) return false;
  const raw = readFileSync(path, 'utf8');
  const stripped = stripCommentsAndStrings(raw);
  if (!/<ProvenanceChip\b/.test(stripped)) return false;
  return !isMediaOnlyChipSurface(raw, stripped);
});

export const run = async () => {
  const required = [SUITE_PATH, CHIP, FX_STALENESS, CHECK_INPUT];
  const missing = required.filter(path => !existsSync(path));
  if (missing.length > 0) return fail(`missing required file(s): ${missing.map(rel).join(', ')}`);

  const problems = [];
  const clauses = [];
  const closure = importClosure(SUITE_PATH);
  const surfaces = affectedSurfacePopulation(closure);
  let chipCalls = 0;

  if (surfaces.length === 0) problems.push('the suite import closure contains no affected surface');

  /* The media exclusion must still be justified, or it is a hole nobody is watching. */
  const mediaStale = mediaRecordsCarryStaleness();
  if (mediaStale === null) {
    problems.push('src/media/types.ts is missing — the media-chip exclusion cannot be justified and must not be applied blind');
  } else if (mediaStale) {
    problems.push('src/media/types.ts now declares stale or asOfDate, so media values ARE aging-governed: '
      + 'the exclusion that keeps media-only chip surfaces out of this population has expired and every '
      + 'such surface must be measured as a figure');
  }
  for (const path of surfaces) {
    const stripped = stripCommentsAndStrings(readFileSync(path, 'utf8'));
    chipCalls += [...stripped.matchAll(/<ProvenanceChip\b/g)].length;
    if (/\bstale\s*:\s*(?:true|false)\b/.test(stripped)) {
      problems.push(`${rel(path)} hardcodes a staleness literal`);
    }
    if (/\bstale\s*:/.test(stripped) && !/\basOfDate\s*=/.test(stripped)) {
      problems.push(`${rel(path)} routes dynamic staleness without asOfDate`);
    }
  }
  if (chipCalls === 0) problems.push('the affected surface population contains zero ProvenanceChip calls');
  clauses.push(`${surfaces.length} affected surface file(s) and ${chipCalls} shared-chip call(s) derived from the suite import closure contain no staleness literal`);

  const checkSource = stripCommentsAndStrings(readFileSync(CHECK_INPUT, 'utf8'));
  if (!/stalenessReading\s*\(\s*fxReference\.rateDate\s*,\s*asOfDate\s*\)/.test(checkSource)) {
    problems.push('CheckInputScreen does not pass the injected asOfDate clock to stalenessReading');
  }
  if (/new\s+Date\s*\(/.test(checkSource)) {
    problems.push('CheckInputScreen reads an implicit Date clock in the staleness path');
  }

  const seamSource = stripCommentsAndStrings(readFileSync(FX_STALENESS, 'utf8'));
  if (!/stalenessOf\s*\(\s*rateDate\s*,\s*asOf\s*,/.test(seamSource)) {
    problems.push('fxStaleness does not forward its explicit asOf argument to adapter stalenessOf');
  }
  if (/new\s+Date\s*\(/.test(seamSource)) {
    problems.push('fxStaleness reads an implicit Date clock');
  }

  const chipSource = stripCommentsAndStrings(readFileSync(CHIP, 'utf8'));
  if (!/function\s+StalenessModifier\s*\(/.test(chipSource)
    || !/asOfDate\s*===\s*undefined\s*\|\|\s*asOfDate\.trim\s*\(\s*\)\s*===/.test(chipSource)) {
    problems.push('the shared StalenessModifier does not fail closed when a stale value lacks asOfDate');
  }
  if (!/testID\s*=\s*[^\n]*provenance-chip-as-of-date/.test(readFileSync(CHIP, 'utf8'))) {
    problems.push('ProvenanceChip does not render the stale value asOfDate');
  }
  clauses.push('the staleness seam takes an injected clock and the shared chip refuses stale-without-date');

  const jest = requireJestCases(ROOT, SUITE, REQUIRED_CASES, ['--runInBand']);
  if (jest.problems.length > 0) problems.push(...jest.problems.map(problem => `runtime: ${problem}`));
  clauses.push(`${jest.ran} render case(s) passed: fresh, Stale, dated, and chip-stable`);

  if (problems.length > 0) return fail(problems.join('; '), { population: surfaces.length + jest.ran });
  return okOverPopulation({
    population: surfaces.length + jest.ran,
    unit: 'source/runtime observations',
    detail: clauses.join('; '),
  });
};
