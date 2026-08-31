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

import { fail, okOverPopulation, requireJestCases } from '../lib/report.mjs';

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
];

const rel = path => relative(ROOT, path).split('\\').join('/');

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

  const seamSource = readFileSync(ADAPTER_SEAM, 'utf8');
  const screenSource = readFileSync(SCREEN, 'utf8');
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
  if (!/from ['"]\.\.\/data\/adapter\/learn['"]/.test(screenSource)) {
    problems.push('LearnScreen does not import its rows from the app adapter seam');
  }
  if (/pack\.json|data-authority-adapter/.test(screenSource)) {
    problems.push('LearnScreen reaches the raw pack or adapter package directly');
  }
  clauses.push('screen reads three adapter slice views; seam has no raw-unit projection');

  for (const count of declarations.values()) {
    const literal = new RegExp(`(^|[^0-9])${count}([^0-9]|$)`);
    for (const [path, source] of [[ADAPTER_SEAM, seamSource], [SCREEN, screenSource]]) {
      if (literal.test(source)) problems.push(`${rel(path)} contains shipped count literal ${count}`);
    }
  }
  clauses.push('no declared pack count occurs as a literal in Learn implementation source');

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
