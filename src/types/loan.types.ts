/** Supported loan products in the SmartCard MVP. */
export type LoanType =
  | 'personal'
  | 'mortgage'
  | 'overdraft'
  | 'credit_line';

/** A loan or credit facility tracked as a recurring financial obligation. */
export interface Loan {
  readonly id: string;
  readonly loanType: LoanType;
  readonly lenderName: string;
  readonly originalAmount: number;
  readonly remainingBalance: number;
  readonly monthlyPayment: number;
  readonly annualInterestRate: number;
  /** ISO 8601 date. */
  readonly startDate: string;
  readonly totalMonths: number;
  readonly monthsPaid: number;
  /** Card association for a credit-line loan. */
  readonly linkedCardId?: string;
  /** Mortgage rental-income offset, when applicable. */
  readonly rentalIncome?: number;
  readonly notes?: string;
}

/** Remaining cost and duration calculated for one loan. */
export interface LoanSummary {
  readonly loanId: string;
  readonly remainingBalance: number;
  readonly remainingMonths: number;
  readonly totalInterestRemaining: number;
  readonly monthlyPayment: number;
  /** ISO 8601 date. */
  readonly projectedEndDate: string;
}

/** Combined monthly effect of all tracked loans. */
export interface LoanImpact {
  readonly totalMonthlyObligations: number;
  readonly percentOfIncome: number;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly loansCount: number;
}

/** Informational decision emitted for a tracked loan. */
export interface LoanDecision {
  readonly loanId: string;
  readonly verdict: 'approved' | 'warning' | 'blocked';
  readonly reason: string;
  readonly reasonAr: string;
}
