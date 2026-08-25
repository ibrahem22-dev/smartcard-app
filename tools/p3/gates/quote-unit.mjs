/**
 * GATE: quote-unit — criterion X1.  →  `QUOTE-UNIT OK`
 *
 *   > *"The quoteUnit division is implemented: JPY per-100 and LBP per-10 normalise to per-one
 *   > before any comparison."*
 *
 * THE DIVIDE LIVES IN THE ENGINE AND NOWHERE ELSE. This gate requires exactly one module to divide,
 * computes the contract's own control (50,000 JPY → 934.85 / 93,485.00) against the REAL bundled
 * snapshot's JPY row, and requires the arithmetic to have been watched passing by name.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['X1'];
export const SENTINEL = 'QUOTE-UNIT OK';

const MODULE = 'src/engines/currency.ts';
const SUITE = 'src/engines/__tests__/currency.test.ts';

const REQUIRED_CASES = [
  '50,000 JPY at the shipped rate converts to 934.85 ILS — not 93,485.00',
  'perOne normalises per-100 AND per-10 quotations through one function',
  'CONTROL: with the divide removed, 50,000 JPY reads 93,485.00 — a factor of exactly one hundred',
];

export const run = async ({ root }) => {
  const p = join(root, MODULE);
  if (!existsSync(p)) {
    return fail(MODULE + ' does not exist. OD-23b puts conversion in the engine; an engine '
      + 'without the divide cannot rank foreign-currency fees');
  }
  const src = readFileSync(p, 'utf8');

  // Exactly ONE dividing site, and it divides by the unit that travelled with the number.
  const divisors = [...src.matchAll(/rateIlsPerQuoteUnit\s*\/\s*\w+/g)];
  if (divisors.length !== 1) {
    return fail(MODULE + ' contains ' + divisors.length + ' dividing sites; the design allows '
      + 'exactly one (perOne). A second path is a second answer to the same question');
  }

  // THE CONTROL, COMPUTED HERE FROM THE SHIPPED ARTIFACT — not from the test fixture.
  const fxDir = join(root, 'src', 'data', 'adapter', 'packs', 'fx-rates');
  const manifest = JSON.parse(readFileSync(join(fxDir, 'manifest.json'), 'utf8'));
  const snapshot = JSON.parse(readFileSync(join(fxDir, 'snapshot.json'), 'utf8'));
  const jpy = (snapshot.rates ?? []).find((r) => r.currency === 'JPY');
  if (!jpy || jpy.quoteUnit === 1) {
    return fail('the bundled snapshot carries no multi-unit JPY row; the control would prove nothing');
  }
  const amount = 50_000;
  const correct = (amount / jpy.quoteUnit) * jpy.rateIlsPerQuoteUnit;
  const ignoringUnit = amount * jpy.rateIlsPerQuoteUnit;
  if (correct.toFixed(2) !== '934.85' || ignoringUnit.toFixed(2) !== '93485.00') {
    return fail('the shipped JPY rate moved: ' + amount + ' JPY now computes to '
      + correct.toFixed(2) + ' ILS with the unit and ' + ignoringUnit.toFixed(2)
      + ' without it. Re-derive the contract\'s control figures rather than quietly certifying '
      + 'stale ones');
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    MODULE + ': one dividing site (perOne)',
    'control from shipped bytes: ' + amount + ' JPY @ ' + jpy.rateIlsPerQuoteUnit + '/' + jpy.quoteUnit
      + ' → ' + correct.toFixed(2) + ' ILS (' + ignoringUnit.toFixed(2) + ' if ignored)',
    summary,
  ].join('\n'));
};
