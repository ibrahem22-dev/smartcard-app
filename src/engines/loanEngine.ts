import type { Loan, LoanImpact, LoanSummary } from '../types/loan.types';

function getRemainingMonths(loan: Loan): number {
  return Math.max(0, loan.totalMonths - loan.monthsPaid);
}

function getProjectedEndDate(loan: Loan): string {
  const projectedEndDate = new Date(loan.startDate);
  projectedEndDate.setUTCMonth(projectedEndDate.getUTCMonth() + loan.totalMonths);
  return projectedEndDate.toISOString();
}

export function calculateLoanSummary(loan: Loan): LoanSummary {
  const remainingBalance = Math.max(
    0,
    loan.originalAmount - loan.monthlyPayment * loan.monthsPaid,
  );
  const remainingMonths = getRemainingMonths(loan);
  const totalInterestRemaining = Math.max(
    0,
    loan.monthlyPayment * remainingMonths - remainingBalance,
  );

  return {
    loanId: loan.id,
    remainingBalance,
    remainingMonths,
    totalInterestRemaining,
    monthlyPayment: loan.monthlyPayment,
    projectedEndDate: getProjectedEndDate(loan),
  };
}

export function calculateLoanImpact(
  loans: readonly Loan[],
  monthlyIncome: number,
): LoanImpact {
  const activeLoans = loans.filter((loan: Loan): boolean => getRemainingMonths(loan) > 0);
  const totalMonthlyObligations = activeLoans.reduce(
    (total: number, loan: Loan): number => {
      const rentalOffset =
        loan.loanType === 'mortgage' &&
        loan.rentalIncome !== undefined &&
        loan.rentalIncome > 0
          ? loan.rentalIncome
          : 0;

      return total + Math.max(0, loan.monthlyPayment - rentalOffset);
    },
    0,
  );

  if (monthlyIncome === 0) {
    return {
      totalMonthlyObligations,
      percentOfIncome: 100,
      riskLevel: 'high',
      loansCount: activeLoans.length,
    };
  }

  const percentOfIncome = (totalMonthlyObligations / monthlyIncome) * 100;
  const riskLevel =
    percentOfIncome < 30 ? 'low' : percentOfIncome < 50 ? 'medium' : 'high';

  return {
    totalMonthlyObligations,
    percentOfIncome,
    riskLevel,
    loansCount: activeLoans.length,
  };
}
