/**
 * GATE: engine-fx — criterion N3.  →  `ENGINE-FX OK`
 *
 *   > *"The FX engine computes amount x rate x (1 + FX%) + fixed fees on the original currency's
 *   > representative rate, resolves card-level exceptions longest-name-first, marks D1 advisory on
 *   > small amounts and labels a minor-currency ATM figure a floor."*
 *
 * FOUR NAMED BEHAVIOURS WATCHED PASSING BY NAME (the same discipline as quote-unit), plus static
 * checks that the two cited constants still cite what they cite and that the conversion has one
 * implementation.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, fail, requireJestCases } from '../lib/report.mjs';

export const CRITERIA = ['N3'];
export const SENTINEL = 'ENGINE-FX OK';

const MODULE = 'src/engines/fx.ts';
const SUITE = 'src/engines/__tests__/fx.test.ts';
const CURRENCY_MODULE = 'src/engines/currency.ts';

const REQUIRED_CASES = [
  'ranks cards ascending by effective cost — markup and fixed fee included',
  'an exact issuer x operator row beats the issuer default',
  'an excepted operator receives NO default — the row does not reach it',
  'below the cited threshold the advisory fires and savings claims are suppressed',
  'a foreign ATM figure on a minor currency is labelled a floor, on the entry itself',
];

export const run = async ({ root }) => {
  const p = join(root, MODULE);
  if (!existsSync(p)) return fail(MODULE + ' does not exist — there is no FX engine');

  // One conversion path: the engine ranks convertToIls outputs; it never re-derives a shekel.
  const fxSrc = readFileSync(p, 'utf8');
  if (!/convertToIls\s*\(/.test(fxSrc)) {
    return fail(MODULE + ' never calls convertToIls — a second shekel path is two answers');
  }
  const ownDivide = /rateIlsPerQuoteUnit\s*\/\s*(?!.*perOne)/.test(fxSrc.replace(/perOne/g, ''));
  if (ownDivide) {
    return fail(MODULE + ' divides a rate itself. The divide lives in currency.ts perOne and '
      + 'nowhere else (OD-23b)');
  }

  // The cited constants must still cite their authorities in the same breath.
  for (const [needle, what] of [
    ['SMALL_AMOUNT_ADVISORY_THRESHOLD_ILS', 'D1 threshold'],
    ['roadmap §5.3', 'the D1 citation'],
    ['MAJOR_SETTLEMENT_CURRENCIES', 'the settlement-currency list'],
    ['roadmap §7.3 limitation (b)', 'the floor citation'],
  ]) {
    if (!fxSrc.includes(needle)) {
      return fail(MODULE + ' lost ' + what + ' — a constant whose citation moved is an '
        + 'uncited number wearing a name (G11)');
    }
  }
  // The conversion module still owns exactly one dividing site while the FX engine exists.
  const curSrc = readFileSync(join(root, CURRENCY_MODULE), 'utf8');
  if ((curSrc.match(/rateIlsPerQuoteUnit\s*\/\s*\w+/g) ?? []).length !== 1) {
    return fail(CURRENCY_MODULE + ' no longer holds exactly one dividing site');
  }

  const { problems, summary } = requireJestCases(root, SUITE, REQUIRED_CASES);
  if (problems.length) return fail(problems.join(' · '), summary ?? undefined);

  return ok(SENTINEL, [
    MODULE + ': ranks through convertToIls; exceptions most-specific/longest-name-first;',
    'D1 advisory at the cited threshold; minor-currency ATM labelled a floor',
    summary,
  ].join('\n'));
};
