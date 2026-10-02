/**
 * GATE: no-rederivation — criterion B4.  →  `NO-REDERIVATION OK`
 *
 *   > **B4.** *"None of the interfaces named in P2 handoff §3 and P3 handoff §2 is re-derived
 *   > anywhere in the application, P5 surfaces included."*
 *
 * MEASURES: 'source'.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * TWO HANDOFFS, AND ONLY ONE OF THEM ALREADY HAS A GATE
 *
 * P2's `no-rederivation` gate owns the first half: eight interfaces derived from
 * `tools/p2/interfaces.json`, each with a watched negative control, over all of `src/**` — so P5's
 * surfaces were in its population the moment they were written. P4's B4 delegated to it and stopped
 * there, which was right for P4's sentence.
 *
 * P5's sentence is longer. It adds **P3 handoff §2**, and that table names nine facts P2's eight do
 * not cover: engine arithmetic, where currency conversion lives, the BOI fetch rules, the holiday
 * calendar's authority, the pack-verification bridge. Delegating alone would have quietly answered
 * a narrower question than the criterion asks — and printed the contracted sentinel while doing it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE POPULATION IS PARSED FROM THE HANDOFF, AND EVERY ROW MUST BE ACCOUNTED FOR
 *
 * §2 rule 4: derive, never hand-list. The rows come out of `P3_TO_P4_HANDOFF.md` §2, and each one
 * must be matched by a declared check or by a declared reason it cannot be checked in the app.
 * A row matching neither FAILS.
 *
 * That last part is the whole design. P2's gate already works this way — it refuses if the handoff
 * grows a ninth interface — and the reason is that the failure mode of a hand-listed population is
 * not a wrong answer, it is a shrinking question nobody notices. A tenth row added to that table
 * next year must stop this gate, not slide past it.
 *
 * Two rows are pipeline-side and say so: the scenario battery and the required gate set live in
 * `tools/p3/`, and an application cannot re-derive a file it does not contain. That is a
 * classification with a reason, recorded in the output, not a silent skip.
 *
 * NEGATIVE CONTROL: re-implement one of these in the app — restate the provenance vocabulary as
 * local literals, or divide by a rate outside the engines — and watch this fail.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as p2 from '../../p2/gates/no-rederivation.mjs';
import { ok, fail } from '../lib/report.mjs';

export const CRITERIA = ['B4'];
export const SENTINEL = 'NO-REDERIVATION OK';
export const MEASURES = 'source';

const HANDOFF_CANDIDATES = [
  '../smartcard-data-pipeline/campaign-p3/P3_TO_P4_HANDOFF.md',
  '../campaign-p3/P3_TO_P4_HANDOFF.md',
];

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const walk = (abs, acc = []) => {
  if (!existsSync(abs)) return acc;
  for (const e of readdirSync(abs)) {
    const p = join(abs, e);
    if (statSync(p).isDirectory()) { if (e !== '__tests__' && e !== 'node_modules') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e)) acc.push(p);
  }
  return acc;
};

const rel = (root, abs) => abs.slice(root.length + 1).replace(/\\/g, '/');

/**
 * One check per P3 §2 row. `match` identifies the row in the handoff table by a phrase from its
 * "Fact" cell, so a reworded row fails to match and this gate stops — which is the point.
 */
const P3_ROW_CHECKS = [
  {
    match: /engine arithmetic/i,
    what: 'engine arithmetic, including the divide',
    check: ({ root, files }) => {
      const problems = [];
      for (const abs of files) {
        const r = rel(root, abs);
        if (/^src\/engines\//.test(r)) continue;
        const src = stripComments(readFileSync(abs, 'utf8'));
        for (const m of src.matchAll(/\/\s*[A-Za-z_$][\w$.]*(?:[Rr]ate|[Qq]uoteUnit)\b/g)) {
          problems.push(r + ':' + src.slice(0, m.index).split('\n').length
            + ' divides by ' + m[0].replace(/^\/\s*/, '') + ' outside src/engines/ — the divide has one home');
        }
      }
      return problems;
    },
  },
  {
    match: /provenance vocabulary/i,
    what: 'the provenance vocabulary',
    check: ({ root, files }) => {
      const home = 'src/authority/provenanceChip.ts';
      const problems = [];
      const VOCAB = /'(USER|VERIFIED|ESTIMATE|UNKNOWN)'/g;
      for (const abs of files) {
        const r = rel(root, abs);
        if (r === home) continue;
        const src = stripComments(readFileSync(abs, 'utf8'));
        /* A file that declares the set is restating it; a file comparing one value is consuming it. */
        for (const m of src.matchAll(/\[\s*(?:'(?:USER|VERIFIED|ESTIMATE|UNKNOWN)'\s*,\s*){2,}/g)) {
          problems.push(r + ':' + src.slice(0, m.index).split('\n').length
            + ' restates the provenance vocabulary as local literals — it has one home, ' + home);
        }
        void VOCAB;
      }
      return problems;
    },
  },
  {
    match: /conflict classification/i,
    what: 'conflict classification',
    check: ({ root, files }) => {
      const problems = [];
      for (const abs of files) {
        const r = rel(root, abs);
        const src = stripComments(readFileSync(abs, 'utf8'));
        /* Consuming these is right; DEFINING one in the app is the re-derivation OB-6 forbids. */
        for (const m of src.matchAll(/(?:function|const)\s+(disagreementAxis|intervalRankability)\b/g)) {
          problems.push(r + ':' + src.slice(0, m.index).split('\n').length
            + ' defines ' + m[1] + ' in the application — the pipeline classifies, the app consumes (OB-6)');
        }
      }
      return problems;
    },
  },
  {
    match: /currency conversion location/i,
    what: 'where currency conversion happens',
    check: ({ root, files }) => {
      const problems = [];
      for (const abs of files) {
        const r = rel(root, abs);
        if (!/^src\/(data\/adapter|screens|components)\//.test(r)) continue;
        const src = stripComments(readFileSync(abs, 'utf8'));
        for (const m of src.matchAll(/[*/]\s*[A-Za-z_$][\w$.]*(?:[Rr]ate|[Qq]uoteUnit)\b/g)) {
          problems.push(r + ':' + src.slice(0, m.index).split('\n').length
            + ' converts currency in ' + r.split('/').slice(0, 2).join('/') + ' — OD-23a/23b put conversion in the ENGINE');
        }
      }
      return problems;
    },
  },
  {
    match: /BOI fetch rules/i,
    what: 'the BOI fetch rules',
    check: ({ root, files }) => {
      const home = 'src/data/fx/liveFetch.ts';
      const problems = [];
      for (const abs of files) {
        const r = rel(root, abs);
        if (r === home) continue;
        const src = stripComments(readFileSync(abs, 'utf8'));
        if (/\bfetch\s*\(/.test(src) && /boi|bankisrael|shaarey/i.test(src)) {
          problems.push(r + ' opens a second BOI fetch path — ' + home + ' is the one home');
        }
      }
      return problems;
    },
  },
  {
    match: /holiday calendar authority/i,
    what: 'the holiday calendar authority',
    check: ({ root, files }) => {
      const problems = [];
      for (const abs of files) {
        const r = rel(root, abs);
        const src = stripComments(readFileSync(abs, 'utf8'));
        /* Three or more hard dates in one array is a shipped calendar, not a fixture reference. */
        for (const m of src.matchAll(/\[\s*(?:'\d{4}-\d{2}-\d{2}'\s*,\s*){3,}/g)) {
          problems.push(r + ':' + src.slice(0, m.index).split('\n').length
            + ' ships a hard-coded date list — a calendar needs a named Owner-approved authority (OQ-P3-001 Option B)');
        }
      }
      return problems;
    },
  },
  {
    match: /pack verification crypto bridge/i,
    what: 'the pack-verification crypto bridge',
    check: ({ root, files }) => {
      const problems = [];
      for (const abs of files) {
        const r = rel(root, abs);
        if (/^src\/data\/adapter\//.test(r)) continue;
        const src = stripComments(readFileSync(abs, 'utf8'));
        if (/createVerify|verify\s*\(\s*['"]RSA|subtle\.verify/.test(src)) {
          problems.push(r + ' implements pack verification outside the adapter — the bridge is not forked per surface (PD-P3-008)');
        }
      }
      return problems;
    },
  },
];

/** Rows that name a pipeline file. An application cannot re-derive what it does not contain. */
const PIPELINE_SIDE = [
  { match: /scenario battery/i, why: 'tools/p3/scenarios.mjs and the engine scenario test are pipeline files' },
  { match: /required gate set/i, why: 'tools/p3/required-gates.json is generated in the pipeline' },
];

export const run = async ({ root }) => {
  /* ── half one: P2 handoff §3, delegated to the gate that owns it ───────────────────────── */
  const inner = await p2.run({ root });
  if (!inner.ok) {
    return fail("P2's no-rederivation gate refuses this tree, so B4's first half is unmet: "
      + String(inner.message ?? inner.sentinel ?? '(no message)'));
  }
  if (!String(inner.sentinel ?? '').includes(SENTINEL)) {
    return fail('the inner gate printed "' + String(inner.sentinel) + '", which does not carry the contracted sentinel');
  }

  /* ── half two: P3 handoff §2, derived from the handoff itself ──────────────────────────── */
  const handoffPath = HANDOFF_CANDIDATES.map((p) => join(root, p)).find((p) => existsSync(p));
  if (!handoffPath) {
    return fail('P3_TO_P4_HANDOFF.md could not be found, so B4\'s second half has no population — and a '
      + 'gate that cannot read its own population would pass forever while checking half the criterion');
  }
  const handoff = readFileSync(handoffPath, 'utf8');
  const section = handoff.slice(handoff.indexOf('## 2. WHAT P4 MUST NOT RE-DERIVE'));
  const table = section.slice(0, section.indexOf('\n## '));
  const rows = [...table.matchAll(/^\|\s*(?!Fact\b)(?!-)([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm)]
    .map((m) => ({ fact: m[1].replace(/\*\*/g, '').trim(), home: m[2].trim() }))
    /* The header and the separator are table furniture, not rows. A lookahead was tried and
       backtracking walked around it: \s* matched zero characters, so the check sat before the
       space rather than before the word. Filtering the parsed value is what actually holds. */
    .filter((r) => r.fact && r.fact !== 'Fact' && !/^-+$/.test(r.fact));

  if (rows.length === 0) {
    return fail('P3 handoff §2 parsed to zero rows — the population is derived from that table, and an '
      + 'empty derivation is the vacuous pass §2 rule 5 refuses, not a clean bill of health');
  }

  const files = walk(join(root, 'src'));
  if (files.length === 0) return fail('no source files under src/ — nothing to check for re-derivation');

  const problems = [];
  let checkedRows = 0;
  const classified = [];

  for (const row of rows) {
    const check = P3_ROW_CHECKS.find((c) => c.match.test(row.fact));
    if (check) {
      checkedRows += 1;
      problems.push(...check.check({ root, files }));
      continue;
    }
    const side = PIPELINE_SIDE.find((c) => c.match.test(row.fact));
    if (side) { classified.push(row.fact + ' — ' + side.why); continue; }
    problems.push(
      'P3 handoff §2 names "' + row.fact + '" and this gate has neither a check for it nor a recorded '
        + 'reason it cannot be checked in the application. A row nobody has handled is the question '
        + 'quietly getting smaller, which is exactly what deriving the population is meant to prevent',
    );
  }

  /* And the reverse: a check for a row the handoff no longer names is a check measuring nothing. */
  for (const c of P3_ROW_CHECKS) {
    if (!rows.some((r) => c.match.test(r.fact))) {
      problems.push('this gate checks ' + c.what + ', which P3 handoff §2 no longer names — a check whose '
        + 'row has gone is a check that cannot fail for a reason anybody still cares about');
    }
  }

  if (problems.length) return fail(problems.slice(0, 8).join(' · ')
    + (problems.length > 8 ? ' · …and ' + (problems.length - 8) + ' more' : ''));

  return ok(SENTINEL, [
    'CRITERION B4 — no re-derivation, across BOTH handoffs, over ' + files.length + ' application file(s).',
    'P2 handoff §3: delegated to tools/p2/gates/no-rederivation.mjs — eight interfaces derived from',
    '  tools/p2/interfaces.json, each with a watched negative control, over all of src/**. P5\'s',
    '  surfaces were in that population from the moment they were written.',
    'P3 handoff §2: ' + rows.length + ' row(s) parsed from the handoff itself, ' + checkedRows + ' checked here and '
      + classified.length + ' classified',
    '  as pipeline-side with a reason:',
    ...classified.map((c) => '    · ' + c),
    'Every row must be matched by a check or by a recorded reason, and a row matching neither FAILS.',
    '  P4\'s B4 delegated to P2 alone, which was right for P4\'s sentence; P5\'s sentence adds the second',
    '  handoff, and delegating alone would have answered a narrower question than the criterion asks',
    '  while printing the contracted sentinel. The reverse is checked too: a check whose row has left',
    '  the table is a check that can no longer fail for a reason anybody cares about.',
  ].join('\n'));
};
