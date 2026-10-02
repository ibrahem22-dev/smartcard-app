import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import {
  act,
  fireEvent,
  render,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: (): { navigate: typeof mockNavigate } => ({
    navigate: mockNavigate,
  }),
}));

const fakeDb = {
  execSync: (): void => { /* this render driver needs no catalog rows */ },
  closeSync: (): void => { /* this render driver owns no native handle */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

import { useCardsStore } from '../../../store/useCardsStore';
import {
  evaluateSurfaceEngines,
  type SurfaceContext,
  type SurfaceEngineResults,
} from '../../../surfaces';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { WalletBestForChips } from '../WalletBestForChips';

const card = (cardId: string): EngineCard => ({
  cardId,
  cardProductId: `product:${cardId}`,
  displayName: cardId,
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
});

const CARDS = [
  card('card:lowest'),
  card('card:middle'),
  card('card:highest'),
] as const;

const context = (over: Partial<SurfaceContext> = {}): SurfaceContext => ({
  asOfDate: '2026-08-28',
  throughDate: '2026-09-28',
  profile: null,
  cards: CARDS,
  installments: [],
  loans: [],
  purchases: [],
  scoringCosts: {
    'card:lowest': 10,
    'card:middle': 20,
    'card:highest': 30,
  },
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

function requiredScoring(result: SurfaceEngineResults) {
  if (result.scoring === null) {
    throw new Error('the Wallet Best-For fixture must produce a scoring result');
  }
  return result.scoring;
}

function winningCardAndReason(ctx: SurfaceContext) {
  const scoring = requiredScoring(evaluateSurfaceEngines(ctx));
  const winner = scoring.ranked[0];
  if (winner === undefined) {
    throw new Error('the Wallet Best-For fixture must rank a card');
  }
  const reason = winner.trace.steps.find(
    (step) => step.rule === 'product spec §20.1 effective cost',
  );
  if (reason === undefined) {
    throw new Error('the Wallet Best-For fixture must carry an effective-cost reason');
  }
  return { winner, reason };
}

describe('Wallet Best-For chips', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    act(() => {
      useCardsStore.setState({ cards: [], obligations: [] });
    });
  });

  it('renders a Best-For chip when the engine ranks this card best', () => {
    const ctx = context();
    const { winner } = winningCardAndReason(ctx);
    const tree = render(wrap(
      <WalletBestForChips cardId={winner.cardId} context={ctx} />,
    ));

    expect(tree.getByTestId(`wallet-best-for-${winner.cardId}`)).toBeTruthy();
  });

  it('renders at most two chips', () => {
    const ctx = context();
    const { winner } = winningCardAndReason(ctx);
    const tree = render(wrap(
      <WalletBestForChips cardId={winner.cardId} context={ctx} />,
    ));

    expect(tree.queryAllByTestId(/^wallet-best-for-/).length).toBeLessThanOrEqual(2);
  });

  it('reveals the engine trace reason when a chip is tapped', () => {
    const ctx = context();
    const { winner, reason } = winningCardAndReason(ctx);
    const chipTestID = `wallet-best-for-${winner.cardId}`;
    const tree = render(wrap(
      <WalletBestForChips cardId={winner.cardId} context={ctx} />,
    ));

    expect(tree.queryByTestId(`${chipTestID}-reason`)).toBeNull();
    fireEvent.press(tree.getByTestId(chipTestID));

    expect(tree.getByTestId(`${chipTestID}-reason`)).toHaveTextContent(reason.detail);
  });

  it('takes the reason from the engine rather than the translation catalogue', () => {
    const ctx = context();
    const { winner, reason } = winningCardAndReason(ctx);
    const tree = render(wrap(
      <WalletBestForChips cardId={winner.cardId} context={ctx} />,
    ));

    fireEvent.press(tree.getByTestId(`wallet-best-for-${winner.cardId}`));
    const renderedReason = tree.getByTestId(
      `wallet-best-for-${winner.cardId}-reason`,
    );
    const enSource = readFileSync(join(__dirname, '../../../i18n/en.ts'), 'utf8');
    const arSource = readFileSync(join(__dirname, '../../../i18n/ar.ts'), 'utf8');

    expect(renderedReason).toHaveTextContent(reason.detail);
    expect(enSource).not.toContain(reason.detail);
    expect(arSource).not.toContain(reason.detail);
  });

  it('deep-links into Card DNA when the reason is tapped', () => {
    const ctx = context();
    const { winner } = winningCardAndReason(ctx);
    const chipTestID = `wallet-best-for-${winner.cardId}`;
    const tree = render(wrap(
      <WalletBestForChips cardId={winner.cardId} context={ctx} />,
    ));

    fireEvent.press(tree.getByTestId(chipTestID));
    fireEvent.press(tree.getByTestId(`${chipTestID}-reason`));

    expect(mockNavigate).toHaveBeenCalledWith('CardDetail', {
      cardId: winner.cardId,
    });
  });

  it('renders nothing when the engine ranks this card nowhere', () => {
    const ctx = context({
      scoringCosts: {
        [CARDS[1].cardId]: 20,
        [CARDS[2].cardId]: 30,
      },
    });
    const tree = render(wrap(
      <WalletBestForChips cardId={CARDS[0].cardId} context={ctx} />,
    ));

    expect(tree.queryAllByTestId(/^wallet-best-for-/)).toHaveLength(0);
  });
});
