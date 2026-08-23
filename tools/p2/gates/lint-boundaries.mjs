/**
 * GATE: lint-boundaries — criteria B7, D2 and D5.  →  `BOUNDARY-LINT OK — 5 rules, 0 violations`
 *
 * Execution Model §9.4's five architectural-boundary rules, and the campaign's one hard ordering
 * constraint: *"This must exist before any parallel UI work. Not after the first violation."*
 *
 * WHAT THE SENTINEL CLAIMS, precisely. **Five rules ran** — not "five rules exist" — and **zero
 * violations were found in this tree**. It does NOT claim that every rule currently has something
 * to police: rule 5's `track()` boundary is criterion B6 and lands in Phase 10, and the gate says so
 * on its own line rather than letting a zero stand in for a proof.
 *
 * A RULE WITH NOTHING TO POLICE IS STILL PROVEN, by its negative control. Gate 3 requires *"every
 * rule has a recorded negative control"*, and this gate reads that record: `--controls` re-runs
 * them, and the gate refuses to pass if a rule has never been watched to fire. **A check that has
 * never failed is not yet a check** — so a rule with no control is treated exactly like a rule with
 * a violation.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBoundaryRules } from '../lib/boundary-rules.mjs';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['B7', 'D2', 'D5'];
export const SENTINEL = 'BOUNDARY-LINT OK — 5 rules, 0 violations';

/** Where the negative-control record lives. Written by tools/p2/boundary-controls.mjs. */
const CONTROL_RECORD = join(HERE, '..', 'boundary-controls.json');

export const run = async ({ root }) => {
  const { results, violations } = runBoundaryRules(root);
  const lines = [];
  const problems = [];

  if (results.length !== 5) {
    problems.push('expected 5 rules, ran ' + results.length + ' — §9.4 names five and a gate that runs four cannot print this sentinel');
  }

  for (const r of results) {
    lines.push('  rule ' + r.rule + '  ' + String(r.violations.length).padStart(3) + ' violation(s) · '
      + String(r.population).padStart(4) + ' in population · ' + r.name);
    if (r.note) lines.push('          ' + r.note);
    for (const v of r.violations.slice(0, 6)) lines.push('          VIOLATION ' + v.file + ':' + v.line + '  ' + v.detail);
    if (r.violations.length > 6) lines.push('          … and ' + (r.violations.length - 6) + ' more');
  }

  // --- every rule must have been watched to fire ------------------------------------
  if (!existsSync(CONTROL_RECORD)) {
    problems.push('no negative-control record at tools/p2/boundary-controls.json. Gate 3 requires every rule to have one, and a check that has never failed is not yet a check');
  } else {
    const rec = JSON.parse(readFileSync(CONTROL_RECORD, 'utf8'));
    const proven = new Set((rec.controls ?? []).filter((c) => c.fired).map((c) => c.rule));
    const unproven = results.map((r) => r.rule).filter((n) => !proven.has(n));
    if (unproven.length) {
      problems.push('rule(s) ' + unproven.join(', ') + ' have no recorded negative control that fired');
    }
    lines.push('');
    lines.push('  controls        ' + (rec.controls ?? []).filter((c) => c.fired).length + ' of '
      + (rec.controls ?? []).length + ' fired · recorded ' + (rec.recordedAt ?? '?'));
    if (rec.sha) lines.push('  controls at sha ' + rec.sha);
  }

  // WHAT THIS SENTINEL DOES NOT CLAIM, said here rather than left to be assumed. These are the
  // five rules of Execution Model §9.4. They are NOT the only five boundary rules this repository
  // has: `.eslintrc.boundaries.js` implements R1..R5 — the lint that produced the E1 backlog — and
  // when these rules first ran clean, that one found 58 on the same tree. Criterion D7 and the gate
  // `e1-backlog` own that lint. A reader who takes `0 violations` here as "no boundary violation
  // exists anywhere" is reading more than it says, which is why it now says it.
  lines.push("");
  lines.push("  also required   e1-backlog (D7) runs .eslintrc.boundaries.js R1..R5; this gate is not that gate");

  if (violations.length) {
    problems.push(violations.length + ' boundary violation(s) across ' + new Set(violations.map((v) => v.rule)).size + ' rule(s)');
  }

  if (problems.length) return fail(problems.join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'BOUNDARY-LINT OK — ' + results.length + ' rules, ' + violations.length + ' violations',
  };
};
