/**
 * MDC LADDER REPORT — shared vocabulary for the STAGE-1..4 gates.
 *
 * Carried unchanged in intent from `tools/p5/lib/report.mjs`, because the two things it exists to
 * prevent both bit this project already:
 *
 *   MEASURES. A gate declares WHAT KIND of thing it looked at. P5's R3 declared a contrast check
 *   and measured zero pairings; its report could not say so, because a report that cannot
 *   distinguish "read the source" from "rendered the screen" cannot be audited for whether the
 *   right kind of evidence was taken. Declaring the kind is what makes that audit possible.
 *
 *   A POPULATION OF ZERO IS A FAILURE. Every gate reports how many things it examined. A check
 *   over nothing is not a passing check, and `okOverPopulation` refuses to call it one.
 */

/**
 * source     — read files on disk; proves what the code says, never what it does at runtime.
 * runtime    — executed the code (a render, an engine call, a store transaction).
 * device     — observed on a device or emulator, with a captured artifact.
 * agreement  — compared two or more independently-derived answers to the same question.
 * artifact   — inspected a built output (a bundle, an APK, a pack) rather than its source.
 */
export const MEASUREMENT_KINDS = ['source', 'runtime', 'device', 'agreement', 'artifact'];

export const isMeasurementKind = (k) => MEASUREMENT_KINDS.includes(k);

/**
 * The only way a gate should return ok:true.
 *
 * `population` is how many things the gate actually examined — files, renders, scenarios,
 * conflicts, captures. Zero means the gate found nothing to look at, which is a FAILURE and not a
 * pass, however green the rest of it looks. This is the PD-P5-008 rule made a function so no gate
 * has to remember it.
 */
export function okOverPopulation({ population, unit, detail, floor = 1 }) {
  if (typeof population !== 'number' || Number.isNaN(population)) {
    return { ok: false, population: 0, message: 'gate reported no population — a check that cannot say how much it examined cannot be trusted to have examined anything' };
  }
  if (population < floor) {
    return {
      ok: false,
      population,
      message: `population ${population} is below the floor of ${floor}${unit ? ' ' + unit : ''} — a check over nothing is not a passing check`,
    };
  }
  return { ok: true, population, message: detail || `${population}${unit ? ' ' + unit : ''}` };
}

export function fail(message, extra = {}) {
  return { ok: false, message, ...extra };
}

export function notImplemented(why) {
  return { ok: false, notImplemented: true, message: why || 'not implemented' };
}

/** A check that cannot run here says so by name. Contract §2 rule 10: UNKNOWN is an answer. */
export function notEvaluated(why) {
  return { ok: false, notEvaluated: true, message: why || 'NOT-EVALUATED in this environment' };
}

// ---------------------------------------------------------------------------------------------
// RUNTIME MEASUREMENT — a gate requires NAMED jest cases to exist AND pass.
//
// Ported from tools/p5/lib/report.mjs, ANSI handling and all, because D-042 is the kind of defect
// that returns the moment someone reimplements this from memory: jest writes a bare "√ name" when
// it decides the output is not a terminal and an escape-wrapped one when it decides it is, `\s*`
// does not match an escape sequence, and a shell carrying FORCE_COLOR=3 once turned 35 of P5's 46
// gates red at once — each reporting its cases missing while its own summary line said "11 passed"
// three words later. It fails toward red, which is the safe direction, but a ladder whose result
// depends on whether the shell wanted colour is not reproducible.
// ---------------------------------------------------------------------------------------------
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ANSI = new RegExp(String.fromCharCode(27) + String.fromCharCode(92) + '[[0-9;]*m', 'g');
const stripAnsi = (t) => t.replace(ANSI, '');

export const requireJestCases = (root, suite, cases, extraArgs = []) => {
  const jest = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  if (!existsSync(join(root, suite))) return { problems: [suite + ' does not exist'], summary: null, ran: 0 };
  if (!existsSync(jest)) return { problems: ['no jest binary'], summary: null, ran: 0 };
  const r = spawnSync(process.execPath, [jest, suite, '--verbose', '--ci', ...extraArgs], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const out = stripAnsi(String(r.stdout ?? '') + String(r.stderr ?? ''));
  const escapeForRegExp = (t) => t.replace(/[.*+?${}()|[\]\\]/g, String.fromCharCode(92) + '$&');
  const problems = [];
  for (const name of cases) {
    const escaped = escapeForRegExp(name);
    if (new RegExp('(○|skipped|todo)\\s+' + escaped).test(out)) problems.push('SKIPPED: "' + name + '"');
    else if (!new RegExp('[√✓]\\s*' + escaped).test(out)) problems.push('did not pass: "' + name + '"');
  }
  const m = out.match(/Tests:\s+.*/);
  // A suite that ran zero tests is not a passing suite, however few cases were required.
  const totals = out.match(/Tests:\s+(\d+)\s+passed/);
  const ran = totals ? Number(totals[1]) : 0;
  if (ran === 0) problems.push('the suite reported zero passing tests — a runtime measurement that ran nothing measured nothing');
  return { problems, summary: m ? m[0].trim() : '(no summary)', output: out, ran };
};
