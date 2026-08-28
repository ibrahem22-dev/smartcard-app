import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useActivityStore } from '../../../store/useActivityStore';
import { useCardsStore } from '../../../store/useCardsStore';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { useLoansStore } from '../../../store/useLoansStore';
import { useUserStore } from '../../../store/useUserStore';
import { evaluateSurfaceEngines, type SurfaceContext } from '../../../surfaces';
import { CardIssuer, CardNetwork, type EngineCard } from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { HomeRiskStrip } from '../HomeRiskStrip';

const fakeDb = {
  execSync: (): void => { /* this render driver needs no catalog rows */ },
  closeSync: (): void => { /* this render driver owns no native handle */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

const CARD: EngineCard = {
  cardId: 'card:home-risk-strip',
  cardProductId: 'product:home-risk-strip',
  displayName: 'Risk Strip Card',
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
};

const context = (over: Partial<SurfaceContext> = {}): SurfaceContext => ({
  asOfDate: '2026-09-08',
  throughDate: '2026-09-30',
  profile: {
    id: 'profile:home-risk-strip',
    monthlyIncome: 20_000,
    payday: { kind: 'day', day: 15 },
    currentBalance: 5_000,
    dangerThreshold: 1_000,
    createdAt: 0,
    updatedAt: 0,
  },
  cards: [CARD],
  installments: [],
  loans: [],
  purchases: [],
  ...over,
});

const wrap = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    {node}
  </SafeAreaProvider>
);

const dayIds = (tree: ReturnType<typeof render>): readonly string[] =>
  tree.getAllByTestId(/^home-risk-strip-day-\d{4}-\d{2}-\d{2}$/)
    .map((node) => String(node.props.testID));

describe('Home seven-day risk strip — H4', () => {
  beforeEach(() => {
    act(() => {
      useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
      useCardsStore.setState({ cards: [], obligations: [] });
      useLoansStore.setState({ loans: [] });
      useActivityStore.setState({ purchases: [], verdicts: [] });
      useUserStore.setState({ profile: null });
    });
  });

  it('renders a level for each of the seven days from the risk engine', () => {
    const activeContext = context();
    const risk = evaluateSurfaceEngines(activeContext).risk;
    if (risk === null) throw new Error('the risk-strip fixture must produce a risk result');
    const tree = render(wrap(<HomeRiskStrip context={activeContext} />));

    expect(dayIds(tree)).toEqual([
      'home-risk-strip-day-2026-09-08',
      'home-risk-strip-day-2026-09-09',
      'home-risk-strip-day-2026-09-10',
      'home-risk-strip-day-2026-09-11',
      'home-risk-strip-day-2026-09-12',
      'home-risk-strip-day-2026-09-13',
      'home-risk-strip-day-2026-09-14',
    ]);
    for (const testID of dayIds(tree)) {
      const iso = testID.slice('home-risk-strip-day-'.length);
      const expected = risk.days.find((day) => day.date === iso)?.riskLevel;
      expect(tree.getByTestId(testID).props.accessibilityValue?.text).toBe(expected);
    }
  });

  it('renders a non-colour cue beside every level', () => {
    const tree = render(wrap(<HomeRiskStrip context={context()} />));

    for (const testID of dayIds(tree)) {
      const day = tree.getByTestId(testID);
      const cue = within(day).getByTestId(`${testID}-cue`);
      expect(String(cue.props.children)).not.toHaveLength(0);
      expect(day.props.accessibilityLabel).toEqual(expect.any(String));
      expect(day.props.accessibilityLabel).not.toHaveLength(0);
    }
  });

  it('explains a day when it is tapped', () => {
    const tree = render(wrap(<HomeRiskStrip context={context()} />));
    const testID = 'home-risk-strip-day-2026-09-10';

    expect(tree.queryByTestId(`${testID}-explanation`)).toBeNull();
    fireEvent.press(tree.getByTestId(`${testID}-explain`));
    expect(String(tree.getByTestId(`${testID}-explanation`).props.children))
      .toContain('card billing');
  });

  it('renders unknown and not green when billing dates are missing', () => {
    const noBillingDates = context({
      cards: [{
        ...CARD,
        billingCycle: { statementClosingDay: 0, billingDayOfMonth: 0 },
      }],
    });
    expect(evaluateSurfaceEngines(noBillingDates).risk).toBeNull();
    const tree = render(wrap(<HomeRiskStrip context={noBillingDates} />));

    expect(dayIds(tree)).toHaveLength(7);
    for (const testID of dayIds(tree)) {
      const day = tree.getByTestId(testID);
      expect(day.props.accessibilityValue?.text).toBe('unknown');
      expect(String(within(day).getByTestId(`${testID}-cue`).props.children)).toBe('?');
      expect(String(day.props.accessibilityValue?.text)).not.toBe('safe');
    }
  });

  it('renders unknown for a day the engine could not level', () => {
    const shortProjection = context({ throughDate: '2026-09-10' });
    const risk = evaluateSurfaceEngines(shortProjection).risk;
    if (risk === null) throw new Error('the short risk-strip fixture must produce a risk result');
    expect(risk.days.find((day) => day.date === '2026-09-11')).toBeUndefined();
    const tree = render(wrap(<HomeRiskStrip context={shortProjection} />));

    expect(tree.getByTestId('home-risk-strip-day-2026-09-11').props.accessibilityValue?.text)
      .toBe('unknown');
  });
});
