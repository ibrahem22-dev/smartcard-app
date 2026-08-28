import React from 'react';
import {
  act,
  fireEvent,
  render,
  within,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: (): { navigate: typeof mockNavigate } => ({
    navigate: mockNavigate,
  }),
}));

const fakeDb = {
  execSync: (): void => { /* this render suite needs only an empty catalog */ },
  closeSync: (): void => { /* no native handle to close */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

import { hydrated } from '../../../store/hydration';
import { useCardsStore } from '../../../store/useCardsStore';
import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { CardsScreen } from '../../CardsScreen';
import { WALLET_TILE_ELEMENTS } from '../tileElements';
import { WalletTile } from '../WalletTile';

const CARD: EngineCard = {
  cardId: 'card:wallet',
  cardProductId: 'product:wallet',
  displayName: 'My travel card',
  last4: '1234',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 10_000, currentBalance: 1_000 },
  billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
  roleTags: [CardRole.Travel],
  primaryRole: CardRole.Travel,
  rewardCategories: [],
  cashbackRate: 0,
  foreignTransactionFee: 0,
  supportsInstallments: true,
  annualFee: 0,
  isActive: true,
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

function textsInTree(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textsInTree);
  if (node === null || typeof node !== 'object') return [];

  const rendered = node as { readonly children?: unknown };
  return textsInTree(rendered.children);
}

describe('Wallet tile — spec section 10', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    act(() => {
      useCardsStore.setState({
        cards: [],
        hydration: hydrated('2026-08-28T00:00:00.000Z'),
      });
    });
  });

  it('renders every element spec section 10 lists, in its order', () => {
    const tree = render(wrap(<WalletTile card={CARD} />));
    const declaredTestIDs = WALLET_TILE_ELEMENTS.map(
      (element) => element.testID,
    );
    const declaredSet = new Set(declaredTestIDs);
    const painted = testIdsInTree(tree.toJSON()).filter((testID) =>
      declaredSet.has(testID),
    );

    expect(painted).toEqual(declaredTestIDs);
  });

  it('renders the nickname without a role tag when the card has no role', () => {
    const tree = render(wrap(<WalletTile card={{ ...CARD, primaryRole: null }} />));

    expect(textsInTree(tree.getByTestId('wallet-tile-nickname')).join(' ')).toContain(
      CARD.displayName,
    );
    expect(tree.queryByTestId('wallet-tile-role-tag')).toBeNull();
  });

  it('renders the issuer when the card is in no club', () => {
    const tree = render(
      wrap(
        <WalletTile
          card={{ ...CARD, unknownClub: false }}
        />,
      ),
    );

    expect(
      textsInTree(tree.getByTestId('wallet-tile-issuer-or-club')).join(' '),
    ).toBe('Max');
  });

  it('keeps Add card visible when the wallet has no cards', () => {
    const tree = render(wrap(<CardsScreen />));

    expect(tree.getByTestId('wallet-add-card')).toBeTruthy();
  });

  it('keeps Add card visible when the wallet has cards', () => {
    act(() => {
      useCardsStore.setState({ cards: [CARD] });
    });
    const tree = render(wrap(<CardsScreen />));

    expect(tree.getByTestId('wallet-add-card')).toBeTruthy();
    expect(tree.getByTestId('wallet-tile')).toBeTruthy();
  });

  it('opens Card DNA when the tile is tapped', () => {
    const tree = render(wrap(<WalletTile card={CARD} />));

    fireEvent.press(tree.getByTestId('wallet-tile'));

    expect(mockNavigate).toHaveBeenCalledWith('CardDetail', {
      cardId: CARD.cardId,
    });
  });

  it('renders no placeholder text in an empty element slot', () => {
    const tree = render(wrap(<WalletTile card={CARD} />));
    const placeholder =
      /coming soon|not yet|placeholder|todo|tbd|under construction|בקרוב/i;

    for (const element of WALLET_TILE_ELEMENTS.slice(3)) {
      const slot = tree.getByTestId(element.testID);
      expect(within(slot).queryAllByText(placeholder)).toHaveLength(0);
    }
  });
});
