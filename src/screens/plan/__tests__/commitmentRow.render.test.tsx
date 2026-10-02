import React from 'react';
import {
  act,
  fireEvent,
  render,
  within,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const fakeDb = {
  execSync: (): void => { /* this render suite needs only an empty catalog */ },
  closeSync: (): void => { /* no native handle to close */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

import { useCardsStore } from '../../../store/useCardsStore';
import { useLoansStore } from '../../../store/useLoansStore';
import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { CommitmentRow } from '../CommitmentRow';

const CARD: EngineCard = {
  cardId: 'card:commitment',
  cardProductId: 'product:commitment',
  displayName: 'Installments card',
  last4: '2718',
  issuer: CardIssuer.Max,
  network: CardNetwork.Visa,
  currency: Currency.ILS,
  framework: { creditLimit: 20_000, currentBalance: 2_000 },
  billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
  roleTags: [CardRole.Installments],
  primaryRole: CardRole.Installments,
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

function textsInTree(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textsInTree);
  if (node === null || typeof node !== 'object') return [];

  const rendered = node as { readonly children?: unknown };
  return textsInTree(rendered.children);
}

describe('Commitment row — criterion J3', () => {
  beforeEach(() => {
    act(() => {
      useCardsStore.setState({ cards: [], obligations: [] });
      useLoansStore.setState({ loans: [] });
    });
  });

  it('renders the name and the monthly amount the commitment carries', () => {
    const tree = render(
      wrap(<CommitmentRow id="named" monthlyIls={731} name="KSP purchase" />),
    );

    expect(textsInTree(tree.getByTestId('commitment-row-named-name')).join(' '))
      .toBe('KSP purchase');
    expect(tree.getByTestId('commitment-row-named-monthly').props.accessibilityValue)
      .toEqual({ text: '731' });
    expect(tree.getByTestId('commitments-monthly-named').props.accessibilityValue)
      .toEqual({ text: '731' });
  });

  it('renders the remaining count in the seven-of-twelve form', () => {
    const tree = render(
      wrap(
        <CommitmentRow
          id="counted"
          monthlyIls={240}
          name="Counted purchase"
          paymentProgress={{ position: 7, total: 12 }}
        />,
      ),
    );

    expect(textsInTree(tree.getByTestId('commitment-row-counted-remaining')).join(''))
      .toContain('7/12');
  });

  it('renders no remaining count when the commitment carries no payment count', () => {
    const tree = render(
      wrap(<CommitmentRow id="unknown-count" monthlyIls={240} name="Unknown count" />),
    );

    expect(tree.queryByTestId('commitment-row-unknown-count-remaining')).toBeNull();
  });

  it('renders the linked card mini-tile through the media resolver', () => {
    const tree = render(
      wrap(
        <CommitmentRow
          id="linked"
          linkedCard={CARD}
          monthlyIls={240}
          name="Linked purchase"
        />,
      ),
    );
    const miniTile = tree.getByTestId('commitment-row-linked-card');

    expect(within(miniTile).getByTestId('card-tile-surface').props.accessibilityLabel)
      .toBeTruthy();
    expect(within(miniTile).getByTestId('card-tile-nickname')).toBeTruthy();
  });

  it('renders no mini-tile when the commitment is linked to no card', () => {
    const tree = render(
      wrap(<CommitmentRow id="unlinked" monthlyIls={240} name="Unlinked purchase" />),
    );

    expect(tree.queryByTestId('commitment-row-unlinked-card')).toBeNull();
    expect(tree.queryByTestId('card-tile')).toBeNull();
  });

  it('renders a chevron on every row', () => {
    const tree = render(
      wrap(<CommitmentRow id="details" monthlyIls={240} name="Detail-less purchase" />),
    );
    const chevron = tree.getByTestId('commitment-row-details-chevron');

    expect(chevron).toBeTruthy();
    expect(tree.queryByTestId('commitment-row-details-detail-unbuilt')).toBeNull();
    fireEvent.press(chevron);
    expect(tree.getByTestId('commitment-row-details-detail-unbuilt')).toBeTruthy();
  });

  it('computes no figure of its own', () => {
    const tree = render(
      wrap(
        <>
          <CommitmentRow
            id="literal"
            monthlyIls={137}
            name="Literal monthly figure"
            paymentProgress={{ position: 7, total: 12 }}
          />
          <CommitmentRow id="second" monthlyIls={23} name="Second figure" />
        </>,
      ),
    );
    const painted = textsInTree(tree.toJSON()).join(' ');

    expect(tree.getByTestId('commitment-row-literal-monthly').props.accessibilityValue)
      .toEqual({ text: '137' });
    expect(painted).not.toMatch(/959|1[,.]?644|160/);
  });
});
