import { PURCHASE_WARNING_BUFFER_RATIO_OF_INCOME } from '../../config/financial';
import { evaluateSurfaceEngines } from '../surfaceEngines';
import type { SurfaceContext } from '../surfaceContext';
import { safeToCommitFrom } from '../safeToCommit';

const context = (monthlyIncome: number): SurfaceContext => ({
  asOfDate: '2026-08-28',
  throughDate: '2026-09-28',
  profile: {
    id: 'profile:safe-to-commit',
    monthlyIncome,
    createdAt: 1,
    updatedAt: 1,
  },
  cards: [],
  installments: [{
    installmentId: 'installment:safe-to-commit',
    merchantName: 'Fixture store',
    totalAmount: 7_200,
    monthsRemaining: 6,
    monthlyPayment: 1_200,
    billingCardId: 'card:not-required-for-total',
    source: 'imported',
  }],
  loans: [{
    id: 'loan:safe-to-commit',
    loanType: 'personal',
    lenderName: 'Fixture bank',
    originalAmount: 24_000,
    remainingBalance: 12_000,
    monthlyPayment: 800,
    annualInterestRate: 0.05,
    startDate: '2025-01-01',
    totalMonths: 30,
    monthsPaid: 15,
  }],
  purchases: [],
});

describe('safe to commit derivation', () => {
  it('subtracts the engine obligations and the configured buffer from income', () => {
    const results = evaluateSurfaceEngines(context(12_000));
    const safeToCommit = safeToCommitFrom(results);
    if (results.load === null || safeToCommit === null) {
      throw new Error('the safe-to-commit fixture must produce a load result');
    }

    expect(safeToCommit.amountIls).toBe(
      safeToCommit.incomeIls
        - results.load.current.monthlyObligationsIls.value
        - safeToCommit.bufferIls,
    );
    expect(safeToCommit.obligationsIls).toBe(
      results.load.current.monthlyObligationsIls.value,
    );
  });

  it('takes the buffer from configuration rather than a literal', () => {
    const safeToCommit = safeToCommitFrom(evaluateSurfaceEngines(context(9_700)));
    if (safeToCommit === null) {
      throw new Error('the safe-to-commit fixture must produce a result');
    }

    expect(safeToCommit.bufferIls).toBe(
      safeToCommit.incomeIls * PURCHASE_WARNING_BUFFER_RATIO_OF_INCOME,
    );
  });

  it('returns null when income is unknown', () => {
    expect(safeToCommitFrom(evaluateSurfaceEngines(context(0)))).toBeNull();
  });
});
