import { PROVENANCE_CHIPS } from '../../authority/provenanceChip';
import { evaluatePurchaseVerdict, type PurchaseVerdictInput } from '../verdict';

const amount = (value: number, provenance: 'USER' | 'VERIFIED' | 'ESTIMATE' = 'USER') => ({
  value,
  provenance,
});

const input = (overrides: Partial<PurchaseVerdictInput> = {}): PurchaseVerdictInput => ({
  purchaseAmountIls: amount(1_000),
  installmentCount: 1,
  monthlyIncomeIls: amount(10_000),
  commitments: [{ commitmentId: 'rent', monthlyAmountIls: amount(2_000) }],
  ...overrides,
});

describe('the purchase verdict engine (N2)', () => {
  it('returns good to go at or below the safe threshold with no risk flags', () => {
    const result = evaluatePurchaseVerdict(input({
      purchaseAmountIls: amount(1_500),
      commitments: [{ commitmentId: 'rent', monthlyAmountIls: amount(2_000) }],
    }));
    expect(result.verdict).toBe('good_to_go');
    expect(result.financialImpact.thresholdMath.projectedLoadRatio.value).toBe(0.35);
  });

  it('returns caution above the safe threshold through the hard threshold', () => {
    const aboveSafe = evaluatePurchaseVerdict(input({ purchaseAmountIls: amount(1_501) }));
    const atHard = evaluatePurchaseVerdict(input({ purchaseAmountIls: amount(3_000) }));
    expect(aboveSafe.verdict).toBe('caution');
    expect(atHard.financialImpact.thresholdMath.projectedLoadRatio.value).toBe(0.5);
    expect(atHard.verdict).toBe('caution');
  });

  it('returns dont buy now only above the hard threshold from load alone', () => {
    const result = evaluatePurchaseVerdict(input({ purchaseAmountIls: amount(3_001) }));
    expect(result.financialImpact.thresholdMath.projectedLoadRatio.value).toBeGreaterThan(0.5);
    expect(result.verdict).toBe('dont_buy_now');
  });

  it('a soft risk flag returns caution even when load is safe', () => {
    const result = evaluatePurchaseVerdict(input({
      riskFlags: [{ flagId: 'salary-close', severity: 'soft' }],
    }));
    expect(result.verdict).toBe('caution');
  });

  it('a hard risk flag returns dont buy now and outranks billing relief', () => {
    const result = evaluatePurchaseVerdict(input({
      purchaseAmountIls: amount(3_000),
      riskFlags: [{ flagId: 'charge-return', severity: 'hard' }],
      imminentBilling: { date: '2026-09-02', commitmentsClearingIls: amount(2_000) },
    }));
    expect(result.verdict).toBe('dont_buy_now');
    expect(result.waitUntil).toBeUndefined();
  });

  it('returns wait until billing passes with the date when that event makes load safe', () => {
    const result = evaluatePurchaseVerdict(input({
      purchaseAmountIls: amount(3_000),
      imminentBilling: { date: '2026-09-02', commitmentsClearingIls: amount(2_000) },
    }));
    expect(result.verdict).toBe('wait_until_billing_passes');
    expect(result.waitUntil).toBe('2026-09-02');
    expect(result.financialImpact.thresholdMath.postBillingLoadRatio?.value).toBe(0.3);
    expect(result.financialImpact.bullets[2]).toMatchObject({
      kind: 'LOAD_AFTER_BILLING',
      billingDate: '2026-09-02',
    });
  });

  it('pill verdict and Financial Impact are returned by one computation with shared figures', () => {
    const result = evaluatePurchaseVerdict(input({ purchaseAmountIls: amount(2_000) }));
    const math = result.financialImpact.thresholdMath;
    const payment = result.financialImpact.bullets.find(
      (bullet) => bullet.kind === 'PURCHASE_MONTHLY_COMMITMENT',
    );
    const load = result.financialImpact.bullets.find(
      (bullet) => bullet.kind === 'LOAD_AFTER_PURCHASE',
    );
    expect(result.verdict).toBe('caution');
    expect(payment?.kind === 'PURCHASE_MONTHLY_COMMITMENT' && payment.amountIls)
      .toBe(math.monthlyPurchaseCommitmentIls);
    expect(load?.kind === 'LOAD_AFTER_PURCHASE' && load.ratioOfIncome)
      .toBe(math.projectedLoadRatio);
  });

  it('installment plan changes the same projected load used by verdict and panel', () => {
    const result = evaluatePurchaseVerdict(input({
      purchaseAmountIls: amount(6_000),
      installmentCount: 6,
    }));
    expect(result.financialImpact.thresholdMath.monthlyPurchaseCommitmentIls.value).toBe(1_000);
    expect(result.financialImpact.thresholdMath.projectedLoadRatio.value).toBe(0.3);
    expect(result.verdict).toBe('good_to_go');
  });

  it('profile thresholds are used at their exact boundaries and retain provenance', () => {
    const result = evaluatePurchaseVerdict(input({
      thresholds: { safeRatio: amount(0.25), hardRatio: amount(0.4) },
      purchaseAmountIls: amount(2_000),
    }));
    expect(result.financialImpact.thresholdMath.projectedLoadRatio.value).toBe(0.4);
    expect(result.verdict).toBe('caution');
    expect(result.financialImpact.thresholdMath.safeRatio.provenance).toBe('USER');
  });

  it('every numeric output carries canonical provenance and the result carries a reason trace', () => {
    const result = evaluatePurchaseVerdict(input());
    const math = result.financialImpact.thresholdMath;
    for (const number of [
      math.monthlyPurchaseCommitmentIls,
      math.currentMonthlyCommitmentsIls,
      math.projectedMonthlyCommitmentsIls,
      math.projectedLoadRatio,
      math.safeRatio,
      math.hardRatio,
      math.hardThresholdHeadroomIls,
    ]) {
      expect(PROVENANCE_CHIPS).toContain(number.provenance);
    }
    expect(math.projectedLoadRatio.provenance).toBe('ESTIMATE');
    expect(result.trace.engine).toBe('verdict');
    expect(result.trace.steps.length).toBeGreaterThan(0);
  });

  it('refuses zero income, invalid plans, UNKNOWN values and malformed thresholds', () => {
    expect(() => evaluatePurchaseVerdict(input({ monthlyIncomeIls: amount(0) }))).toThrow(/zero income/);
    expect(() => evaluatePurchaseVerdict(input({ installmentCount: 0 }))).toThrow(/positive integer/);
    expect(() => evaluatePurchaseVerdict(input({
      purchaseAmountIls: { value: 100, provenance: 'UNKNOWN' },
    }))).toThrow(/UNKNOWN/);
    expect(() => evaluatePurchaseVerdict(input({
      thresholds: { safeRatio: amount(0.5), hardRatio: amount(0.5) },
    }))).toThrow(/safeRatio < hardRatio/);
  });
});
