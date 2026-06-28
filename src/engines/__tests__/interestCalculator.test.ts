import {
  calculateCardLoan,
  calculateInstallmentInterest,
} from '../interestCalculator';
import type { InterestResult } from '../../types/interest.types';

function sumPrincipal(result: InterestResult): number {
  return result.schedule.reduce((acc, row) => acc + row.principal, 0);
}

describe('interestCalculator (Spitzer)', () => {
  test('0% rate → zero interest, principal returned over the term', () => {
    const result = calculateInstallmentInterest(1_200, 12, 0);

    expect(result.totalInterest).toBe(0);
    expect(result.totalCost).toBe(1_200);
    expect(result.monthlyPayment).toBe(100);
    expect(result.schedule).toHaveLength(12);
    expect(result.schedule.every((row) => row.interest === 0)).toBe(true);
  });

  test('30% rate (max allowed) computes a positive interest cost', () => {
    const result = calculateInstallmentInterest(10_000, 24, 30);

    expect(result.totalInterest).toBeGreaterThan(0);
    expect(result.totalCost).toBeGreaterThan(10_000);
    expect(result.schedule).toHaveLength(24);
  });

  test('1-month term: single payment clears the balance', () => {
    const result = calculateCardLoan(5_000, 1, 12);

    expect(result.schedule).toHaveLength(1);
    expect(result.schedule[0]?.remainingBalance).toBe(0);
    // One month at 1%/mo: payment ≈ principal + one month interest.
    expect(result.monthlyPayment).toBeCloseTo(5_050, 0);
  });

  test('360-month term is accepted and fully amortizes', () => {
    const result = calculateCardLoan(500_000, 360, 5);

    expect(result.schedule).toHaveLength(360);
    expect(result.schedule[359]?.remainingBalance).toBe(0);
  });

  test('annualRate = -1 throws RangeError', () => {
    expect(() => calculateInstallmentInterest(1_000, 12, -1)).toThrow(RangeError);
  });

  test('annualRate = 31 throws RangeError', () => {
    expect(() => calculateInstallmentInterest(1_000, 12, 31)).toThrow(RangeError);
  });

  test('months = 0 throws RangeError', () => {
    expect(() => calculateCardLoan(1_000, 0, 10)).toThrow(RangeError);
  });

  test('months = 361 throws RangeError', () => {
    expect(() => calculateCardLoan(1_000, 361, 10)).toThrow(RangeError);
  });

  test('amount = 0 throws RangeError', () => {
    expect(() => calculateInstallmentInterest(0, 12, 10)).toThrow(RangeError);
  });

  test('₪1,000 vs ₪100,000 at the same rate scale proportionally (×100)', () => {
    const small = calculateInstallmentInterest(1_000, 12, 12);
    const large = calculateInstallmentInterest(100_000, 12, 12);

    expect(large.monthlyPayment).toBeCloseTo(small.monthlyPayment * 100, 0);
    expect(large.totalInterest).toBeCloseTo(small.totalInterest * 100, 0);
  });

  test('installment and card loan produce identical math for identical inputs', () => {
    const installment = calculateInstallmentInterest(20_000, 18, 9);
    const cardLoan = calculateCardLoan(20_000, 18, 9);

    expect(cardLoan).toEqual(installment);
  });

  test('sum of all principal payments equals the original principal (±₪0.01)', () => {
    const result = calculateInstallmentInterest(33_333, 17, 7.5);

    expect(sumPrincipal(result)).toBeCloseTo(33_333, 2);
  });

  test('monthly payment is fixed across every period (Spitzer)', () => {
    const result = calculateInstallmentInterest(50_000, 36, 11);

    // Every period except the final rounding-absorber pays the fixed amount.
    result.schedule.slice(0, -1).forEach((row) => {
      expect(row.principal + row.interest).toBeCloseTo(result.monthlyPayment, 1);
    });

    // The final period stays within a few agorot of the fixed payment.
    const last = result.schedule[result.schedule.length - 1]!;
    expect(
      Math.abs(last.principal + last.interest - result.monthlyPayment),
    ).toBeLessThan(1);
  });

  test('interest portion decreases and principal portion increases over time', () => {
    const result = calculateInstallmentInterest(40_000, 24, 15);
    const first = result.schedule[0];
    const last = result.schedule[result.schedule.length - 1];

    expect(first).toBeDefined();
    expect(last).toBeDefined();
    expect(last!.interest).toBeLessThan(first!.interest);
    expect(last!.principal).toBeGreaterThan(first!.principal);
  });
});
