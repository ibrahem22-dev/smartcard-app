import { PROVENANCE_CHIPS } from '../../authority/provenanceChip';
import { evaluateFinancialLoad, type FinancialLoadInput, type LoadCommitment } from '../load';

const number = (value: number, provenance: 'USER' | 'VERIFIED' | 'ESTIMATE' = 'USER') => ({
  value,
  provenance,
});

const commitment = (
  commitmentId: string,
  monthlyAmount: number,
  overrides: Partial<LoadCommitment> = {},
): LoadCommitment => ({
  commitmentId,
  monthlyAmountIls: number(monthlyAmount),
  ...overrides,
});

const input = (overrides: Partial<FinancialLoadInput> = {}): FinancialLoadInput => ({
  monthlyIncomeIls: number(10_000),
  commitments: [commitment('rent', 2_000)],
  cards: [{
    cardId: 'card-a',
    creditLimitIls: number(10_000),
    loggedThisCyclePurchasesIls: number(1_000),
  }],
  ...overrides,
});

describe('the installment / financial load engine (N4)', () => {
  it('divides current plus prospective monthly obligations by income', () => {
    const result = evaluateFinancialLoad(input({
      prospectiveCommitment: commitment('new-plan', 1_000),
    }));
    expect(result.current.monthlyObligationsIls.value).toBe(2_000);
    expect(result.projected.monthlyObligationsIls.value).toBe(3_000);
    expect(result.projected.ratioOfIncome.value).toBe(0.3);
  });

  it('classifies the exact 25, 35 and 50 percent threshold boundaries', () => {
    const at25 = evaluateFinancialLoad(input({ commitments: [commitment('load', 2_500)] }));
    const at35 = evaluateFinancialLoad(input({ commitments: [commitment('load', 3_500)] }));
    const at50 = evaluateFinancialLoad(input({ commitments: [commitment('load', 5_000)] }));
    const above50 = evaluateFinancialLoad(input({ commitments: [commitment('load', 5_001)] }));
    expect(at25.current.band).toBe('warning');
    expect(at35.current.band).toBe('warning');
    expect(at50.current.band).toBe('strong_warning');
    expect(above50.current.band).toBe('blocked');
  });

  it('computes available limit as limit minus active holds minus logged purchases', () => {
    const result = evaluateFinancialLoad(input({
      commitments: [commitment('plan', 500, {
        linkedCardId: 'card-a',
        remainingHoldIls: number(4_000),
      })],
    }));
    expect(result.cardLimits[0]!).toMatchObject({
      activeInstallmentHoldsIls: { value: 4_000 },
      availableBeforeChangesIls: { value: 5_000 },
      availableAfterChangesIls: { value: 5_000 },
    });
  });

  it('a prospective limit hold is the total hold and reports whether it fits', () => {
    const result = evaluateFinancialLoad(input({
      prospectiveCommitment: commitment('new-plan', 1_000, {
        linkedCardId: 'card-a',
        remainingHoldIls: number(9_001),
      }),
    }));
    expect(result.cardLimits[0]!.prospectiveHoldIls.value).toBe(9_001);
    expect(result.cardLimits[0]!.availableAfterChangesIls.value).toBe(-1);
    expect(result.cardLimits[0]!.prospectiveHoldFits).toBe(false);
  });

  it('paid early removes the monthly obligation and frees its linked-card hold immediately', () => {
    const result = evaluateFinancialLoad(input({
      commitments: [commitment('plan', 1_000, {
        linkedCardId: 'card-a',
        remainingHoldIls: number(4_000),
      })],
      paidEarlyCommitmentIds: ['plan'],
    }));
    expect(result.current.monthlyObligationsIls.value).toBe(1_000);
    expect(result.afterEarlyPayoff.monthlyObligationsIls.value).toBe(0);
    expect(result.cardLimits[0]!.releasedByEarlyPayoffIls.value).toBe(4_000);
    expect(result.cardLimits[0]!.availableBeforeChangesIls.value).toBe(5_000);
    expect(result.cardLimits[0]!.availableAfterChangesIls.value).toBe(9_000);
  });

  it('early payoff is recalculated before a prospective obligation and hold', () => {
    const result = evaluateFinancialLoad(input({
      commitments: [commitment('old-plan', 1_000, {
        linkedCardId: 'card-a',
        remainingHoldIls: number(4_000),
      })],
      paidEarlyCommitmentIds: ['old-plan'],
      prospectiveCommitment: commitment('replacement', 800, {
        linkedCardId: 'card-a',
        remainingHoldIls: number(6_000),
      }),
    }));
    expect(result.afterEarlyPayoff.ratioOfIncome.value).toBe(0);
    expect(result.projected.ratioOfIncome.value).toBe(0.08);
    expect(result.cardLimits[0]!.availableAfterChangesIls.value).toBe(3_000);
    expect(result.cardLimits[0]!.prospectiveHoldFits).toBe(true);
  });

  it('every numeric output carries canonical provenance and the result carries a reason trace', () => {
    const result = evaluateFinancialLoad(input());
    const numbers = [
      result.current.monthlyObligationsIls,
      result.current.ratioOfIncome,
      result.afterEarlyPayoff.monthlyObligationsIls,
      result.projected.ratioOfIncome,
      result.thresholds.warningRatio,
      result.thresholds.strongWarningRatio,
      result.thresholds.blockedRatio,
      result.cardLimits[0]!.creditLimitIls,
      result.cardLimits[0]!.activeInstallmentHoldsIls,
      result.cardLimits[0]!.loggedThisCyclePurchasesIls,
      result.cardLimits[0]!.availableBeforeChangesIls,
      result.cardLimits[0]!.releasedByEarlyPayoffIls,
      result.cardLimits[0]!.prospectiveHoldIls,
      result.cardLimits[0]!.availableAfterChangesIls,
    ];
    for (const value of numbers) expect(PROVENANCE_CHIPS).toContain(value.provenance);
    expect(result.projected.ratioOfIncome.provenance).toBe('ESTIMATE');
    expect(result.trace.engine).toBe('load');
    expect(result.trace.steps.length).toBeGreaterThan(0);
  });

  it('refuses invalid income, ids, links, holds, UNKNOWN values and malformed thresholds', () => {
    expect(() => evaluateFinancialLoad(input({ monthlyIncomeIls: number(0) }))).toThrow(/zero income/);
    expect(() => evaluateFinancialLoad(input({
      commitments: [commitment('same', 1), commitment('same', 2)],
    }))).toThrow(/duplicate commitmentId/);
    expect(() => evaluateFinancialLoad(input({
      commitments: [commitment('plan', 100, { remainingHoldIls: number(500) })],
    }))).toThrow(/requires linkedCardId/);
    expect(() => evaluateFinancialLoad(input({
      commitments: [commitment('plan', 100, { linkedCardId: 'missing' })],
    }))).toThrow(/does not name an input card/);
    expect(() => evaluateFinancialLoad(input({
      commitments: [commitment('plan', 100, { linkedCardId: 'card-a' })],
    }))).toThrow(/requires remainingHoldIls/);
    expect(() => evaluateFinancialLoad(input({
      paidEarlyCommitmentIds: ['missing'],
    }))).toThrow(/does not exist/);
    expect(() => evaluateFinancialLoad(input({
      monthlyIncomeIls: { value: 10_000, provenance: 'UNKNOWN' },
    }))).toThrow(/UNKNOWN/);
    expect(() => evaluateFinancialLoad(input({
      thresholds: {
        warningRatio: number(0.35),
        strongWarningRatio: number(0.35),
        blockedRatio: number(0.5),
      },
    }))).toThrow(/warningRatio < strongWarningRatio/);
  });
});
