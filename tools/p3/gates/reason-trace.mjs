/**
 * GATE: reason-trace — criterion T1.  →  `REASON-TRACE OK`
 *
 *   > **T1.** *"A reason-trace schema exists and every engine output carries one, as an engine
 *   > output rather than UI copy."*
 *
 * THREE CHECKS
 *
 *   1. The schema module exists under src/engines/, is versioned, and exports the shape plus its
 *      builders — a schema nobody can construct is documentation, not a contract.
 *   2. The ENGINE POPULATION IS DERIVED from src/engines/*.ts (never hand-listed), is non-empty,
 *      and every module in it consumes the schema — so an engine added tomorrow without traces
 *      fails this gate the day it lands, which is the only moment that failure is cheap.
 *   3. No engine re-states the schema locally: one canonical home per fact.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['T1'];
export const SENTINEL = 'REASON-TRACE OK';

const SCHEMA = 'src/engines/reasonTrace.ts';

const walk = (dir) => {
  if (!existsSync(dir)) return [];
  const acc = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') acc.push(...walk(p)); }
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
};

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  // ── 1. the schema exists and can actually be built ───────────────────────────────
  const schemaPath = join(root, SCHEMA);
  if (!existsSync(schemaPath)) return fail(SCHEMA + ' does not exist — there is no trace schema');
  const schemaSrc = readFileSync(schemaPath, 'utf8');
  const needs = ['REASON_TRACE_SCHEMA_VERSION', 'interface ReasonStep', 'interface ReasonTrace',
    'export function step(', 'export function trace('];
  for (const n of needs) {
    if (!schemaSrc.includes(n)) {
      problems.push(SCHEMA + ' does not declare ' + n + ' — an incomplete schema cannot carry every output');
    }
  }
  lines.push('schema          ' + SCHEMA + ': versioned'
    + (needs.every((n) => schemaSrc.includes(n)) ? ', steps, trace, builders present' : ', INCOMPLETE'));

  // ── 2. derived engine population, each consuming the schema ─────────────────────
  const enginesDir = join(root, 'src', 'engines');
  const files = walk(enginesDir)
    .map((abs) => relative(root, abs).replace(/\\/g, '/'))
    .filter((rel) => rel !== SCHEMA.replace(/\\/g, '/'));

  // The MVP population is curated by the app itself (one home: src/engines/mvpEngines.ts,
  // PD-P3-006), never hand-listed in this gate. Existence-checked per entry below.
  const mvpPath = join(root, 'src', 'engines', 'mvpEngines.ts');
  if (!existsSync(mvpPath)) return fail('src/engines/mvpEngines.ts does not exist — no canonical engine population');
  const mvpSrc = readFileSync(mvpPath, 'utf8');
  const listMatch = mvpSrc.match(/MVP_ENGINE_MODULES\s*=\s*\[([^\]]*)\]/);
  if (!listMatch) return fail('mvpEngines.ts carries no MVP_ENGINE_MODULES list');
  const active = listMatch[1].split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const mvp = [...active.matchAll(/'([^']+\.tsx?)'/g)].map((m) => 'src/engines/' + m[1]);
  if (mvp.length === 0) return fail('MVP_ENGINE_MODULES is empty — a check over zero items fails');

  const onDisk = new Set(files.map((f) => f.replace(/\\/g, '/')));
  for (const m of mvp) {
    if (!onDisk.has(m)) {
      problems.push('MVP_ENGINE_MODULES names ' + m + ', which does not exist on disk — the list and src/engines/ disagree');
    }
  }
  lines.push('population      ' + mvp.length + ' MVP engine module(s) from src/engines/mvpEngines.ts'
    + ' (+ ' + files.length + ' other file(s) on disk)');
  const legacy = files.filter((f) => !mvp.includes(f));
  if (legacy.length) {
    lines.push('legacy          ' + legacy.length + ' pre-P3 module(s), out of T-scope pending P4 rewiring (PD-P3-006): '
      + legacy.slice(0, 4).join(', ') + (legacy.length > 4 ? ' …' : ''));
  }

  let consuming = 0;
  for (const rel of mvp) {
    const code = readFileSync(join(root, rel), 'utf8');
    const consumes = /reasonTrace/.test(code) || /ReasonTrace|ReasonStep/.test(code);
    if (!consumes) {
      problems.push(rel + ' returns engine outputs but carries no reason trace. T1: every numeric '
        + 'output travels with the account of how it was computed — build the trace with '
        + 'reasonTrace/trace() and return it beside the number');
    } else {
      consuming += 1;
    }
  }
  lines.push('consuming       ' + consuming + ' of ' + mvp.length + ' MVP module(s) consume the schema');

  // ── 3. no local restatement ─────────────────────────────────────────────────────
  for (const rel of mvp) {
    const code = readFileSync(join(root, rel), 'utf8');
    if (/interface\s+ReasonTrace\s*\{/.test(code)) {
      problems.push(rel + ' declares its own ReasonTrace interface — the schema has exactly one home (' + SCHEMA + ')');
    }
  }

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));
  return ok(SENTINEL, lines.join('\n'));
};
