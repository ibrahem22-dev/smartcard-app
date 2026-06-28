import { calculateLoanImpact, calculateLoanSummary } from '../loanEngine';
import type { Loan } from '../../types/loan.types';
import type { UserProfile } from '../../types/user.types';

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    bankName: 'לאומי',
    monthlyIncome: 10_000,
    currentBalance: 5_000,
    dangerThreshold: 1_000,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: 'loan-1',
    loanType: 'personal',
    lenderName: 'בנק לדוגמה',
    originalAmount: 10_000,
    remainingBalance: 8_000,
    monthlyPayment: 500,
    annualInterestRate: 5,
    startDate: '2026-01-01T00:00:00.000Z',
    totalMonths: 24,
    monthsPaid: 4,
    ...overrides,
  };
}

describe('calculateLoanSummary', () => {
  it('summarizes a personal loan in mid-repayment', () => {
    const summary = calculateLoanSummary(makeLoan());

    expect(summary).toEqual({
      loanId: 'loan-1',
      remainingBalance: 8_000,
      remainingMonths: 20,
      totalInterestRemaining: 2_000,
      monthlyPayment: 500,
      projectedEndDate: '2028-01-01T00:00:00.000Z',
    });
  });

  it('handles a single-payment loan', () => {
    const summary = calculateLoanSummary(
      makeLoan({
        originalAmount: 1_000,
        monthlyPayment: 1_100,
        totalMonths: 1,
        monthsPaid: 0,
      }),
    );

    expect(summary.remainingBalance).toBe(1_000);
    expect(summary.remainingMonths).toBe(1);
    expect(summary.totalInterestRemaining).toBe(100);
  });

  it('calculates remaining months for a 360-month mortgage', () => {
    const summary = calculateLoanSummary(
      makeLoan({
        loanType: 'mortgage',
        totalMonths: 360,
        monthsPaid: 120,
      }),
    );

    expect(summary.remainingMonths).toBe(240);
  });

  it('returns zero remaining interest for a zero-interest loan', () => {
    const summary = calculateLoanSummary(
      makeLoan({
        originalAmount: 12_000,
        monthlyPayment: 1_000,
        totalMonths: 12,
        monthsPaid: 5,
        annualInterestRate: 0,
      }),
    );

    expect(summary.remainingBalance).toBe(7_000);
    expect(summary.remainingMonths).toBe(7);
    expect(summary.totalInterestRemaining).toBe(0);
  });

  it('clamps every remaining value after overpayment', () => {
    const summary = calculateLoanSummary(
      makeLoan({
        originalAmount: 12_000,
        monthlyPayment: 1_000,
        totalMonths: 12,
        monthsPaid: 13,
      }),
    );

    expect(summary.remainingBalance).toBe(0);
    expect(summary.remainingMonths).toBe(0);
    expect(summary.totalInterestRemaining).toBe(0);
  });

  it('returns zero balances at exactly zero remaining months without throwing', () => {
    const summary = calculateLoanSummary(
      makeLoan({
        originalAmount: 12_000,
        remainingBalance: 0,
        monthlyPayment: 1_000,
        totalMonths: 12,
        monthsPaid: 12,
      }),
    );

    expect(summary.remainingMonths).toBe(0);
    expect(summary.remainingBalance).toBe(0);
    expect(summary.totalInterestRemaining).toBe(0);
  });

  it('does not trust a negative stored balance and derives a non-negative balance', () => {
    const summary = calculateLoanSummary(
      makeLoan({
        originalAmount: 10_000,
        remainingBalance: -2_000,
        monthlyPayment: 500,
        monthsPaid: 4,
      }),
    );

    expect(summary.remainingBalance).toBe(8_000);
    expect(summary.remainingBalance).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateLoanImpact', () => {
  it('floors a fully rental-offset mortgage contribution at zero', () => {
    const user = makeUser();
    const impact = calculateLoanImpact(
      [
        makeLoan({
          loanType: 'mortgage',
          monthlyPayment: 4_000,
          rentalIncome: 5_000,
        }),
      ],
      user.monthlyIncome,
    );

    expect(impact.totalMonthlyObligations).toBe(0);
    expect(impact.percentOfIncome).toBe(0);
    expect(impact.riskLevel).toBe('low');
  });

  it('subtracts a partial rental-income offset', () => {
    const user = makeUser();
    const impact = calculateLoanImpact(
      [
        makeLoan({
          loanType: 'mortgage',
          monthlyPayment: 5_000,
          rentalIncome: 2_000,
        }),
      ],
      user.monthlyIncome,
    );

    expect(impact.totalMonthlyObligations).toBe(3_000);
    expect(impact.percentOfIncome).toBe(30);
    expect(impact.riskLevel).toBe('medium');
  });

  it('returns high risk at zero monthly income without throwing', () => {
    const user = makeUser({ monthlyIncome: 0 });
    const impact = calculateLoanImpact([makeLoan()], user.monthlyIncome);

    expect(impact.totalMonthlyObligations).toBe(500);
    expect(impact.percentOfIncome).toBe(100);
    expect(impact.riskLevel).toBe('high');
  });

  it('excludes all fully paid loans', () => {
    const user = makeUser();
    const impact = calculateLoanImpact(
      [makeLoan({ totalMonths: 24, monthsPaid: 24 })],
      user.monthlyIncome,
    );

    expect(impact.totalMonthlyObligations).toBe(0);
    expect(impact.loansCount).toBe(0);
    expect(impact.riskLevel).toBe('low');
  });

  it('combines a personal loan and a net mortgage obligation', () => {
    const user = makeUser();
    const impact = calculateLoanImpact(
      [
        makeLoan({ id: 'personal', monthlyPayment: 1_000 }),
        makeLoan({
          id: 'mortgage',
          loanType: 'mortgage',
          monthlyPayment: 3_000,
          rentalIncome: 1_000,
        }),
      ],
      user.monthlyIncome,
    );

    expect(impact.totalMonthlyObligations).toBe(3_000);
    expect(impact.percentOfIncome).toBe(30);
    expect(impact.riskLevel).toBe('medium');
    expect(impact.loansCount).toBe(2);
  });

  it('classifies an obligation at fifty percent of income as high risk', () => {
    const user = makeUser();
    const impact = calculateLoanImpact(
      [makeLoan({ monthlyPayment: 5_000 })],
      user.monthlyIncome,
    );

    expect(impact.percentOfIncome).toBe(50);
    expect(impact.riskLevel).toBe('high');
  });

  it('ignores non-positive rental income', () => {
    const user = makeUser();
    const impact = calculateLoanImpact(
      [makeLoan({ loanType: 'mortgage', monthlyPayment: 2_000, rentalIncome: -500 })],
      user.monthlyIncome,
    );

    expect(impact.totalMonthlyObligations).toBe(2_000);
    expect(impact.riskLevel).toBe('low');
  });

  it('applies rental income only to mortgages for otherwise identical loans', () => {
    const personalImpact = calculateLoanImpact(
      [
        makeLoan({
          loanType: 'personal',
          monthlyPayment: 5_000,
          rentalIncome: 2_500,
        }),
      ],
      10_000,
    );
    const mortgageImpact = calculateLoanImpact(
      [
        makeLoan({
          loanType: 'mortgage',
          monthlyPayment: 5_000,
          rentalIncome: 2_500,
        }),
      ],
      10_000,
    );

    expect(personalImpact.totalMonthlyObligations).toBe(5_000);
    expect(personalImpact.percentOfIncome).toBe(50);
    expect(personalImpact.riskLevel).toBe('high');
    expect(mortgageImpact.totalMonthlyObligations).toBe(2_500);
    expect(mortgageImpact.percentOfIncome).toBe(25);
    expect(mortgageImpact.riskLevel).toBe('low');
  });
});
