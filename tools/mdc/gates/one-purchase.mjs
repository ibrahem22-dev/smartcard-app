/**
 * C1 — ONE PURCHASE.
 *
 * The runtime suite presses the canonical Check action once and reads four painted next-render
 * values in one process. This gate derives its production reader population from that suite's
 * import closure, refuses a second production purchase writer/caller, and requires the named Jest
 * cases to have passed rather than trusting a green suite summary alone.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';
import { stripCommentsAndStrings } from '../lib/source.mjs';

export const SENTINEL = 'ONE-PURCHASE OK';
export const FAILURE_SENTINEL = 'ONE-PURCHASE FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SRC = join(ROOT, 'src');
const SUITE = 'src/screens/__tests__/onePurchase.render.test.tsx';
const SUITE_PATH = join(ROOT, SUITE);
const STORE = join(ROOT, 'src', 'store', 'useActivityStore.ts');
const REQUIRED_CASES = [
  'derives a non-zero generated context and surface population from navigation and the shipped catalog',
  'writes and rehydrates one attributed plain purchase while only Wallet and the Verdict move',
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

const jestMocks = (path, source) => {
  const mocks = [];
  const file = sourceFile(path, source);
  const visit = node => {
    if (ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression)
      && node.expression.expression.text === 'jest'
      && node.expression.name.text === 'mock') {
      const [moduleName] = node.arguments;
      if (moduleName !== undefined && ts.isStringLiteral(moduleName)) {
        mocks.push({ moduleName: moduleName.text, call: node.getText(file) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return mocks;
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
    const raw = readFileSync(path, 'utf8');
    for (const specifier of moduleSpecifiers(path, raw)) {
      const dependency = resolveSourceImport(path, specifier);
      if (dependency !== undefined && rel(dependency).startsWith('src/')) queue.push(dependency);
    }
  }
  return [...seen].sort();
};

const productionSources = directory => {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') out.push(...productionSources(path));
      continue;
    }
    if (['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.endsWith('.test.ts')) out.push(path);
  }
  return out.sort();
};

const purchaseReaders = closure => closure.filter(path => {
  if (!/\.tsx?$/.test(path) || rel(path).includes('/__tests__/')) return false;
  const code = stripCommentsAndStrings(readFileSync(path, 'utf8'));
  return /useActivityStore\s*\([\s\S]{0,180}?\.purchases\s*\)/.test(code);
});

export const run = async () => {
  const required = [SUITE_PATH, STORE];
  const missing = required.filter(path => !existsSync(path));
  if (missing.length > 0) return fail(`missing required file(s): ${missing.map(rel).join(', ')}`);

  const problems = [];
  const clauses = [];
  const closure = importClosure(SUITE_PATH);
  const readers = purchaseReaders(closure);
  if (readers.length === 0) problems.push('the suite import closure contains no production purchase reader');
  for (const path of readers) {
    const code = stripCommentsAndStrings(readFileSync(path, 'utf8'));
    const routesPurchases = /purchases\s*:\s*storedPurchases\b/.test(code)
      || (/verdictPropsFromDraft\s*\(/.test(code) && /\bpurchases\s*,/.test(code));
    if (!routesPurchases) problems.push(`${rel(path)} reads purchases but does not route them to its engine seam`);
  }
  clauses.push(`${readers.length} purchase-reading surface file(s) derived from the suite import closure: ${readers.map(rel).join(', ')}`);

  const sources = productionSources(SRC);
  const writerImplementations = sources.filter(path => {
    const code = stripCommentsAndStrings(readFileSync(path, 'utf8'));
    return /\blogPurchase\s*\(\s*purchase\s*:[^)]*\)\s*\{/.test(code)
      && /\[\s*\.\.\.state\.purchases\s*,\s*purchase\s*\]/.test(code);
  });
  if (writerImplementations.length !== 1 || writerImplementations[0] !== STORE) {
    problems.push(`expected one production purchase writer at ${rel(STORE)}, found ${writerImplementations.length}: ${writerImplementations.map(rel).join(', ') || '(none)'}`);
  }

  const writerCallers = sources.filter(path => {
    const code = stripCommentsAndStrings(readFileSync(path, 'utf8'));
    return /useActivityStore\s*\([\s\S]{0,180}?\.logPurchase\s*\)/.test(code);
  });
  if (writerCallers.length !== 1) {
    problems.push(`expected one production caller of logPurchase, found ${writerCallers.length}: ${writerCallers.map(rel).join(', ') || '(none)'}`);
  }
  clauses.push(`one production writer (${writerImplementations.map(rel).join(', ') || 'missing'}) and one production caller (${writerCallers.map(rel).join(', ') || 'missing'})`);

  const suiteRaw = readFileSync(SUITE_PATH, 'utf8');
  const suiteCode = stripCommentsAndStrings(suiteRaw);
  if (!/derivedContexts\s*\(\s*\)/.test(suiteCode) || !/BOTTOM_NAVIGATION/.test(suiteCode)) {
    problems.push('the runtime population is not derived from derivedContexts() and BOTTOM_NAVIGATION');
  }
  if (!/fireEvent\.press\s*\(/.test(suiteCode)) {
    problems.push('the suite does not press the rendered canonical purchase action');
  }
  if (/<HomeHero\b[^>]*\bcontext\s*=/.test(suiteCode)
    || /<WalletLimitBar\b[^>]*\bcontext\s*=/.test(suiteCode)
    || /<CommitmentsSummary\b[^>]*\bcontext\s*=/.test(suiteCode)) {
    problems.push('a surface is given an explicit context, bypassing the canonical activity-store read');
  }

  const suiteMocks = jestMocks(SUITE_PATH, suiteRaw);
  const prohibitedEngineMocks = suiteMocks.filter(({ moduleName, call }) => (
    moduleName === '../../surfaces'
      || /\b(?:evaluateSurfaceEngines|safeToCommit|loadCardsFromVault)\b/.test(call)
  ));
  if (prohibitedEngineMocks.length > 0) {
    problems.push(`the suite mocks purchase-path engine code: ${prohibitedEngineMocks.map(({ moduleName }) => moduleName).join(', ')}`);
  }
  clauses.push(`${suiteMocks.length} suite-local Jest mock(s), none supplying a purchase-path engine effect`);

  const jest = requireJestCases(ROOT, SUITE, REQUIRED_CASES, ['--runInBand']);
  if (jest.problems.length > 0) problems.push(...jest.problems.map(problem => `runtime: ${problem}`));
  clauses.push(`${REQUIRED_CASES.length} named runtime cases — ${jest.summary}`);

  if (problems.length > 0) return fail(problems.join('; '), { population: readers.length + jest.ran });
  return okOverPopulation({
    population: readers.length + jest.ran,
    unit: 'surface/case observation(s)',
    detail: clauses.join(' · '),
  });
};
