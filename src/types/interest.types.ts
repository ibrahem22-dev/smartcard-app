/** One monthly row in a fixed-payment amortization schedule. */
export interface AmortizationRow {
  readonly month: number;
  readonly principal: number;
  readonly interest: number;
  readonly remainingBalance: number;
}

/** Aggregate cost and payment schedule for an interest calculation. */
export interface InterestResult {
  readonly totalInterest: number;
  readonly totalCost: number;
  readonly monthlyPayment: number;
  readonly schedule: AmortizationRow[];
}
