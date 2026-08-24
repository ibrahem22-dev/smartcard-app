/**
 * GATE: ob1-named-records — criterion A4.  →  `OB-1 OK — named records rendered`
 *
 *   > **A4.** *"`conflictRenderPlan`'s **both** members render correctly, demonstrated **by record
 *   > id**: `DISPUTED_WITHOUT_CANDIDATES` on `term:one-zero|research:FX_COMMISSION_PCT:4` renders
 *   > *"This figure is disputed"* and nothing further; empty `conflictIds` produces neither
 *   > spinner, error, nor fallback."*
 *
 *   > **OB-1.** *"Exactly **one** shipped row carries this today."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "BY RECORD ID" IS THE WHOLE INSTRUCTION
 *
 * A test that constructed a conflict with no candidates would prove the code path and prove nothing
 * about the estate. OB-1's claim is about the estate: one row, named, and this gate re-measures the
 * count from the shipped pack rather than quoting it. A second row appearing is a failure here
 * rather than a sentence in a document that quietly stopped being true.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * BOTH MEMBERS, OR THE TEST IS ONE-SIDED
 *
 * Every assertion about `DISPUTED_WITHOUT_CANDIDATES` would pass in a build where that was the only
 * plan ever returned. So the gate requires the real pack to reach **both** members of the closed
 * domain — 41 rows and 1, today — and requires the render suite to prove a candidate block appears
 * for one and not for the other.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * AND THE THREE PROHIBITIONS ARE SCANNED, NOT ASSUMED
 *
 *   > **OB-1.** *"What P2 must NOT do: treat an empty `conflictIds` as a loading state, an error,
 *   > or a reason to hide the fact."*
 *
 * The gate looks for the shortcut: a surface switching on `candidates.length` instead of on the
 * plan. That is not a style preference — it is the same mistake A5 forbids with `label === null`,
 * and a third availability member would arrive with zero candidates and need saying differently.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['A4'];
export const SENTINEL = 'OB-1 OK — named records rendered';

/** The record the criterion names. Written here so a rename of the row fails this gate. */
const ADJ_005_ROW = 'term:one-zero|research:FX_COMMISSION_PCT:4';

const CATALOG = join('src', 'data', 'adapter', 'packs', 'catalog', 'pack.json');
const COMPONENT = 'src/components/ConflictedValue.tsx';
const BRIDGE = 'src/data/adapter/conflictRender.ts';
const SHAPE = 'src/data/adapter/conflictRenderPlan.ts';

const SUITES = [
  ['src/data/adapter/__tests__/namedRecords.test.ts', [
    'the named row is in the shipped pack',
    'carries NO_RECORDED_COUNTERPARTY, and therefore DISPUTED_WITHOUT_CANDIDATES',
    'produces NEITHER SPINNER, ERROR, NOR FALLBACK — each asserted as a value',
    'EXACTLY ONE shipped row is in this state — re-measured, not quoted',
    'RENDER_ALL_CANDIDATES is reached by real rows — the control',
    'BOTH members of the closed domain are reached by the real pack',
    'an unknown plan THROWS rather than rendering nothing',
  ]],
  ['src/components/__tests__/NamedRecordRender.render.test.tsx', [
    'shows NOTHING FURTHER — no candidate block at all',
    'DOES NOT HIDE THE FACT — the component renders, it does not return null',
    'the OTHER plan does render candidates — the control',
    'the PLAN decides, not the candidate count',
  ]],
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

  for (const rel of [COMPONENT, BRIDGE, SHAPE]) {
    if (!existsSync(join(root, rel))) return fail(rel + ' does not exist');
  }
  if (!existsSync(join(root, CATALOG))) {
    return fail(CATALOG + ' does not exist. A4 is demonstrated BY RECORD ID, and without the pack '
      + 'this gate could only check that a code path exists');
  }

  // ── the population, re-measured from the shipped pack ────────────────────────────
  const require_ = createRequire(join(root, 'package.json'));
  let adapter;
  try {
    adapter = require_('@smartcard/data-authority-adapter');
  } catch (e) {
    return fail('the adapter will not load: ' + (e && e.message ? e.message : String(e)));
  }

  const pack = JSON.parse(readFileSync(join(root, CATALOG), 'utf8'));
  let cost;
  try {
    cost = adapter.CostModelAdapter.open(
      {
        datasetId: pack.datasetId,
        datasetVersion: pack.datasetVersion,
        feeTerms: pack.units.fees,
        fxPairs: pack.units.fx,
        conflicts: pack.conflicts,
      },
      { expectedDatasetId: pack.datasetId },
    );
  } catch (e) {
    return fail('the cost model will not open: ' + (e && e.message ? e.message : String(e)));
  }

  const conflicted = (pack.units.fees ?? []).filter((f) => f?.consumability?.verdict === 'CONFLICTED');
  if (conflicted.length === 0) {
    return fail('the pack carries no CONFLICTED fee term. A4 is about how a conflict renders, and '
      + 'an empty population would let this gate report "both plans handled" for a pack with '
      + 'nothing to handle');
  }

  const byPlan = new Map();
  for (const f of conflicted) {
    const availability = adapter.conflictRecordAvailabilityOf(cost.conflictsFor(f.termId) ?? []);
    const plan = adapter.conflictRenderPlan(availability);
    if (!byPlan.has(plan)) byPlan.set(plan, []);
    byPlan.get(plan).push(f.termId);
  }

  // Both members reached. A member nothing reaches is a member nobody has tested.
  for (const member of adapter.CONFLICT_RENDER_PLAN) {
    if (!byPlan.has(member)) {
      problems.push('no shipped row reaches ' + member + '. Every assertion about the other member '
        + 'would pass in a build where it was the only plan ever returned');
    }
  }

  const disputed = byPlan.get('DISPUTED_WITHOUT_CANDIDATES') ?? [];
  if (disputed.length !== 1) {
    problems.push('OB-1 says EXACTLY ONE shipped row carries DISPUTED_WITHOUT_CANDIDATES and this '
      + 'pack carries ' + disputed.length + ': ' + disputed.slice(0, 3).join(', ')
      + '. The count is a claim about the estate and it is re-measured here, so a change is a '
      + 'failure rather than a document that quietly stopped being true');
  } else if (disputed[0] !== ADJ_005_ROW) {
    problems.push('the one DISPUTED_WITHOUT_CANDIDATES row is "' + disputed[0] + '" and A4 names "'
      + ADJ_005_ROW + '". The criterion demonstrates BY RECORD ID, so a different row is a '
      + 'different demonstration');
  }

  // ── the plan is switched on, not inferred from a length ──────────────────────────
  const component = stripComments(readFileSync(join(root, COMPONENT), 'utf8'));
  if (!/describePlan|plan\b/.test(component)) {
    problems.push(COMPONENT + ' never reads the render plan. OB-1 says to CALL conflictRenderPlan '
      + 'and handle both members');
  }
  const files = walk(join(root, 'src'));
  const lengthSwitches = [];
  for (const abs of files) {
    const rel = relative(root, abs).replace(/\\/g, '/');
    const code = stripComments(readFileSync(abs, 'utf8'));
    if (!/conflict/i.test(code)) continue;
    for (const m of code.matchAll(/candidates\s*\.\s*length\s*===\s*0|conflictIds\s*\.\s*length\s*===\s*0/g)) {
      lengthSwitches.push({ file: rel, line: lineAt(code, m.index), text: m[0] });
    }
  }
  for (const l of lengthSwitches.slice(0, 4)) {
    problems.push(l.file + ':' + l.line + ' decides on "' + l.text + '" rather than on the render '
      + 'plan. A length is a SYMPTOM of a state; the field that carries the state is the one to '
      + 'switch on, and a third availability member would also arrive with zero candidates');
  }

  // ── the three prohibitions are values, not comments ──────────────────────────────
  const shape = stripComments(readFileSync(join(root, SHAPE), 'utf8'));
  for (const field of ['showsSpinner', 'showsError', 'hidesTheFact']) {
    if (!new RegExp('\\b' + field + '\\b').test(shape)) {
      problems.push(SHAPE + ' does not carry ' + field + '. OB-1 names three things P2 must not do, '
        + 'and a prohibition that is only a comment is one nothing can hold to account');
    }
  }

  // ── run both halves ──────────────────────────────────────────────────────────────
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(jest)) return fail('no jest binary — none of this can be proven by running it');
  for (const [suite, cases] of SUITES) {
    if (!existsSync(join(root, suite))) { problems.push(suite + ' does not exist'); continue; }
    const r = spawnSync(process.execPath, [jest, suite, '--verbose', '--ci'], {
      cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    });
    const out = String(r.stdout ?? '') + String(r.stderr ?? '');
    for (const name of cases) {
      const passed = new RegExp('[√✓]\\s*' + escapeForRegExp(name)).test(out);
      const skipped = new RegExp('(○|skipped)\\s+' + escapeForRegExp(name)).test(out);
      if (skipped) problems.push('SKIPPED: "' + name + '"');
      else if (!passed) problems.push('did not pass: "' + name + '"');
    }
    lines.push('suite           ' + suite.split('/').pop() + ' · ' + (out.match(/Tests:\s+.*/) ?? ['(no summary)'])[0].trim());
  }

  lines.push('population      ' + conflicted.length + ' CONFLICTED fee term(s) in the shipped pack');
  for (const member of adapter.CONFLICT_RENDER_PLAN) {
    lines.push('  ' + member.padEnd(30) + (byPlan.get(member) ?? []).length + ' row(s)');
  }
  lines.push('named record    ' + (disputed[0] ?? '(none)'));
  lines.push('                ' + (disputed[0] === ADJ_005_ROW ? 'matches A4' : 'DOES NOT match A4'));
  lines.push('length switches ' + lengthSwitches.length + ' site(s) deciding on a candidate count');
  lines.push('');
  lines.push('AN EMPTY conflictIds IS AN ANSWER, NOT AN ABSENCE OF ONE. The estate graded the fact as');
  lines.push('  disputed and named no counterparty anywhere in the corpus. §7.3 requires two or more');
  lines.push('  participants precisely so a record always names a real disagreement, and');
  lines.push('  manufacturing a one-participant record would assert a disagreement whose other side');
  lines.push('  does not exist. The pipeline refuses, and the refusal is correct.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return ok(SENTINEL, lines.join('\n'));
};
