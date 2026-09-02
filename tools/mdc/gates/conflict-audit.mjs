/** C3 — CONFLICT AUDIT: every shipped preserved conflict stays visible and unarbitrated. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  conflictRecordAvailabilityOf,
  conflictRenderPlan,
  intervalRankabilityOf,
} from '@smartcard/data-authority-adapter';

import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';
import { stripComments, stripCommentsAndStrings } from '../lib/source.mjs';

export const SENTINEL = 'CONFLICT-AUDIT OK';
export const FAILURE_SENTINEL = 'CONFLICT-AUDIT FAILED';
export const MEASURES = 'runtime';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PACKS_DIR = join(ROOT, 'src', 'data', 'adapter', 'packs');
const PACK = join(PACKS_DIR, 'catalog', 'pack.json');
const ENGINE = join(ROOT, 'src', 'engines', 'fx.ts');
const CONVERTER = join(ROOT, 'src', 'authority', 'packConflict.ts');
const SHARED = join(ROOT, 'src', 'components', 'ConflictedValue.tsx');
const FX_SURFACE = join(ROOT, 'src', 'screens', 'fx', 'FxCompareSheet.tsx');
const CHECK_SURFACE = join(ROOT, 'src', 'screens', 'check', 'CheckVerdictScreen.tsx');
const SECTION_A = join(ROOT, 'src', 'screens', 'cardDna', 'SectionACosts.tsx');
const SUITE = 'src/screens/fx/__tests__/conflictAudit.render.test.tsx';
const SUITE_PATH = join(ROOT, SUITE);

/** Audited from the shipped catalog at baseline a10270a; a smaller corpus is a red, not a new zero. */
const SHIPPED_CONFLICT_FLOOR = 59;
const REQUIRED_CASES = [
  'a conflicted FX cost reaches Check/Verdict as a conflict, not a number or unknown',
  'FxCompareSheet renders every valued candidate with its scope and source',
  'a valueless shipped conflict renders the disputed mark and invents no value',
  'a conflicted card is absent from ranked and unknownCards',
  'ordering-dependent saves claims are suppressed when a conflicted card is present',
  'candidate order is preserved exactly as the shipped participants supplied it',
  'no candidate is truncated',
  'SectionACosts still renders its conflict through ConflictedValue',
];

const rel = path => relative(ROOT, path).split('\\').join('/');
const sourceFile = (path, source) => ts.createSourceFile(
  path,
  source,
  ts.ScriptTarget.Latest,
  true,
  path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
);
const walk = (node, visit) => {
  visit(node);
  node.forEachChild(child => walk(child, visit));
};

/** Import specifiers and testIDs are string data, so read them from raw/comment-stripped source. */
const moduleSpecifiers = (path, source) => {
  const values = [];
  walk(sourceFile(path, source), node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier)) {
      values.push(node.moduleSpecifier.text);
    }
  });
  return values;
};

const jestMocks = (path, source) => {
  const values = [];
  walk(sourceFile(path, source), node => {
    if (!ts.isCallExpression(node)
      || !ts.isPropertyAccessExpression(node.expression)
      || node.expression.expression.getText() !== 'jest'
      || node.expression.name.text !== 'mock') return;
    const first = node.arguments[0];
    values.push(first !== undefined && ts.isStringLiteral(first) ? first.text : '<dynamic>');
  });
  return values;
};

const hasSpecifier = (path, source, suffix) =>
  moduleSpecifiers(path, source).some(specifier => specifier.endsWith(suffix));

export const run = async () => {
  const required = [PACKS_DIR, PACK, ENGINE, CONVERTER, SHARED, FX_SURFACE, CHECK_SURFACE, SECTION_A, SUITE_PATH];
  const missing = required.filter(path => !existsSync(path));
  if (missing.length > 0) return fail(`missing required file(s): ${missing.map(rel).join(', ')}`);

  const problems = [];
  const clauses = [];
  const packPaths = readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(PACKS_DIR, entry.name, 'pack.json'))
    .filter(existsSync);
  if (packPaths.length === 0) return fail('shipped pack population is zero');
  const packPopulation = packPaths.map(path => ({
    path,
    body: JSON.parse(readFileSync(path, 'utf8')),
  }));
  const conflicts = packPopulation.flatMap(({ path, body }) =>
    (Array.isArray(body.conflicts) ? body.conflicts : []).map(conflict => ({
      ...conflict,
      packPath: path,
    })));
  if (conflicts.length < SHIPPED_CONFLICT_FLOOR) {
    problems.push(`catalog conflict population ${conflicts.length} is below shipped floor ${SHIPPED_CONFLICT_FLOOR}; zero is always failure`);
  }

  const valued = [];
  const valueless = [];
  for (const conflict of conflicts) {
    if (typeof conflict.conflictId !== 'string') {
      problems.push('catalog carries a conflict without conflictId');
      continue;
    }
    if (conflict.resolution !== 'PRESERVED_NOT_ARBITRATED') {
      problems.push(`${conflict.conflictId} is not PRESERVED_NOT_ARBITRATED`);
    }
    if (typeof conflict.scope !== 'string' || conflict.scope.trim() === '') {
      problems.push(`${conflict.conflictId} has no scope`);
    }
    const participants = Array.isArray(conflict.participants) ? conflict.participants : [];
    if (participants.length < 2) problems.push(`${conflict.conflictId} has fewer than two participants`);
    const candidates = participants.filter(participant =>
      typeof participant.value === 'number' && Number.isFinite(participant.value));
    (candidates.length > 0 ? valued : valueless).push(conflict);
    for (const candidate of candidates) {
      if ((typeof candidate.sourceLabel !== 'string' || candidate.sourceLabel.trim() === '')
        && (typeof candidate.recordId !== 'string' || candidate.recordId.trim() === '')) {
        problems.push(`surface FxCompareSheet conflict ${conflict.conflictId}: candidate ${String(candidate.recordId)} has no source label or record-id fallback`);
      }
    }
  }
  if (conflicts.length === 0) problems.push('catalog conflict population is zero — an empty audit cannot pass');
  if (valued.length === 0) problems.push('RENDER_ALL_CANDIDATES population is zero');
  if (valueless.length === 0) problems.push('DISPUTED_WITHOUT_CANDIDATES population is zero');

  const plans = new Map();
  for (const conflict of conflicts) {
    const hasValues = conflict.participants?.some(participant =>
      typeof participant.value === 'number' && Number.isFinite(participant.value));
    /* Only enumerable numeric readings are render records for this numeric surface. */
    const records = hasValues ? [conflict] : [];
    const plan = conflictRenderPlan(conflictRecordAvailabilityOf(records));
    const rankability = intervalRankabilityOf(records);
    plans.set(plan, (plans.get(plan) ?? 0) + 1);
    if (hasValues && plan !== 'RENDER_ALL_CANDIDATES') {
      problems.push(`surface FxCompareSheet conflict ${conflict.conflictId}: valued candidates do not route to RENDER_ALL_CANDIDATES`);
    }
    if (!hasValues && plan !== 'DISPUTED_WITHOUT_CANDIDATES') {
      problems.push(`surface FxCompareSheet conflict ${conflict.conflictId}: valueless conflict does not route to DISPUTED_WITHOUT_CANDIDATES`);
    }
    if (hasValues && rankability !== 'NOT_RANKABLE_AXIS_NOT_CLASSIFIED') {
      problems.push(`${conflict.conflictId} unexpectedly ranks as ${rankability}`);
    }
  }
  clauses.push(`${conflicts.length} genuine conflict(s) derived from ${packPaths.length} shipped pack(s): ${valued.length} RENDER_ALL_CANDIDATES, ${valueless.length} DISPUTED_WITHOUT_CANDIDATES`);

  const engineRaw = readFileSync(ENGINE, 'utf8');
  const engine = stripCommentsAndStrings(engineRaw);
  if (!/readonly\s+conflict\s*:\s*ConflictAuthority\s*<\s*number\s*>/.test(engine)) {
    problems.push('CardFxQuote has no ConflictAuthority<number> arm');
  }
  if (!/readonly\s+fxPercent\s*\?\s*:\s*never/.test(engine)
    || !/readonly\s+conflict\s*\?\s*:\s*never/.test(engine)) {
    problems.push('CardFxQuote is not exclusive: a conflict can still be expressed with a scalar');
  }
  if (!/if\s*\(\s*card\.conflict\s*!==\s*undefined\s*\)[\s\S]{0,220}?conflictedCards\.push[\s\S]{0,120}?continue/.test(engine)) {
    problems.push('compareAbroad does not divert conflicts before numeric/unknown handling');
  }
  if (!/deltasSuppressed\s*:\s*smallAmountAdvisory\s*\|\|\s*conflictedCards\.length\s*>/.test(engine)) {
    problems.push('compareAbroad does not suppress ordering-dependent deltas for conflicts');
  }

  const converterRaw = readFileSync(CONVERTER, 'utf8');
  const converter = stripCommentsAndStrings(converterRaw);
  if (/provenance\s*:\s*['"`]VERIFIED['"`]/.test(converterRaw)) {
    problems.push('packConflict conversion hard-codes VERIFIED provenance that the pack does not establish');
  }
  if (!/participant\.sourceLabel\s*\?\?\s*participant\.recordId/.test(converter)
    || !/scope\s*:\s*record\.scope/.test(converter)) {
    const named = valued[0]?.conflictId ?? '<no-valued-conflict>';
    problems.push(`surface FxCompareSheet conflict ${named}: candidate source or scope is suppressed by packConflict conversion`);
  }
  if (!/typeof\s+participant\.value\s*!==/.test(converter)
    || !/Number\.isFinite\s*\(\s*participant\.value\s*\)/.test(converter)) {
    problems.push('packConflict conversion does not refuse valueless participants');
  }

  const sharedRaw = readFileSync(SHARED, 'utf8');
  const shared = stripCommentsAndStrings(sharedRaw);
  const controlConflict = valued[0]?.conflictId ?? '<no-valued-conflict>';
  if (!/candidate\.sourceId/.test(shared)) {
    problems.push(`surface ConflictedValue conflict ${controlConflict}: candidate source is missing`);
  }
  if (!/candidate\.scope/.test(shared)) {
    problems.push(`surface ConflictedValue conflict ${controlConflict}: candidate scope is missing`);
  }
  if (!/candidates\.map\s*\(/.test(shared) || /candidates\.(?:slice|sort)\s*\(/.test(shared)) {
    problems.push(`surface ConflictedValue conflict ${controlConflict}: candidates are truncated, sorted, or not fully mapped`);
  }

  const fxRaw = readFileSync(FX_SURFACE, 'utf8');
  const fx = stripCommentsAndStrings(fxRaw);
  const fxStrings = stripComments(fxRaw);
  if (!hasSpecifier(FX_SURFACE, fxRaw, '/ConflictedValue')) {
    problems.push('surface FxCompareSheet does not import shared ConflictedValue');
  }
  if (!/comparison\.conflictedCards\.map\s*\(/.test(fx) || !/<ConflictedValue\b/.test(fx)) {
    problems.push('surface FxCompareSheet does not map every conflicted card through ConflictedValue');
  }
  if (!/plan\s*=\s*\{\s*decision\.plan\s*\}/.test(fx)) {
    problems.push('surface FxCompareSheet does not pass the adapter render plan to ConflictedValue');
  }
  if (!/testID\s*=\s*\{`fx-compare-conflict-/.test(fxStrings)) {
    problems.push('surface FxCompareSheet has no conflict-addressable testID');
  }

  const sectionRaw = readFileSync(SECTION_A, 'utf8');
  const section = stripCommentsAndStrings(sectionRaw);
  if (!hasSpecifier(SECTION_A, sectionRaw, '/ConflictedValue') || !/<ConflictedValue\b/.test(section)) {
    problems.push('surface SectionACosts no longer renders shared ConflictedValue');
  }
  const checkRaw = readFileSync(CHECK_SURFACE, 'utf8');
  const check = stripCommentsAndStrings(checkRaw);
  if (!/fxComparison\?\.deltasSuppressed\s*!==\s*true/.test(check)) {
    problems.push('surface CheckVerdict can render a saves claim while its FX comparison is conflicted');
  }
  clauses.push('FxCompareSheet, CheckVerdict and SectionACosts route conflicts through the shared chip-less component without scalar arbitration');

  const suiteRaw = readFileSync(SUITE_PATH, 'utf8');
  const mocks = jestMocks(SUITE_PATH, suiteRaw);
  const nativeMocks = new Set(['expo-sqlite']);
  const forbiddenMockFragments = [
    'authorityValue', 'cardCostConflict', 'conflictRender', 'conflictRenderPlan', 'engines/fx', 'honesty',
  ];
  for (const mocked of mocks) {
    if (forbiddenMockFragments.some(fragment => mocked.includes(fragment))) {
      problems.push(`runtime suite mocks forbidden conflict-path module ${mocked}`);
    } else if (!nativeMocks.has(mocked)) {
      problems.push(`runtime suite mocks non-native module ${mocked}`);
    }
  }
  if (mocks.length === 0) problems.push('runtime suite declares no native boundary mock for SectionACosts pack storage');

  const jest = requireJestCases(ROOT, SUITE, REQUIRED_CASES, ['--runInBand']);
  if (jest.problems.length > 0) problems.push(...jest.problems.map(problem => `runtime: ${problem}`));
  clauses.push(`${jest.ran} named real-pack/engine/render case(s); mocks: ${mocks.join(', ')}`);

  if (problems.length > 0) {
    return fail(problems.join('; '), { population: conflicts.length + jest.ran });
  }
  return okOverPopulation({
    population: conflicts.length + jest.ran,
    floor: SHIPPED_CONFLICT_FLOOR,
    unit: 'shipped-conflict/runtime-case observation(s)',
    detail: clauses.join(' · '),
  });
};
