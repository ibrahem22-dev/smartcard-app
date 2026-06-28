// /src/engines/interestCalculator.ts
//
// Pure שפיצר (Spitzer / annuity) amortization. Fixed monthly payment, with the
// interest portion shrinking and the principal portion growing each period.
// No React/RN/Expo/store/network imports — pure, synchronous, side-effect free.

import type { AmortizationRow, InterestResult } from '../types/interest.types';

const RATE_MIN = 0; // % annual
const RATE_MAX = 30; // % annual — Israeli legal max for consumer credit
const MONTHS_MIN = 1;
const MONTHS_MAX = 360;

/** Round to agorot (2 decimals) to avoid binary-float drift in money values. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validate(amount: number, months: number, annualRate: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError('amount must be greater than 0');
  }
  if (!Number.isInteger(months) || months < MONTHS_MIN || months > MONTHS_MAX) {
    throw new RangeError('months must be an integer between 1 and 360');
  }
  if (!Number.isFinite(annualRate) || annualRate < RATE_MIN || annualRate > RATE_MAX) {
    throw new RangeError('annualRate must be between 0 and 30');
  }
}

/**
 * Core Spitzer schedule. `amount` is the financed principal, `annualRate` is a
 * percentage (e.g. 12 = 12%/yr). Returns the fixed monthly payment, total
 * interest, total cost, and the full month-by-month schedule.
 */
function amortize(
  amount: number,
  months: number,
  annualRate: number,
): InterestResult {
  validate(amount, months, annualRate);

  const monthlyRate = annualRate / 100 / 12;

  const monthlyPayment =
    monthlyRate === 0
      ? round2(amount / months)
      : round2(
          (amount * monthlyRate) /
            (1 - Math.pow(1 + monthlyRate, -months)),
        );

  const schedule: AmortizationRow[] = [];
  let balance = amount;
  let totalInterest = 0;

  for (let month = 1; month <= months; month += 1) {
    const isLast = month === months;
    const interest = round2(balance * monthlyRate);

    // On the final period, clear whatever balance remains so the schedule sums
    // back to the original principal exactly (absorbs rounding drift).
    const principal = isLast ? round2(balance) : round2(monthlyPayment - interest);
    const remainingBalance = isLast ? 0 : round2(balance - principal);

    schedule.push({ month, principal, interest, remainingBalance });

    totalInterest += interest;
    balance = remainingBalance;
  }

  const roundedInterest = round2(totalInterest);

  return {
    monthlyPayment,
    totalInterest: roundedInterest,
    totalCost: round2(amount + roundedInterest),
    schedule,
  };
}

/**
 * Feature 24 — ריבית על עסקת תשלומים (interest on an installment purchase).
 * @param amount      total purchase amount (₪), > 0
 * @param months      number of installments, 1–360
 * @param annualRate  annual interest rate as a percentage, 0–30
 */
export function calculateInstallmentInterest(
  amount: number,
  months: number,
  annualRate: number,
): InterestResult {
  return amortize(amount, months, annualRate);
}

/**
 * Feature 24.2 — ריבית על הלוואה מהכרטיס (interest on a loan drawn from the card).
 * Same Spitzer math as installments; separated for a distinct UI label/context.
 * @param principal   loan principal (₪), > 0
 * @param months      loan term in months, 1–360
 * @param annualRate  annual interest rate as a percentage, 0–30
 */
export function calculateCardLoan(
  principal: number,
  months: number,
  annualRate: number,
): InterestResult {
  return amortize(principal, months, annualRate);
}
