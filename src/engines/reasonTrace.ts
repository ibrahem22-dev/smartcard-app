import { APP_IDENTITY } from '../config/identity';
/**
 * THE REASON-TRACE SCHEMA — criterion T1, roadmap §10 P3 Outputs.
 *
 *   > *"Every numeric output carries a provenance state and a reason trace."*
 *
 * A reason trace is an ENGINE OUTPUT, not UI copy. It travels beside the number it explains, in the
 * same object, so no surface can render the number without also holding its account — and so a
 * reviewer can reconstruct any figure from its steps instead of believing it. What a surface does
 * with the trace (show it, collapse it, log it) is P4's business; carrying it is the engine's.
 *
 * THE SCHEMA IS CLOSED AND VERSIONED
 *
 * Every trace names its schema version, so a surface that meets a newer shape refuses rather than
 * guesses at unknown fields. Steps cite the rule that produced them by id — an ADR section, an
 * Owner Decision, a named arithmetic step — because a trace that says "we computed something" is
 * not a trace, it is a shrug printed in JSON.
 */

/** Why the schema version is stamped on every value: see the module comment. */

/** The slug travels with the identity, per OD-2 � the version string is assembled, never scattered. */
export const REASON_TRACE_SCHEMA_VERSION = `${APP_IDENTITY.slug}.reason-trace.v1`;

/** One reconstructable move in the derivation. */
export interface ReasonStep {
  /** The rule that produced this step: 'ADR-013 §2', 'quoteUnit divide', 'card-level exception'. */
  readonly rule: string;
  /** What was done, in one honest sentence, naming its operands' meaning rather than their bytes. */
  readonly detail: string;
  /**
   * The named inputs the step consumed, e.g. ['amount', 'rateIlsPerQuoteUnit', 'quoteUnit'].
   * Names, not values — the values travel in the result beside the trace.
   */
  readonly inputs?: readonly string[];
}

/** The account that travels with every engine output. */
export interface ReasonTrace {
  readonly schema: typeof REASON_TRACE_SCHEMA_VERSION;
  /** Which engine produced this: 'currency', 'scoring', 'verdict', 'load', 'risk'. */
  readonly engine: string;
  readonly steps: readonly ReasonStep[];
}

/** Build one step. Kept trivially thin so call sites read as prose. */
export function step(
  rule: string,
  detail: string,
  inputs?: readonly string[],
): ReasonStep {
  if (!rule.trim()) throw new Error('a reason step without a rule citation is a shrug, not a step');
  if (!detail.trim()) throw new Error('a reason step without a detail says nothing');
  return inputs ? { rule, detail, inputs: [...inputs] } : { rule, detail };
}

/** Build a trace. Rejects an empty step list: an output with nothing to explain has no engine here. */
export function trace(engine: string, steps: readonly ReasonStep[]): ReasonTrace {
  if (!engine.trim()) throw new Error('a trace must name the engine that produced it');
  if (steps.length === 0) {
    throw new Error('an empty reason trace is a vacuous pass — say what happened or carry no trace');
  }
  return { schema: REASON_TRACE_SCHEMA_VERSION, engine, steps: [...steps] };
}