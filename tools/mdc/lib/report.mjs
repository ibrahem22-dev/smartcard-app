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
