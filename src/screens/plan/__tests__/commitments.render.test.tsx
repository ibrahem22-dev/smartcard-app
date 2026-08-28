/**
 * B2's evidence for the one surface that was a placeholder — measured on the RENDERED tree.
 *
 * Contract §2 rule 9: *"A screen assertion is measured against the rendered surface, not the
 * source. A test that greps a component file for a string proves the string is in the file."*
 *
 * What it proves, and each is a clause of B2 or J2:
 *   · the Plan Commitments route renders this surface and **not** a `NotYetSurface`;
 *   · the four groups appear in spec §15's fixed order, every time;
 *   · an empty group renders its own honest line rather than vanishing;
 *   · the vault's real commitments appear, each with its monthly figure;
 *   · **no total is painted**, because a total is `J1`'s and comes from the load engine.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CommitmentsScreen } from '../CommitmentsScreen';
import { useCardsStore } from '../../../store/useCardsStore';
import { useLoansStore } from '../../../store/useLoansStore';
import type { ImportedInstallment } from '../../../types/installment.types';
import type { Loan } from '../../../types/loan.types';

const wrap = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
  >
    {node}
  </SafeAreaProvider>
);

const installment = (id: string, merchant: string, monthly: number): ImportedInstallment => ({
  installmentId: id,
  merchantName: merchant,
  totalAmount: monthly * 6,
  monthsRemaining: 6,
  monthlyPayment: monthly,
  billingCardId: 'card:a',
  source: 'imported',
});

const loan = (id: string, lender: string, monthly: number, loanType: Loan['loanType']): Loan => ({
  id,
  loanType,
  lenderName: lender,
  originalAmount: monthly * 60,
  remainingBalance: monthly * 30,
  monthlyPayment: monthly,
  annualInterestRate: 0.05,
  startDate: '2024-01-01',
  totalMonths: 60,
  monthsPaid: 30,
});

const GROUPS_IN_SPEC_ORDER = ['installments', 'loans', 'mortgage', 'fixed-orders'];

describe('Plan Commitments', () => {
  /* Wrapped in act: a store write while a tree is mounted is a React update, and an unwrapped one
     prints a warning that would train a reader to ignore this suite's output. */
  beforeEach(() => {
    act(() => {
      useCardsStore.setState({ obligations: [] });
      useLoansStore.setState({ loans: [] });
    });
  });

  it('renders the four groups in spec §15 order, with nothing in the vault', () => {
    act(() => { useCardsStore.setState({ obligations: [] }); useLoansStore.setState({ loans: [] }); });
    const tree = render(wrap(<CommitmentsScreen />));

    expect(tree.queryByTestId('plan-commitments')).not.toBeNull();
    for (const key of GROUPS_IN_SPEC_ORDER) {
      expect(tree.queryByTestId('commitments-group-' + key)).not.toBeNull();
    }
    /* ORDER, not merely presence. A rearranged screen is a different screen. */
    const painted = tree
      .getAllByTestId(/^commitments-group-/)
      .map((n) => String((n.props as { testID: string }).testID).replace('commitments-group-', ''));
    expect(painted).toEqual(GROUPS_IN_SPEC_ORDER);
  });

  it('gives an empty group its own line rather than letting it vanish', () => {
    const tree = render(wrap(<CommitmentsScreen />));
    for (const key of GROUPS_IN_SPEC_ORDER) {
      expect(tree.queryByTestId('commitments-empty-' + key)).not.toBeNull();
    }
  });

  it('paints the commitments the vault actually holds, each with its monthly figure', () => {
    act(() => useCardsStore.setState({ obligations: [installment('inst:1', 'KSP', 400)] }));
    act(() => useLoansStore.setState({
      loans: [loan('loan:1', 'Bank Leumi', 900, 'personal'), loan('loan:2', 'Mizrahi', 4200, 'mortgage')],
    }));
    const tree = render(wrap(<CommitmentsScreen />));

    expect(tree.getByTestId('commitments-row-inst:1')).toBeTruthy();
    expect(tree.getByTestId('commitments-row-loan:1')).toBeTruthy();
    expect(tree.getByTestId('commitments-row-loan:2')).toBeTruthy();
    /* The painted figure, read the way an agreement property reads one. */
    const monthly = (id: string): string =>
      String((tree.getByTestId('commitments-monthly-' + id).props as { accessibilityValue?: { text?: string } })
        .accessibilityValue?.text);
    expect(monthly('inst:1')).toBe('400');
    expect(monthly('loan:1')).toBe('900');
    expect(monthly('loan:2')).toBe('4200');
  });

  it('puts a mortgage in the mortgage group and other loans in the loans group', () => {
    act(() => useLoansStore.setState({
      loans: [loan('loan:1', 'Bank Leumi', 900, 'personal'), loan('loan:2', 'Mizrahi', 4200, 'mortgage')],
    }));
    const tree = render(wrap(<CommitmentsScreen />));
    expect(tree.queryByTestId('commitments-empty-loans')).toBeNull();
    expect(tree.queryByTestId('commitments-empty-mortgage')).toBeNull();
    expect(tree.queryByTestId('commitments-empty-installments')).not.toBeNull();
  });

  it('paints no monthly total — that figure is J1’s and comes from the load engine', () => {
    act(() => useCardsStore.setState({ obligations: [installment('inst:1', 'KSP', 400), installment('inst:2', 'Ikea', 600)] }));
    const tree = render(wrap(<CommitmentsScreen />));
    /* 1000 is what a sum on this surface would produce. Nothing on the tree may carry it, in any
       painted figure, because computing it here is the defect criterion B1 exists to prevent. */
    const painted = tree
      .getAllByTestId(/^commitments-monthly-/)
      .map((n) => String((n.props as { accessibilityValue?: { text?: string } }).accessibilityValue?.text));
    expect(painted).toEqual(['400', '600']);
    expect(tree.queryByTestId('commitments-total')).toBeNull();
  });

  it('is not a NotYetSurface — the placeholder that named P5 is gone from this route', () => {
    const tree = render(wrap(<CommitmentsScreen />));
    expect(tree.queryByTestId('plan-commitments-not-yet')).toBeNull();
    expect(tree.queryByTestId('commitments-not-yet-summary')).not.toBeNull();
  });
});
