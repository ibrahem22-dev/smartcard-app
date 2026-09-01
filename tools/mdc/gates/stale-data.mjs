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

/** Affected surfaces are production TSX modules in the suite closure that render the shared chip. */
const affectedSurfacePopulation = closure => closure.filter(path => {
  if (!path.endsWith('.tsx') || rel(path).includes('/__tests__/')) return false;
  const stripped = stripCommentsAndStrings(readFileSync(path, 'utf8'));
  return /<ProvenanceChip\b/.test(stripped);
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
