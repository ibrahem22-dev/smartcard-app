/**
 * THE HONESTY WALK — criterion T3, P2's L10 honesty rule carried to the engine surface.
 *
 *   > *"No unlabelled number reaches an engine output."*
 *
 * Every MVP engine is executed HERE, on real representative inputs, and its entire output tree is
 * walked. A number found anywhere in that tree must be one of exactly two things:
 *
 *   1. WRAPPED — the `value` of an object that also carries a `provenance` chip (and may carry
 *      the Stale modifier): the T2 discipline as implemented across the five engines;
 *   2. DECLARED BARE — its field name appears in DECLARED_BARE below, each entry stating why the
 *      bare number cannot mislead: it is either the caller's own input echoed verbatim, a cited
 *      constant echoed back, or a COMPONENT of a figure whose parent object carries the chip and
 *      whose trace reconstructs it.
 *
 * Anything else FAILS. A new engine field that forgets its provenance fails here the day it
 * lands — the negative control below proves the walk can fail.
 */
import { compareAbroad } from '../fx';
import type { CardFxQuote } from '../fx';
import { convertToIls } from '../currency';
import { scoreCards } from '../scoring';
import { evaluatePurchaseVerdict } from '../verdict';
import { evaluateFinancialLoad } from '../load';
import { evaluateRiskPlanning } from '../risk';
import type { ProvenancedNumber } from '../provenance';

/** Field name -> why this bare number cannot mislead a reader. The registry is the point. */
const DECLARED_BARE: Readonly<Record<string, string>> = {
  // FX comparison: the caller's own purchase size, echoed so the result is self-contained.
  amountNative: 'input echo - the amount the caller asked to price, verbatim',
  // FX comparison: the cited D1 threshold this comparison evaluated against (roadmap §5.3).
  smallAmountThresholdIls: 'cited constant echo - SMALL_AMOUNT_ADVISORY_THRESHOLD_ILS (roadmap §5.3)',
  // ConvertedAmount components: the parent object carries the ESTIMATE chip and its reason
  // trace reconstructs reference, markup and fee, so each component is accounted for.
  nativeAmount: 'component of an ESTIMATE-labelled quote - the native fact OD-23a preserves',
  referenceIls: 'component of an ESTIMATE-labelled quote - ADR-013 §2 reference figure',
  effectiveIls: 'component of an ESTIMATE-labelled quote - the figure the chip qualifies',
  fxPercentApplied: 'component of an ESTIMATE-labelled quote - markup actually applied',
  fixedFeeIlsApplied: 'component of an ESTIMATE-labelled quote - fee actually applied',
  // Rate facts carried AS PUBLISHED (nothing divides them here); rateDate sits beside them.
  rateIlsPerQuoteUnit: 'published BOI fact carried undivided - dated by rateDate in the same object',
  quoteUnit: 'published quotation unit carried undivided - the unit trap stays visible',
};

function isProvenanced(node: unknown): node is ProvenancedNumber {
  return typeof node === 'object' && node !== null
    && 'value' in node && 'provenance' in node
    && typeof (node as { provenance: unknown }).provenance === 'string'
    && ['USER', 'VERIFIED', 'ESTIMATE', 'UNKNOWN'].includes(
      String((node as { provenance: unknown }).provenance),
    );
}

export function walkHonesty(root: unknown, path: string): readonly string[] {
  const violations: string[] = [];
  const visit = (node: unknown, path: string): void => {
    if (typeof node === 'number') {
      const field = path.split('.').pop() ?? path;
      if (!Object.prototype.hasOwnProperty.call(DECLARED_BARE, field)) {
        violations.push(path + ' is a bare number with no provenance and no declaration');
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, path + '[' + i + ']'));
      return;
    }
    if (typeof node === 'object' && node !== null) {
      if (isProvenanced(node)) {
        // The wrapped figure itself is labelled; walk nothing further INTO its value.
        return;
      }
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        visit(value, path ? path + '.' + key : key);
      }
    }
  };
  visit(root, path);
  return violations;
}

describe('honesty engine (T3)', () => {
  it('walks every MVP engine output and finds only wrapped or declared-bare numbers', () => {
    const rate = {
      currency: 'USD', quoteUnit: 1, rateIlsPerQuoteUnit: 3.0,
      rateDate: '2026-08-24', fetchDate: '2026-08-25', source: 'BUNDLED',
      provenance: 'ESTIMATE', rateBasis: 'BOI_REPRESENTATIVE',
    } as const;

    const fxOutput = compareAbroad({
      amount: 500,
      currency: 'USD',
      mode: 'purchase',
      cards: [
        { cardId: 'card:a', fxPercent: 2.75, fixedFeeIls: 5 },
        { cardId: 'card:b', fxPercent: 0 },
      ] as readonly CardFxQuote[],
      rate,
    });

    const scoringOutput = scoreCards({
      cards: [
        { cardId: 'card:a', available: true, costIls: { value: 100, provenance: 'ESTIMATE' } },
        { cardId: 'card:b', available: true, costIls: { value: 90, provenance: 'ESTIMATE' } },
      ],
    });

    const verdictOutput = evaluatePurchaseVerdict({
      purchaseAmountIls: { value: 1_000, provenance: 'USER' },
      installmentCount: 1,
      monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
      commitments: [{ commitmentId: 'rent', monthlyAmountIls: { value: 2_000, provenance: 'USER' } }],
    });

    const loadOutput = evaluateFinancialLoad({
      monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
      commitments: [{ commitmentId: 'loan', monthlyAmountIls: { value: 1_500, provenance: 'USER' }, linkedCardId: 'card:a', remainingHoldIls: { value: 4_500, provenance: 'USER' } }],
      cards: [{ cardId: 'card:a', creditLimitIls: { value: 20_000, provenance: 'USER' }, loggedThisCyclePurchasesIls: { value: 500, provenance: 'USER' } }],
    });

    const riskOutput = evaluateRiskPlanning({
      asOfDate: '2026-09-01',
      throughDate: '2026-09-30',
      openingBalanceIls: { value: 3_000, provenance: 'USER' },
      dangerThresholdIls: { value: 1_000, provenance: 'USER' },
      monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
      currentMonthlyObligationsIls: { value: 2_000, provenance: 'USER' },
      prospectiveMonthlyObligationIls: { value: 0, provenance: 'USER' },
      safeLoadRatio: { value: 0.35, provenance: 'VERIFIED' },
      salaries: [{ salaryId: 's1', date: '2026-09-01', amountIls: { value: 10_000, provenance: 'USER' } }],
      billings: [{ billingId: 'b1', date: '2026-09-05', amountIls: { value: 1_200, provenance: 'USER' }, monthlyObligationsEndingIls: { value: 0, provenance: 'USER' } }],
      commitments: [{ commitmentId: 'c1', date: '2026-09-10', amountIls: { value: 800, provenance: 'USER' } }],
    });

    for (const [name, output] of [
      ['currency', convertToIls({ amount: 500, currency: 'USD' }, rate, { percent: 2.75 })],
      ['fx', fxOutput],
      ['scoring', scoringOutput],
      ['verdict', verdictOutput],
      ['load', loadOutput],
      ['risk', riskOutput],
    ] as const) {
      expect(walkHonesty(output, name)).toEqual([]);
    }
  });

  it('a bare undeclared number fails the honesty walk', () => {
    const sneaky = { bestCardId: 'card:b', savingsClaim: 42 };
    const violations = walkHonesty(sneaky, 'sneaky');
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('savingsClaim');
  });
});
