/**
 * GATE: one-number — criterion N7.  →  `ONE-NUMBER OK`
 *
 *   > *"Property test: no two call sites produce different numbers for identical inputs, over
 *   > the full product universe."*
 *
 * Watches the property suite by executable test name. The population inside the suite is
 * DERIVED from the shipped packs (current products x snapshot currencies) — this gate refuses
 * if the module that derives it is missing or the derivation case is absent.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N7'];
export const SENTINEL = 'ONE-NUMBER OK';

const SUITE = 'src/engines/__tests__/one-number.test.ts';

const REQUIRED_CASES = [
  'derives the universe from the shipped packs - every current product times every snapshot currency',
  'compareAbroad returns identical output for identical inputs across the whole universe',
  'the ranked best agrees with an independent convertToIls derivation at every currency',
  'scoreCards yields one ranking for identical inputs across the universe',
  'verdict load and risk return identical results for repeated identical calls',
];

export const run = async ({ root }) => {
  const p = join(root, SUITE);
  if (!existsSync(p)) return fail(SUITE + ' does not exist — there is no one-number property suite');
  const src = readFileSync(p, 'utf8');
  for (const [needle, what] of [
    ["from '@smartcard/data-authority-adapter'", 'reads the shipped packs through the adapter'],
    ['countsAsCurrentProduct', 'adapter-derived current-product population'],
    ['JSON.stringify(compareAbroad(input))', 'byte-identity property on the FX engine'],
    ['convertToIls', 'the independent derivation path'],
  ]) {
    if (!src.includes(needle)) return fail(SUITE + ' lost its ' + what + ' (' + needle + ')');
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    SUITE + ': universe derived from shipped packs; repeat-call byte identity;',
    'independent convertToIls path agrees with the ranked best at every currency;',
    'scoring yields one ranking; verdict/load/risk repeat-identical',
    summary,
  ].join('\n'));
};
