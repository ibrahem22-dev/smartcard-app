/**
 * GATE: ob-coverage — criterion F7.  →  `OB-COVERAGE OK — 8 of 8 mapped`
 *
 *   > **F7.** *"**Every OB-1…OB-8 obligation maps to a SATISFIED criterion or a DEFERRED entry**
 *   > carrying a reason."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A CRITERION MAY NOT ANSWER FOR ITSELF
 *
 * F7 is the criterion that checks this coverage. If F7 counted as an answer, "OB-8 is covered by the
 * criterion that checks whether OB-8 is covered" would pass — **a circle with a green tick on it**.
 * The mirror excludes F7, F9 and F10 when it derives the map, and this gate re-states why rather
 * than leaving the exclusion as an implementation detail somebody could quietly remove.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * "OR A DEFERRED ENTRY CARRYING A REASON" IS THE HALF THAT USUALLY ROTS
 *
 * An obligation with no criterion is not a failure — **OB-8 has none, and cannot have one**: closing
 * it needs a hardware-backed signing key the Owner has to provide. What would be a failure is an
 * obligation with no criterion *and* no entry saying so.
 *
 * So the gate accepts either, and refuses the third state: an obligation nothing answers, which is
 * exactly the state a handoff produces when it transfers work nobody read.
 *
 * The population is the handoff's own `### OB-n` sections, parsed. A gate that hardcoded eight would
 * be silent about a ninth.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, fail } from '../lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CRITERIA = ['F7'];
export const SENTINEL = 'OB-COVERAGE OK';

const RECORDS = join('tools', 'p2', 'campaign-records.json');

/** States that count as an answer. Anything else is an obligation still in flight. */
const SATISFIED = new Set(['SATISFIED']);

export const run = async ({ root }) => {
  const problems = [];
  const lines = [];

  if (!existsSync(join(root, RECORDS))) {
    return fail(RECORDS + ' does not exist. F7 is about records that live in the pipeline, and they '
      + 'cross through this mirror — run campaign-p2/bin/p2-campaign-records.mjs');
  }
  const records = JSON.parse(readFileSync(join(root, RECORDS), 'utf8'));
  const coverage = records.obCoverage ?? [];

  if (coverage.length === 0) {
    return fail('the mirror records no obligation. F7 is about a population, and an empty one would '
      + 'let this gate report "0 of 0 mapped" and call it green');
  }
  if (coverage.length < 8) {
    problems.push('only ' + coverage.length + ' obligation(s) were parsed from the handoff. F7 names '
      + 'OB-1 through OB-8, so a smaller population means the parse missed some — and an obligation '
      + 'nobody parsed is an obligation nobody checked');
  }

  let mapped = 0;
  for (const o of coverage) {
    const satisfied = (o.answeredBy ?? []).filter((a) => SATISFIED.has(a.state));
    const open = (o.answeredBy ?? []).filter((a) => !SATISFIED.has(a.state));

    if (satisfied.length > 0) {
      mapped += 1;
      lines.push('  ' + o.ob.padEnd(6) + 'SATISFIED by ' + satisfied.map((a) => a.id).join(', ')
        + (o.alsoDeferred ? '  (+ a deferred entry)' : ''));
      continue;
    }
    if (o.alsoDeferred) {
      mapped += 1;
      lines.push('  ' + o.ob.padEnd(6) + 'DEFERRED, with a reason in the P2 register'
        + (open.length ? '  (' + open.map((a) => a.id + '=' + a.state).join(', ') + ' still open)' : ''));
      continue;
    }
    problems.push(o.ob + ' maps to nothing: no SATISFIED criterion and no entry in the P2 deferred '
      + 'register. ' + (open.length
        ? 'It is named by ' + open.map((a) => a.id + '=' + a.state).join(', ') + ', which is a '
          + 'criterion still in flight rather than an answer'
        : 'No criterion names it at all')
      + '. This is the state a handoff produces when it transfers work nobody read');
  }

  lines.unshift('obligations     ' + coverage.length + ' parsed from the handoff · ' + mapped + ' mapped');
  lines.push('');
  lines.push('F7, F9 AND F10 ARE EXCLUDED FROM ANSWERING. F7 is the criterion that checks this');
  lines.push('  coverage, so counting it would let "OB-8 is covered by the criterion that checks');
  lines.push('  whether OB-8 is covered" pass — a circle with a green tick on it.');
  lines.push('');
  lines.push('AN OBLIGATION WITH NO CRITERION IS NOT A FAILURE. OB-8 has none and cannot have one:');
  lines.push('  closing it needs a hardware-backed signing key the Owner has to provide. What would');
  lines.push('  be a failure is an obligation with no criterion AND no entry saying so.');

  if (problems.length) return fail(problems.length + ' problem(s): ' + problems.slice(0, 4).join(' · '), lines.join('\n'));

  return {
    ...ok(SENTINEL, lines.join('\n')),
    sentinelOverride: 'OB-COVERAGE OK — ' + mapped + ' of ' + coverage.length + ' mapped',
  };
};
