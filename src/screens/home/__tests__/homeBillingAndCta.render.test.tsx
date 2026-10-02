import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const fakeDb = {
  execSync: (): void => { /* this render driver needs no catalog rows */ },
  closeSync: (): void => { /* this render driver owns no native handle */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

const mockNavigate = jest.fn();
const mockParentNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    getParent: () => ({ navigate: mockParentNavigate }),
  }),
}));

import { HomeScreen } from '../../HomeScreen';
import { AuthProvider } from '../../../navigation/authContext';
import { useActivityStore } from '../../../store/useActivityStore';
import { useCardsStore } from '../../../store/useCardsStore';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { useLoansStore } from '../../../store/useLoansStore';
import { useUserStore } from '../../../store/useUserStore';
import { CardIssuer, CardNetwork, type EngineCard } from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { HomeUpcomingBilling, type HomeBillingEvent } from '../HomeUpcomingBilling';

const CARD: EngineCard = {
  cardId: 'card:home-billing',
  cardProductId: 'product:home-billing',
  displayName: 'Later card',
  last4: '1234',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 12_000, currentBalance: 800 },
  billingCycle: { statementClosingDay: 25, billingDayOfMonth: 2 },
  roleTags: [],
  primaryRole: null,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0.03,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
};

const NEAREST_CARD: EngineCard = {
  ...CARD,
  cardId: 'card:home-billing-nearest',
  cardProductId: 'product:home-billing-nearest',
  displayName: 'Nearest card',
  billingCycle: { statementClosingDay: 24, billingDayOfMonth: 30 },
};

const wrap = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    <AuthProvider>{node}</AuthProvider>
  </SafeAreaProvider>
);

function testIdsInTree(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(testIdsInTree);
  if (node === null || typeof node !== 'object') return [];

  const rendered = node as {
    readonly props?: { readonly testID?: unknown };
    readonly children?: unknown;
  };
  const ownTestID =
    typeof rendered.props?.testID === 'string' ? [rendered.props.testID] : [];
  return [...ownTestID, ...testIdsInTree(rendered.children)];
}

describe('Home upcoming billing and Check CTA — H5', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockParentNavigate.mockClear();
    act(() => {
      useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
      useCardsStore.setState({ cards: [], obligations: [] });
      useLoansStore.setState({ loans: [] });
      useActivityStore.setState({ purchases: [], verdicts: [] });
      useUserStore.setState({ profile: null });
    });
  });

  it('renders the nearest card billing event', () => {
    act(() => {
      useCardsStore.setState({ cards: [CARD, NEAREST_CARD] });
    });

    const tree = render(wrap(<HomeUpcomingBilling asOfDate="2026-08-28" />));

    expect(String(tree.getByTestId('home-upcoming-billing-card').props.children))
      .toBe('Nearest card');
    expect(tree.getByTestId('home-upcoming-billing-date').props.accessibilityValue?.text)
      .toBe('2026-08-30');
  });

  it('labels a derived billing date Estimate', () => {
    act(() => {
      useCardsStore.setState({ cards: [NEAREST_CARD] });
    });

    const tree = render(wrap(<HomeUpcomingBilling asOfDate="2026-08-28" />));

    expect(
      within(tree.getByTestId('home-upcoming-billing-estimate')).getByText('Estimate'),
    ).toBeTruthy();
  });

  it('does not label a stated billing date Estimate', () => {
    const stated: HomeBillingEvent = {
      cardId: 'card:stated-billing',
      cardName: 'Issuer statement card',
      date: '2026-08-29',
      derived: false,
    };

    const tree = render(wrap(
      <HomeUpcomingBilling asOfDate="2026-08-28" billingEvents={[stated]} />,
    ));

    expect(tree.getByTestId('home-upcoming-billing-card')).toBeTruthy();
    expect(tree.queryByTestId('home-upcoming-billing-estimate')).toBeNull();
  });

  it('taps through to Plan', () => {
    act(() => {
      useCardsStore.setState({ cards: [NEAREST_CARD] });
    });
    const tree = render(wrap(<HomeUpcomingBilling asOfDate="2026-08-28" />));

    fireEvent.press(tree.getByTestId('home-upcoming-billing-link'));

    expect(mockNavigate).toHaveBeenCalledWith('Plan');
  });

  it('renders the Check CTA above the fold', () => {
    const tree = render(wrap(<HomeScreen />));
    const painted = testIdsInTree(tree.toJSON());
    const ctaPosition = painted.indexOf('home-check-cta');
    const riskPosition = painted.indexOf('home-risk-strip');

    expect(ctaPosition).toBeGreaterThanOrEqual(0);
    expect(riskPosition).toBeGreaterThanOrEqual(0);
    expect(ctaPosition).toBeLessThan(riskPosition);
  });

  it('renders no billing block when no card has a billing date', () => {
    act(() => {
      useCardsStore.setState({
        cards: [{
          ...CARD,
          billingCycle: { statementClosingDay: 0, billingDayOfMonth: 0 },
        }],
      });
    });

    const tree = render(wrap(<HomeUpcomingBilling asOfDate="2026-08-28" />));

    expect(tree.queryByTestId('home-upcoming-billing')).toBeNull();
  });
});
