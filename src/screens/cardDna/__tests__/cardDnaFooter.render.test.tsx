import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useCardsStore } from '../../../store/useCardsStore';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { FxCompareFromCardDna } from '../../fx/FxCompareFromCardDna';
import { FxCompareSheet } from '../../fx/FxCompareSheet';
import { CardDnaScreen } from '../CardDnaScreen';

const fakeDb = {
  execSync: (): void => { /* the render suite needs only an empty catalog table */ },
  closeSync: (): void => { /* no native handle to close */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

const CARD: EngineCard = {
  cardId: 'card:dna-footer',
  cardProductId: 'product:dna-footer',
  displayName: 'Daily card',
  last4: '1234',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 10_000, currentBalance: 1_000 },
  billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
  roleTags: [],
  primaryRole: null,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
};

const CARD_WITH_REAL_UPDATE_DATE: EngineCard = {
  ...CARD,
  cardRates: {
    creditInterestRate: 8.25,
    installmentInterestRate: 6.5,
    cardLoanInterestRate: 9.75,
    foreignExchangeCommission: 2.8,
    monthlyFee: 14.9,
    source: 'manual',
    lastUpdated: '2026-08-28',
  },
};

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

function textsInTree(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textsInTree);
  if (node === null || typeof node !== 'object') return [];

  const rendered = node as { readonly children?: unknown };
  return textsInTree(rendered.children);
}

function show(card: EngineCard, navigate = jest.fn()) {
  act(() => {
    useCardsStore.setState({ cards: [card] });
  });
  return {
    navigate,
    tree: render(wrap(<CardDnaScreen navigation={{ navigate }} />)),
  };
}

describe('Card DNA footer', () => {
  beforeEach(() => {
    act(() => {
      useCardsStore.setState({ cards: [] });
    });
  });

  it('renders both footer actions and the standing verification line', () => {
    const { tree } = show(CARD_WITH_REAL_UPDATE_DATE);

    expect(tree.getByTestId('card-dna-footer-benefits')).toBeTruthy();
    expect(tree.getByTestId('card-dna-footer-fx')).toBeTruthy();
    const freshness = tree.getByTestId('card-dna-footer-freshness');
    expect(freshness).toBeTruthy();
    expect(textsInTree(freshness).join(' ')).toContain('2026-08-28');
  });

  it('opens the FX sheet P4 built from the footer', () => {
    const { navigate, tree } = show(CARD);

    fireEvent.press(tree.getByTestId('card-dna-footer-fx'));

    expect(navigate).toHaveBeenCalledWith('CardDnaFxCompare');
    expect(FxCompareFromCardDna).toBe(FxCompareSheet);
  });

  it('opens the same FX sheet from the section A FX row', () => {
    const { navigate, tree } = show(CARD);

    fireEvent.press(
      tree.getByTestId('card-dna-cost-fx-commission-compare'),
    );

    expect(navigate).toHaveBeenCalledWith('CardDnaFxCompare');
    expect(FxCompareFromCardDna).toBe(FxCompareSheet);
  });

  it('says the benefits destination is not built rather than doing nothing', () => {
    const { navigate, tree } = show(CARD);
    expect(tree.queryByTestId('card-dna-footer-benefits-unbuilt')).toBeNull();

    fireEvent.press(tree.getByTestId('card-dna-footer-benefits'));

    const statement = tree.getByTestId('card-dna-footer-benefits-unbuilt');
    expect(textsInTree(statement).join(' ')).toMatch(/V1\.x/);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('renders no fabricated update date', () => {
    const { tree } = show(CARD);
    const freshness = tree.getByTestId('card-dna-footer-freshness');

    expect(textsInTree(freshness).join(' ')).not.toMatch(
      /\b\d{4}-\d{2}-\d{2}\b/,
    );
  });
});
