import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import {
  act,
  fireEvent,
  render,
  within,
} from '@testing-library/react-native';

import { useLanguageStore } from '../../../store/useLanguageStore';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
} from '../../../surfaces';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import type { MonthGridDay } from '../monthGrid';
import i18n from '../../../i18n';
import { riskPresentation } from '../../../theme/riskPresentation';

const { DayMarkers, DayMarkersLegend } = require('../DayMarkers.tsx') as {
  readonly DayMarkers: React.ComponentType<{
    readonly context: SurfaceContext;
    readonly iso: string;
  }>;
  readonly DayMarkersLegend: React.ComponentType;
};
const { MonthGrid } = require('../MonthGrid.tsx') as {
  readonly MonthGrid: React.ComponentType<{
    readonly context: SurfaceContext;
    readonly year: number;
    readonly month: number;
    readonly onDayPress?: (day: MonthGridDay) => void;
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

jest.mock('../../../surfaces', () => {
  const actual = jest.requireActual('../../../surfaces');
  return {
    ...actual,
    evaluateSurfaceEngines: jest.fn(actual.evaluateSurfaceEngines),
  };
});

const mockedEvaluateSurfaceEngines = evaluateSurfaceEngines as jest.MockedFunction<
  typeof evaluateSurfaceEngines
>;

const card = (): EngineCard => ({
  cardId: 'card:calendar',
  cardProductId: 'product:calendar',
  displayName: 'Calendar Card',
  last4: '1234',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 12_000, currentBalance: 800 },
  billingCycle: { statementClosingDay: 2, billingDayOfMonth: 10 },
  roleTags: [],
  primaryRole: null,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0.03,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
});

const context = (): SurfaceContext => ({
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
  installments: [],
  loans: [],
  purchases: [],
});

describe('Day markers — K2', () => {
  beforeEach(() => {
    mockedEvaluateSurfaceEngines.mockClear();
    act(() => {
      useLanguageStore.setState({
        languageChoice: 'en',
        resolvedLanguage: 'en',
      });
    });
  });

  it('renders the risk dot from the risk engine through the surfaces seam', () => {
    const activeContext = context();
    const onDayPress = jest.fn();
    const expected = evaluateSurfaceEngines(activeContext).risk?.days
      .find((day) => day.date === '2026-09-10')?.riskLevel;
    mockedEvaluateSurfaceEngines.mockClear();

    const tree = render(
      <MonthGrid
        context={activeContext}
        month={9}
        onDayPress={onDayPress}
        year={2026}
      />,
    );
    const marker = tree.getByTestId('calendar-day-2026-09-10-marker-risk');

    expect(mockedEvaluateSurfaceEngines).toHaveBeenCalledWith(activeContext);
    /* The engine's level, arriving as a word rather than as its enum — see the note in
       homeRiskStrip.render.test.tsx: asserting the enum could not catch the defect, because
       the enum WAS the defect. */
    expect(marker.props.accessibilityValue?.text)
      .toBe(i18n.t(riskPresentation(expected ?? 'unknown').labelKey));
    expect(marker.props.accessibilityValue?.text).not.toBe(expected);
    fireEvent.press(tree.getByTestId('calendar-day-2026-09-10'));
    expect(onDayPress).toHaveBeenCalledWith({
      iso: '2026-09-10',
      dayOfMonth: 10,
      inMonth: true,
    });
  });

  it('renders the salary coin on the payday the profile carries', () => {
    const tree = render(<DayMarkers context={context()} iso="2026-09-10" />);

    expect(tree.getByTestId('calendar-day-2026-09-10-marker-salary')).toBeTruthy();
    expect(tree.queryByTestId('calendar-day-2026-09-09-marker-salary')).toBeNull();
  });

  it('renders the billing marker on a card billing date', () => {
    const tree = render(<DayMarkers context={context()} iso="2026-09-10" />);

    expect(tree.getByTestId('calendar-day-2026-09-10-marker-billing')).toBeTruthy();
  });

  it('renders no marker on a day that has none', () => {
    const tree = render(<DayMarkers context={context()} iso="2026-10-01" />);

    expect(tree.queryAllByTestId(/^calendar-day-.*-marker-/)).toEqual([]);
  });

  it('gives every marker a cue that is not its colour', () => {
    const tree = render(<DayMarkers context={context()} iso="2026-09-10" />);

    for (const kind of ['risk', 'salary', 'billing'] as const) {
      const testID = `calendar-day-2026-09-10-marker-${kind}`;
      const marker = tree.getByTestId(testID);
      const cue = within(marker).getByTestId(`${testID}-cue`);
      expect(String(cue.props.children)).not.toHaveLength(0);
      expect(marker.props.accessibilityLabel).toEqual(expect.any(String));
      expect(marker.props.accessibilityLabel).not.toHaveLength(0);
    }
  });

  it('renders a one-line legend', () => {
    const tree = render(<DayMarkersLegend />);
    const legend = tree.getByTestId('calendar-legend');
    const line = within(legend).getByText('Risk · Salary · Card billing');

    expect(line.props.numberOfLines).toBe(1);
    expect(String(line.props.children)).not.toContain('\n');
  });

  it('reads no charge from the old cashflow stack', () => {
    for (const file of ['DayMarkers.tsx', 'dayMarkers.ts']) {
      const source = readFileSync(
        join(process.cwd(), 'src', 'screens', 'calendar', file),
        'utf8',
      );
      expect(source).not.toMatch(/useCashflowCalendar|cashflowRadar|loanEngine/);
    }
  });
});
