/**
 * C6 — LEARN.
 *
 * Runtime cases pin the rendered populations and honesty fields. This module also inspects the
 * narrow adapter/screen seam because runtime output alone cannot prove that a second hand-written
 * projection was not placed between the pack and the surface.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';
import { stripCommentsAndStrings } from '../lib/source.mjs';

export const SENTINEL = 'LEARN OK';
export const FAILURE_SENTINEL = 'LEARN FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PACK = join(ROOT, 'src', 'data', 'adapter', 'packs', 'content', 'pack.json');
const ADAPTER_SEAM = join(ROOT, 'src', 'data', 'adapter', 'learn.ts');
const SCREEN = join(ROOT, 'src', 'screens', 'LearnScreen.tsx');
const SUITE = 'src/data/adapter/__tests__/learnSurface.render.test.tsx';
const REQUIRED_CASES = [
  'reads glossary, rights and contacts through the adapter',
  'derives rendered counts from adapter slices and agrees with declared and actual pack rows',
  'renders every glossary Arabic status and every evidenced note',
  'renders every right caveat and verification status',
  'renders contact lifecycle plus sourced-value verification and notes without provenance labels',
  'renders N_A as not applicable and never as the pack-authored unknown status',
];

const rel = path => relative(ROOT, path).split('\\').join('/');

const moduleSpecifiers = (path, source) => {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    false,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = [];
  sourceFile.forEachChild(node => {
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

/**
 * The Learn implementation is its screen's relative-import closure. The app adapter directory is
 * an architectural boundary: its Learn seam is included and measured, but its shared internals are
 * not UI implementation files. Any extracted row component remains in the population wherever it
 * moves under src/, provided LearnScreen imports it directly or transitively.
 */
const learnSourcePopulation = () => {
  const queue = [SCREEN, ADAPTER_SEAM];
  const seen = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    if (path === undefined || seen.has(path)) continue;
    seen.add(path);
    if (path === ADAPTER_SEAM || rel(path).startsWith('src/data/adapter/')) continue;
    const source = readFileSync(path, 'utf8');
    for (const specifier of moduleSpecifiers(path, source)) {
      const dependency = resolveSourceImport(path, specifier);
      if (dependency !== undefined && rel(dependency).startsWith('src/')) queue.push(dependency);
    }
  }
  return [...seen].sort();
};

const containsAssertedCount = (source, count) => {
  const comparison = '(?:===?|!==?|>=|<=|>|<)';
  const patterns = [
    new RegExp(`\\b(?:count|glossary|rights|contacts)\\s*:\\s*${count}\\b`),
    new RegExp(`\\b[A-Za-z_$][\\w$]*[Cc]ount[A-Za-z0-9_$]*\\s*=\\s*${count}\\b`),
    new RegExp(`\\b(?:length|size)\\s*${comparison}\\s*${count}\\b`),
    new RegExp(`\\b${count}\\s*${comparison}\\s*[^;\\n]*(?:\\.length|\\.size)\\b`),
  ];
  return patterns.some(pattern => pattern.test(source));
};

export const run = async () => {
  const missing = [PACK, ADAPTER_SEAM, SCREEN].filter(path => !existsSync(path));
  if (missing.length > 0) return fail(`missing required file(s): ${missing.map(rel).join(', ')}`);

  const problems = [];
  const clauses = [];
  const pack = JSON.parse(readFileSync(PACK, 'utf8'));
  const units = ['glossary', 'rights', 'contacts'];
  const declarations = new Map(
    Array.isArray(pack.counts) ? pack.counts.map(row => [row.unit, row.rows]) : [],
  );
  let rowPopulation = 0;

  for (const unit of units) {
    const rows = pack.units?.[unit];
    const actual = Array.isArray(rows) ? rows.length : 0;
    const declared = declarations.get(unit);
    rowPopulation += actual;
    if (actual === 0) problems.push(`${unit}: actual pack population is zero`);
    if (typeof declared !== 'number') problems.push(`${unit}: pack.counts has no numeric declaration`);
    else if (declared !== actual) problems.push(`${unit}: declared ${declared}, actual ${actual}`);
  }
  clauses.push(`${units.length} pack units have non-zero, agreeing declared and actual populations`);

  const sourcePopulation = learnSourcePopulation();
  const sources = new Map(sourcePopulation.map(path => {
    const raw = readFileSync(path, 'utf8');
    return [path, { raw, stripped: stripCommentsAndStrings(raw) }];
  }));
  const seamSource = sources.get(ADAPTER_SEAM)?.stripped ?? '';
  const screenRawSource = sources.get(SCREEN)?.raw ?? '';
  const screenImportsLearnSeam = moduleSpecifiers(SCREEN, screenRawSource)
    .some(specifier => resolveSourceImport(SCREEN, specifier) === ADAPTER_SEAM);

  if (!/openContentSlices\s*\(/.test(seamSource)) {
    problems.push('adapter seam does not call openContentSlices()');
  }
  for (const unit of units) {
    if (!new RegExp(`slices\\.${unit}\\.all\\(\\)`).test(seamSource)) {
      problems.push(`adapter seam does not obtain ${unit} rows from its adapter slice`);
    }
    if (!new RegExp(`${unit}:\\s*slices\\.${unit}\\.size`).test(seamSource)) {
      problems.push(`adapter seam does not derive the ${unit} count from slice.size`);
    }
  }
  if (/\.units\b/.test(seamSource) || /project(?:Glossary|Rights|Contacts)\s*\(/.test(seamSource)) {
    problems.push('adapter seam contains a hand-written/raw-unit projection');
  }
  if (!screenImportsLearnSeam) {
    problems.push('LearnScreen does not import its rows from the app adapter seam');
  }
  for (const path of sourcePopulation) {
    if (path === ADAPTER_SEAM) continue;
    const imports = moduleSpecifiers(path, sources.get(path)?.raw ?? '');
    if (imports.some(specifier => /pack\.json$/.test(specifier) || specifier === '@smartcard/data-authority-adapter')) {
      problems.push(`${rel(path)} reaches the raw pack or adapter package directly`);
    }
  }
  clauses.push(`screen reads three adapter slice views; seam has no raw-unit projection; Learn import population is ${sourcePopulation.length} source file(s)`);

  for (const count of declarations.values()) {
    for (const [path, source] of sources) {
      if (containsAssertedCount(source.stripped, count)) {
        problems.push(`${rel(path)} asserts shipped count literal ${count} as data`);
      }
    }
  }
  clauses.push(`no declared pack count is asserted as data across ${sourcePopulation.length} Learn source file(s)`);

  const jest = requireJestCases(ROOT, SUITE, REQUIRED_CASES, ['--runInBand']);
  if (jest.problems.length > 0) {
    problems.push(...jest.problems.map(problem => `runtime: ${problem}`));
  }
  clauses.push(`${REQUIRED_CASES.length} named runtime cases — ${jest.summary}`);

  if (problems.length > 0) {
    return fail(problems.join('\n           '), { population: rowPopulation + jest.ran });
  }

  return okOverPopulation({
    population: rowPopulation + jest.ran,
    unit: 'row/case measurement(s)',
    detail: clauses.join(' · '),
  });
};
