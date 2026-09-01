/** C2 — PURCHASE LIFECYCLE: one writer plus fifteen real-store runtime properties. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';
import { stripComments, stripCommentsAndStrings } from '../lib/source.mjs';

export const SENTINEL = 'PURCHASE-LIFECYCLE OK';
export const FAILURE_SENTINEL = 'PURCHASE-LIFECYCLE FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const SRC = join(ROOT, 'src');
const SUITE = 'src/screens/__tests__/purchaseLifecycle.render.test.tsx';
const SERVICE = 'src/services/purchaseLifecycle.ts';
const VERDICT = 'src/screens/check/CheckVerdictScreen.tsx';
const REQUIRED_CASES = [
  'creates exactly one purchase and one explicitly bidirectionally linked commitment',
  'keeps exposure at T once and makes Wallet equal the Verdict promise',
  'moves Home by M, Plan by M, and attributed limit exposure by T from one commit',
  'does not move an unrelated card limit',
  'keeps a plain purchase free of any linked commitment',
  'treats a double press as one idempotent lifecycle despite same-millisecond timing',
  'does not duplicate on re-render, retry, or genuine hydrate reload',
  'rolls back the purchase when the real commitment action seam throws',
  'leaves no commitment when the real purchase action seam throws',
  'reports rollback failure distinctly and exposes the exact surviving partial state',
  'session undo reverses the pair and returns all four surfaces to pre-commit values',
  'does not offer undo after restart while the pair survives a genuine vault re-read',
  'edits shared Plan fields together and surfaces follow the edited monthly amount',
  'deletes both records from Plan and leaves no orphan in either direction',
  'editing and deleting one lifecycle never mutates unrelated purchases or commitments',
];

const rel = path => relative(ROOT, path).split('\\').join('/');

const productionSources = directory => {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') out.push(...productionSources(path));
      continue;
    }
    if (['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.endsWith('.test.ts')) {
      out.push(path);
    }
  }
  return out.sort();
};

const sourceFile = (path, source) => ts.createSourceFile(
  path,
  source,
  ts.ScriptTarget.Latest,
  true,
  path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
);

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

export const run = async () => {
  const paths = [SUITE, SERVICE, VERDICT].map(path => join(ROOT, path));
  const missing = paths.filter(path => !existsSync(path));
  if (missing.length > 0) return fail(`missing required file(s): ${missing.map(rel).join(', ')}`);

  const problems = [];
  const clauses = [];
  const sources = productionSources(SRC);
  const lifecycleWriters = sources.filter(path => {
    const code = stripCommentsAndStrings(readFileSync(path, 'utf8'));
    return /writeLoggedPurchase\s*\(/.test(code)
      && /\.addObligation\s*\(/.test(code)
      && /purchaseLifecycleProblems\s*\(/.test(code);
  });
  if (lifecycleWriters.length !== 1 || rel(lifecycleWriters[0] ?? '') !== SERVICE) {
    problems.push(`expected one purchase-and-commitment lifecycle writer at ${SERVICE}, found ${lifecycleWriters.length}: ${lifecycleWriters.map(rel).join(', ') || '(none)'}`);
  }

  const verdictRaw = readFileSync(join(ROOT, VERDICT), 'utf8');
  const verdictWithStrings = stripComments(verdictRaw);
  const verdictCode = stripCommentsAndStrings(verdictRaw);
  if (!/from\s+['"]\.\.\/\.\.\/services\/purchaseLifecycle['"]/.test(verdictWithStrings)) {
    problems.push(`${VERDICT} does not import the lifecycle service by its raw module specifier`);
  }
  if (!/commitPurchaseLifecycle\s*\(/.test(verdictCode)) {
    problems.push(`${VERDICT} does not call commitPurchaseLifecycle`);
  }
  const lifecycleCallers = sources.filter(path => {
    const code = stripCommentsAndStrings(readFileSync(path, 'utf8'));
    return /commitPurchaseLifecycle\s*\(/.test(code) && rel(path) !== SERVICE;
  });
  if (lifecycleCallers.length !== 1 || rel(lifecycleCallers[0] ?? '') !== VERDICT) {
    problems.push(`expected the Verdict as the one production lifecycle caller, found ${lifecycleCallers.map(rel).join(', ') || '(none)'}`);
  }
  clauses.push(`one lifecycle writer (${lifecycleWriters.map(rel).join(', ') || 'missing'}) and one shipped caller (${lifecycleCallers.map(rel).join(', ') || 'missing'})`);

  const serviceRaw = readFileSync(join(ROOT, SERVICE), 'utf8');
  const serviceCode = stripCommentsAndStrings(serviceRaw);
  for (const requiredStructure of [
    ['snapshot before write', /const\s+before\s*=\s*snapshot\s*\(actions\)/],
    ['verified rollback', /restoreAndVerify\s*\(actions\s*,\s*before\s*\)/],
    ['purchase-side orphan check', /purchases\.filter[\s\S]{0,240}?linkedInstallmentId[\s\S]{0,500}?purchaseObligations\.find/],
    ['commitment-side orphan check', /for\s*\(const\s+obligation\s+of\s+purchaseObligations\)[\s\S]{0,300}?purchases\.find/],
    ['delete cascade', /deletePurchase\s*\(activityId\)[\s\S]{0,240}?deleteObligation\s*\(/],
  ]) {
    if (!requiredStructure[1].test(serviceCode)) {
      problems.push(`${SERVICE} lacks ${requiredStructure[0]} structure`);
    }
  }
  if (!serviceRaw.includes('orphaned commitment') || !serviceRaw.includes('names missing commitment')) {
    problems.push(`${SERVICE} does not name both orphan directions in raw diagnostic strings`);
  }
  if (!serviceRaw.includes('ROLLBACK_FAILED') || !serviceRaw.includes('ROLLED_BACK')) {
    problems.push(`${SERVICE} collapses clean rollback and rollback failure`);
  }
  clauses.push('snapshot, restore verification, distinct rollback outcomes, cascade, and both orphan directions are present');

  const suiteRaw = readFileSync(join(ROOT, SUITE), 'utf8');
  const suiteWithStrings = stripComments(suiteRaw);
  const suiteCode = stripCommentsAndStrings(suiteRaw);
  for (const testID of [
    'home-hero-amount',
    'wallet-limit-bar-available',
    'commitments-summary-total',
    'check-verdict-impact-strip',
  ]) {
    if (!suiteWithStrings.includes(testID)) problems.push(`${SUITE} does not read raw testID ${testID}`);
  }
  if (!/purchase\?\.amountIls[\s\S]{0,180}?held[\s\S]{0,80}?toBe\s*\(TOTAL\)/.test(suiteCode)) {
    problems.push(`${SUITE} does not runtime-assert logged amount plus held amount equals T`);
  }
  if (!/purchaseLifecycleProblems\s*\(/.test(suiteCode)) {
    problems.push(`${SUITE} does not execute the bidirectional orphan invariant`);
  }

  const mocks = jestMocks(join(ROOT, SUITE), suiteRaw);
  const prohibited = mocks.filter(({ moduleName, call }) => (
    /(?:surfaces|surfaceEngines|safeToCommit|commitmentInput|activityMapper|engines\/load)/.test(moduleName)
    || /\b(?:evaluateSurfaceEngines|safeToCommit|loadCardsFromVault|commitmentsFromVault|evaluateFinancialLoad)\b/.test(call)
  ));
  if (prohibited.length > 0) {
    problems.push(`the suite mocks purchase/commitment engine code: ${prohibited.map(({ moduleName }) => moduleName).join(', ')}`);
  }
  clauses.push(`${mocks.length} suite-local Jest mock(s), all native navigation/module boundaries and none supplying an engine effect`);

  const jest = requireJestCases(ROOT, SUITE, REQUIRED_CASES, ['--runInBand']);
  if (jest.problems.length > 0) {
    problems.push(...jest.problems.map(problem => `runtime: ${problem}`));
    const orphanLine = jest.output.split('\n').find(line => /orphan(?:ed)? commitment/i.test(line));
    if (orphanLine !== undefined) problems.push(`runtime orphan evidence: ${orphanLine.trim()}`);
  }
  clauses.push(`${REQUIRED_CASES.length} named runtime cases — ${jest.summary}`);

  if (problems.length > 0) return fail(problems.join('; '), { population: jest.ran + lifecycleCallers.length });
  return okOverPopulation({
    population: jest.ran + lifecycleCallers.length,
    unit: 'lifecycle case/caller observation(s)',
    detail: clauses.join(' · '),
  });
};
