/**
 * PROVENANCE ON EVERY NUMBER — criterion T2, roadmap §10 P3 DoD.
 *
 *   > *"Every numeric output carries a provenance state read from the Data Contract vocabulary,
 *   > never restated locally."*
 *
 * The vocabulary is NOT defined here. It is the Data Contract §2.1 Layer-B four-state promise,
 * whose single app-side home is `src/authority/provenanceChip.ts` (mirror-parity-checked against
 * the contract by the pipeline preflight). Engines import that; they never spell their own list.
 *
 * The Stale modifier travels beside the chip, never instead of it: `stale: true` says the value's
 * source date has gone past the staleness rule — a VERIFIED rate can still be stale, which is
 * exactly why the two facts stay orthogonal.
 */
import { type ProvenanceChip } from '../authority/provenanceChip';

/** A number that admits where it came from, every time it leaves an engine. */
export interface ProvenancedNumber<T = number> {
  readonly value: T;
  /** From the Data Contract's four states via src/authority/provenanceChip.ts — never local. */
  readonly provenance: ProvenanceChip;
  /** The Stale modifier. Absent/false means no staleness claim is being made here. */
  readonly stale?: boolean;
}

/** Wrap a number in its provenance. Refuses to wrap nothing: there is no number to label. */
export function provenanced<T>(value: T, provenance: ProvenanceChip, stale = false): ProvenancedNumber<T> {
  if (value === undefined || value === null) {
    throw new Error('refusing to stamp provenance onto nothing — T3: no unlabelled number reaches an output, but also no fake number reaches one');
  }
  return stale ? { value, provenance, stale: true } : { value, provenance };
}
