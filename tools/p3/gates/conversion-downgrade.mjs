/**
 * GATE: conversion-downgrade — criterion X3.  →  `CONVERSION-DOWNGRADE OK`
 *
 *   > *"A conversion earns the ESTIMATE downgrade; a derived shekel figure never carries the
 *   > provenance of the fact it was derived from."* — ADR-019 §3 / ADR-013 §3.
 *
 * The downgrade is structural here: `ConvertedAmount.provenance` is the literal type 'ESTIMATE', so
 * inheriting a stronger grade does not compile. This gate requires that shape in the source and
 * requires the control — a VERIFIED-graded input still producing an ESTIMATE output — to have been
 * watched passing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['X3'];
export const SENTINEL = 'CONVERSION-DOWNGRADE OK';

const MODULE = 'src/engines/currency.ts';
const SUITE = 'src/engines/__tests__/currency.test.ts';

const REQUIRED_CASES = [
  'CONTROL: a VERIFIED-provenance input still produces an ESTIMATE output — never inherited',
];

export const run = async ({ root }) => {
  const p = join(root, MODULE);
  if (!existsSync(p)) return fail(MODULE + ' does not exist');
  const src = readFileSync(p, 'utf8');

  // The downgrade must be structural: provenance typed as the literal 'ESTIMATE', or — since
  // WP-6.2 (6623477) — as the SAME literal extracted from the canonical ProvenanceChip
  // vocabulary rather than restated locally. What may never appear here is a plain `string`
  // or an unrestricted chip union, which would let a VERIFIED tariff certify a number nobody
  // published (ADR-013 §3).
  const structural = /readonly provenance:\s*(?:'ESTIMATE'|Extract<\s*ProvenanceChip\s*,\s*'ESTIMATE'\s*>)/;
  if (!structural.test(src)) {
    return fail(MODULE + ' does not declare provenance as the LITERAL type \'ESTIMATE\' (or its '
      + 'Extract<ProvenanceChip, \'ESTIMATE\'> form). A `string` or an inherited field would let a '
      + 'VERIFIED tariff certify a number nobody published (ADR-013 §3)');
  }
  // And the reason trace carries what the estimate needs to be reconstructed (rate + date + markup).
  for (const need of ['rateUsed', 'fxPercentApplied', 'fixedFeeIlsApplied']) {
    if (!src.includes(need)) {
      return fail(MODULE + ' carries no ' + need + ' on its result — ADR-013 §3 requires rate, '
        + 'rate date and card FX markup in the trace');
    }
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    MODULE + ': provenance is the literal \'ESTIMATE\' by type; trace carries rate/date/markup',
    summary,
  ].join('\n'));
};
