import { MAY_RENDER_AS_VERIFIED, type ProvenanceChip } from './provenanceChip';

/**
 * THE FOUR HONESTY PROPERTIES — criterion E4, ladder rung L10, Owner Decision OD-3.
 *
 *   > **L10 Honesty tests.** *"no unlabelled number · "Verified" never on a derived figure ·
 *   > UNKNOWN stacking never sums · conflicts show both values (OD-3)"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THESE ARE FUNCTIONS RATHER THAN A LINT
 *
 * Three of the four are properties of a VALUE, not of a file. "Does this number carry a label" and
 * "may this figure be called Verified" are questions about what a surface was handed, and a scanner
 * reading source can only find the shapes somebody already wrote.
 *
 * So each property is a predicate a surface calls and a test drives over the real vocabulary. The
 * `honesty` gate then scans for the fourth thing a scanner IS good at: a surface that renders a
 * number without going through any of them.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE COMMON FAILURE THESE PREVENT IS NOT A WRONG NUMBER. IT IS A TRUE ONE, PRESENTED AS MORE
 * CERTAIN THAN IT IS.
 *
 * A figure with no unit; a computed total wearing the badge that means "somebody checked this";
 * a sum that quietly treats "we do not know" as zero; a disagreement shown as one number. Every one
 * of them renders perfectly and every one of them tells a user something false.
 */

/** A number a surface may render: it carries what it IS, not only how big it is. */
export interface LabelledNumber {
  readonly value: number;
  /** The unit or the field. "₪", "%", "days" — never empty. */
  readonly unit: string;
  /** What the figure is OF. "annual fee", "FX commission". Never empty. */
  readonly label: string;
}

/**
 * PROPERTY 1 — no unlabelled number.
 *
 * A bare `1.75` on a screen is either a percentage, a fee in shekels, or a number of days, and the
 * reader has to guess which. The unit is not decoration: it is the difference between a figure and
 * a rumour.
 */
export function isLabelled(candidate: Partial<LabelledNumber> | number | null | undefined): boolean {
  if (typeof candidate !== 'object' || candidate === null) return false;
  return (
    typeof candidate.value === 'number' &&
    Number.isFinite(candidate.value) &&
    typeof candidate.unit === 'string' &&
    candidate.unit.trim() !== '' &&
    typeof candidate.label === 'string' &&
    candidate.label.trim() !== ''
  );
}

/**
 * PROPERTY 2 — "Verified" never on a derived figure.
 *
 * `VERIFIED` means a human checked this against a source document. A figure this app COMPUTED —
 * a total, a difference, an annualisation — was never checked by anybody, however sound the
 * arithmetic. Carrying the badge across a calculation is how an estimate acquires an authority
 * nobody granted it.
 *
 * The rule is not "derived figures are wrong". It is that they are OURS, and the chip says whose.
 */
export function mayRenderAsVerified(chip: ProvenanceChip, derived: boolean): boolean {
  if (derived) return false;
  return MAY_RENDER_AS_VERIFIED[chip] === true;
}

/** What a sum can honestly return when one of its inputs is unknown. */
export type StackedTotal =
  | { readonly state: 'TOTAL'; readonly value: number }
  | { readonly state: 'COMPARISON_INCOMPLETE'; readonly unknownCount: number };

/**
 * PROPERTY 3 — UNKNOWN stacking never sums.
 *
 * Adding up benefits where one is UNKNOWN and treating it as zero produces a total that is exactly
 * as wrong as the missing value, presented with the same confidence as a complete one. **Zero is
 * not a neutral element for an unknown quantity** — it is an assertion that the thing is worth
 * nothing.
 *
 * Returns the count of unknowns rather than a bare refusal, so a surface can say "3 of 7 benefits
 * have no recorded value" instead of "unavailable".
 */
export function stackTotal(values: readonly (number | null | undefined)[]): StackedTotal {
  const unknownCount = values.filter((v) => typeof v !== 'number' || !Number.isFinite(v)).length;
  if (unknownCount > 0) return { state: 'COMPARISON_INCOMPLETE', unknownCount };
  return { state: 'TOTAL', value: (values as number[]).reduce((a, b) => a + b, 0) };
}

/**
 * PROPERTY 4 — a preserved conflict shows both values.
 *
 * OD-3 and OD-9: every competing reading, with its scope and its source, and no winner. A conflict
 * rendered as one number has not been resolved — it has been hidden, and the reader cannot tell the
 * difference between "the sources agree" and "we picked one".
 *
 * Takes the candidates a surface is about to render and answers whether all of them survive.
 */
export function showsEveryCandidate(
  candidates: readonly unknown[],
  rendered: readonly unknown[],
): boolean {
  if (candidates.length === 0) return rendered.length === 0;
  return rendered.length === candidates.length;
}

/** The four, named, so a gate counts them from the code rather than from its own sentinel. */
export const HONESTY_PROPERTIES = [
  'no unlabelled number',
  'Verified never on a derived figure',
  'UNKNOWN stacking never sums',
  'a preserved conflict shows both values',
] as const;
