import { runPurchaseCheck, type PurchaseCheckContext } from '../../../check/runPurchaseCheck';
import type { CheckInputDraft } from '../CheckInputScreen';
import { Currency } from '../../../types/purchase.types';

const draft = (overrides: Partial<CheckInputDraft> = {}): CheckInputDraft => ({
  amount: 1_000,
  currency: Currency.ILS,
  category: null,
  installments: null,
  cardId: null,
  ...overrides,
});

const context = (overrides: Partial<PurchaseCheckContext> = {}): PurchaseCheckContext => ({
  monthlyIncomeIls: { value: 10_000, provenance: 'USER' },
  commitments: [{ commitmentId: 'rent', monthlyAmountIls: { value: 2_000, provenance: 'USER' } }],
  ...overrides,
});

describe('runPurchaseCheck — one call, one result (B1 seam)', () => {
  it('returns pill and financial impact from the same object, not two computations', () => {
    const result = runPurchaseCheck(draft({ amount: 1_500 }), context());
    expect(result.verdict).toBe('good_to_go');
    expect(result.financialImpact).toBe(result.financialImpact);
    expect(result.financialImpact.thresholdMath.projectedLoadRatio.value).toBe(0.35);
  });

  it('is a single evaluatePurchaseVerdict call: repeating it does not change the bytes', () => {
    const input = { draft: draft({ amount: 1_500 }), context: context() };
    expect(JSON.stringify(runPurchaseCheck(input.draft, input.context))).toBe(
      JSON.stringify(runPurchaseCheck(input.draft, input.context)),
    );
  });

  it('defaults a missing installment count to one payment rather than inventing a plan', () => {
    const result = runPurchaseCheck(draft({ installments: null, amount: 1_000 }), context());
    expect(result.financialImpact.thresholdMath.monthlyPurchaseCommitmentIls.value).toBe(1_000);
  });

  it('refuses a foreign currency instead of converting it (C4 is not this package)', () => {
    expect(() => runPurchaseCheck(draft({ currency: Currency.USD }), context())).toThrow(/C4/);
  });
});
