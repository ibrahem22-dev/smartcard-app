import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';

import { useLanguageStore } from '../../../store/useLanguageStore';
import { evaluateSurfaceEngines, type SurfaceContext } from '../../../surfaces';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import type { ImportedInstallment } from '../../../types/installment.types';
import { Currency } from '../../../types/purchase.types';

const { DaySheet } = require('../DaySheet.tsx') as {
  readonly DaySheet: React.ComponentType<{
    readonly iso: string;
    readonly results: ReturnType<typeof evaluateSurfaceEngines>;
    readonly context: SurfaceContext;
  }>;
};
const { MonthGrid } = require('../MonthGrid.tsx') as {
  readonly MonthGrid: React.ComponentType<{
    readonly context: SurfaceContext;
    readonly year: number;
    readonly month: number;
  }>;
};

const fakeDb = {
  execSync: (): void => { /* this render driver needs no catalog rows */ },
  closeSync: (): void => { /* this render driver owns no native handle */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

function card(
  id = 'card:calendar',
  name = 'Calendar Card',
  currentBalance = 800,
): EngineCard {
  return {
    cardId: id,
    cardProductId: `product:${id}`,
    displayName: name,
    last4: '1234',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: { creditLimit: 12_000, currentBalance },
    billingCycle: { statementClosingDay: 2, billingDayOfMonth: 10 },
    roleTags: [],
    primaryRole: null,
    rewardCategories: [],
    cashbackRate: 0,
    foreignTransactionFee: 0.03,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
  };
}

const installment: ImportedInstallment = {
  installmentId: 'installment:calendar',
  merchantName: 'Desk Store',
  totalAmount: 1_500,
  monthsRemaining: 12,
  monthlyPayment: 125,
  billingCardId: 'card:calendar',
  source: 'imported',
};

function context(overrides: Partial<SurfaceContext> = {}): SurfaceContext {
  return {
    asOfDate: '2026-09-01',
    throughDate: '2026-09-30',
    profile: {
      id: 'profile:calendar',
      monthlyIncome: 20_000,
      payday: { kind: 'day', day: 10 },
      currentBalance: 5_000,
      dangerThreshold: 1_000,
      createdAt: 0,
      updatedAt: 0,
    },
    cards: [card()],
    installments: [installment],
    loans: [{
      id: 'loan:calendar',
      loanType: 'mortgage',
      lenderName: 'Home Bank',
      originalAmount: 500_000,
      remainingBalance: 400_000,
      monthlyPayment: 3_000,
      annualInterestRate: 0.04,
      startDate: '2025-01-10',
      totalMonths: 240,
      monthsPaid: 20,
    }],
    purchases: [],
    ...overrides,
  };
}

function renderSheet(activeContext: SurfaceContext, iso = '2026-09-10') {
  const results = evaluateSurfaceEngines(activeContext);
  return render(
    <DaySheet context={activeContext} iso={iso} results={results} />,
  );
}

describe('Day sheet — K3', () => {
  beforeEach(() => {
    act(() => {
      useLanguageStore.setState({
        languageChoice: 'en',
        resolvedLanguage: 'en',
      });
    });
  });

  it('lists the five event kinds in the fixed taxonomy order', () => {
    const activeContext = context();
    const tree = render(
      <MonthGrid context={activeContext} month={9} year={2026} />,
    );

    expect(tree.queryByTestId('calendar-day-sheet')).toBeNull();
    fireEvent.press(tree.getByTestId('calendar-day-2026-09-10'));

    expect(
      tree.getAllByTestId(/^calendar-day-event-kind-[a-z-]+$/)
        .map((node) => node.props.testID),
    ).toEqual([
      'calendar-day-event-kind-salary-in',
      'calendar-day-event-kind-card-billing',
      'calendar-day-event-kind-installment-due',
      'calendar-day-event-kind-loan-or-mortgage',
      'calendar-day-event-kind-fixed-order',
    ]);
  });

  it('renders a card billing with its card and its amount', () => {
    const tree = renderSheet(context());
    const event = tree.getByTestId('calendar-day-event-card-billing-0');

    expect(within(event).getByText('Calendar Card')).toBeTruthy();
    expect(within(event).getByText('₪800.00')).toBeTruthy();
  });

  it('labels a derived date Estimate', () => {
    const tree = renderSheet(context());
    const chip = tree.getByTestId('calendar-day-event-card-billing-0-estimate');

    expect(within(chip).getByText('Estimate')).toBeTruthy();
  });

  it('does not label a date the user stated as Estimate', () => {
    const tree = renderSheet(context());
    const salary = tree.getByTestId('calendar-day-event-salary-in-0');

    expect(within(salary).getByText('Salary')).toBeTruthy();
    expect(
      within(salary).queryByTestId('calendar-day-event-salary-in-0-estimate'),
    ).toBeNull();
  });

  it('renders an honest empty sheet for a day with nothing scheduled', () => {
    const tree = renderSheet(context(), '2026-09-11');

    expect(tree.getByTestId('calendar-day-sheet-empty')).toHaveTextContent(
      'Nothing is scheduled for this day',
    );
    expect(tree.queryByText('₪0.00')).toBeNull();
  });

  it('renders a one-line pressure summary', () => {
    const tree = renderSheet(context());
    const summary = tree.getByTestId('calendar-day-sheet-summary');

    expect(summary.props.numberOfLines).toBe(1);
    expect(String(summary.props.children)).not.toContain('\n');
    expect(String(summary.props.children)).toBe(
      'Outflow is ₪925.00 and salary in is ₪20,000.00',
    );
  });

  it('computes no figure the data does not carry', () => {
    const activeContext = context({
      profile: null,
      cards: [card(), card('card:second', 'Second Card', 200)],
      installments: [],
      loans: [],
    });
    const tree = renderSheet(activeContext);
    const summary = tree.getByTestId('calendar-day-sheet-summary');

    expect(tree.getByText('₪800.00')).toBeTruthy();
    expect(tree.getByText('₪200.00')).toBeTruthy();
    expect(summary).toHaveTextContent(
      'Amounts are listed below; the engine published no daily total',
    );
    expect(String(summary.props.children)).not.toContain('₪');
    expect(String(summary.props.children)).not.toContain('1,000');
  });
});
