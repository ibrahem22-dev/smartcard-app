import { PROVENANCE_CHIPS } from '../provenanceChip';
import {
  HONESTY_PROPERTIES,
  isLabelled,
  mayRenderAsVerified,
  showsEveryCandidate,
  stackTotal,
} from '../honesty';

/**
 * CRITERION E4 / LADDER RUNG L10 — the four honesty properties.
 *
 *   > *"no unlabelled number · "Verified" never on a derived figure · UNKNOWN stacking never sums ·
 *   > conflicts show both values (OD-3)"*
 *
 * Each property is driven over the REAL vocabulary — the four provenance chips as the Data Contract
 * defines them — rather than over a chip somebody invented for the test. A property proven against
 * a made-up domain is a property about the test.
 */

describe('E4 — four properties, named', () => {
  it('declares exactly four, and the sentinel counts them from here', () => {
    expect(HONESTY_PROPERTIES).toHaveLength(4);
    expect(new Set(HONESTY_PROPERTIES).size).toBe(4);
  });
});

describe('E4 property 1 — no unlabelled number', () => {
  it('ACCEPTS a number carrying its unit and what it is of', () => {
    expect(isLabelled({ value: 1.75, unit: '%', label: 'FX commission' })).toBe(true);
  });

  it('REFUSES a bare number', () => {
    // 1.75 is a percentage, a fee in shekels, or a number of days, and the reader has to guess.
    expect(isLabelled(1.75)).toBe(false);
    expect(isLabelled(null)).toBe(false);
    expect(isLabelled(undefined)).toBe(false);
  });

  it('REFUSES an empty unit or an empty label', () => {
    expect(isLabelled({ value: 1.75, unit: '', label: 'FX commission' })).toBe(false);
    expect(isLabelled({ value: 1.75, unit: '%', label: '   ' })).toBe(false);
  });

  it('REFUSES a non-finite value even when it is labelled', () => {
    // NaN renders as "NaN%" — a label on a number that is not one.
    expect(isLabelled({ value: Number.NaN, unit: '%', label: 'FX commission' })).toBe(false);
  });
});

describe('E4 property 2 — "Verified" never on a derived figure', () => {
  it('ACCEPTS a VERIFIED chip on a figure read straight from the estate', () => {
    expect(mayRenderAsVerified('VERIFIED', false)).toBe(true);
  });

  it('REFUSES it the moment the figure is derived', () => {
    // A total, a difference, an annualisation: sound arithmetic that nobody checked against a
    // source document. Carrying the badge across a calculation gives an estimate an authority
    // nobody granted it.
    expect(mayRenderAsVerified('VERIFIED', true)).toBe(false);
  });

  it('REFUSES every other chip, derived or not — over the REAL vocabulary', () => {
    for (const chip of PROVENANCE_CHIPS) {
      if (chip === 'VERIFIED') continue;
      expect(`${chip} direct: ${mayRenderAsVerified(chip, false)}`).toBe(`${chip} direct: false`);
      expect(mayRenderAsVerified(chip, true)).toBe(false);
    }
    // And the population is the contract's four, not a set invented here.
    expect(PROVENANCE_CHIPS).toHaveLength(4);
  });
});

describe('E4 property 3 — UNKNOWN stacking never sums', () => {
  it('SUMS when every value is known — the control', () => {
    const total = stackTotal([10, 20, 5]);
    expect(total.state).toBe('TOTAL');
    if (total.state !== 'TOTAL') return;
    expect(total.value).toBe(35);
  });

  it('REFUSES to sum when one value is unknown, and says how many', () => {
    // Treating the unknown as zero produces a total exactly as wrong as the missing value,
    // presented with the confidence of a complete one. Zero is not a neutral element for an
    // unknown quantity — it is an assertion that the thing is worth nothing.
    const total = stackTotal([10, null, 5]);
    expect(total.state).toBe('COMPARISON_INCOMPLETE');
    if (total.state !== 'COMPARISON_INCOMPLETE') return;
    expect(total.unknownCount).toBe(1);
    expect('value' in total).toBe(false);
  });

  it('counts every unknown, so a surface can say "3 of 7"', () => {
    const total = stackTotal([1, null, undefined, 4, Number.NaN, 6, 7]);
    expect(total.state).toBe('COMPARISON_INCOMPLETE');
    if (total.state !== 'COMPARISON_INCOMPLETE') return;
    expect(total.unknownCount).toBe(3);
  });

  it('an empty stack is a total of zero, not an incompleteness', () => {
    // Nothing to add is a different statement from "something is missing", and collapsing them
    // would make an empty benefits list look like a broken one.
    const total = stackTotal([]);
    expect(total.state).toBe('TOTAL');
    if (total.state !== 'TOTAL') return;
    expect(total.value).toBe(0);
  });
});

describe('E4 property 4 — a preserved conflict shows both values', () => {
  it('ACCEPTS a render that kept every candidate', () => {
    expect(showsEveryCandidate([1, 2], ['1%', '2%'])).toBe(true);
  });

  it('REFUSES a render that dropped one', () => {
    // A conflict rendered as one number has not been resolved, it has been hidden — and a reader
    // cannot tell "the sources agree" from "we picked one".
    expect(showsEveryCandidate([1, 2], ['1%'])).toBe(false);
  });

  it('REFUSES a render that truncated a long list', () => {
    // "…and 2 more" hides exactly the reading that might have been the user's.
    expect(showsEveryCandidate([1, 2, 3, 4, 5], ['1', '2', '3'])).toBe(false);
  });

  it('no candidates renders nothing, and that is consistent', () => {
    expect(showsEveryCandidate([], [])).toBe(true);
  });
});
