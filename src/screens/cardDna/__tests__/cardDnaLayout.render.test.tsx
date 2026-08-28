import React from 'react';
import { act, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CardDnaScreen } from '../CardDnaScreen';
import { CARD_DNA_SECTIONS } from '../sections';
import { useCardsStore } from '../../../store/useCardsStore';
import { CardIssuer, CardNetwork, type EngineCard } from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';

const CARD: EngineCard = {
  cardId: 'card:dna',
  cardProductId: 'product:dna',
  displayName: 'My daily card',
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
  if (Array.isArray(node)) {
    return node.flatMap(testIdsInTree);
  }
  if (node === null || typeof node !== 'object') {
    return [];
  }

  const rendered = node as {
    readonly props?: { readonly testID?: unknown };
    readonly children?: unknown;
  };
  const ownTestID =
    typeof rendered.props?.testID === 'string' ? [rendered.props.testID] : [];
  return [...ownTestID, ...testIdsInTree(rendered.children)];
}

describe('Card DNA', () => {
  beforeEach(() => {
    act(() => {
      useCardsStore.setState({ cards: [CARD] });
    });
  });

  it('renders the header before section A', () => {
    const tree = render(wrap(<CardDnaScreen />));
    const painted = testIdsInTree(tree.toJSON());
    const sectionA = CARD_DNA_SECTIONS.find((section) => section.id === 'a');

    if (sectionA === undefined) {
      throw new Error('CARD_DNA_SECTIONS must declare section A');
    }

    expect(painted.indexOf('card-dna-header')).toBeGreaterThanOrEqual(0);
    expect(painted.indexOf('card-dna-header')).toBeLessThan(
      painted.indexOf(sectionA.testID),
    );
  });

  it('renders all four sections in spec section 11 order', () => {
    const tree = render(wrap(<CardDnaScreen />));
    const declaredTestIDs = CARD_DNA_SECTIONS.map((section) => section.testID);
    const declaredSet = new Set(declaredTestIDs);
    const painted = testIdsInTree(tree.toJSON()).filter((testID) =>
      declaredSet.has(testID),
    );

    expect(painted).toEqual(declaredTestIDs);
  });

  it('renders every section the declaration lists, and no others', () => {
    const tree = render(wrap(<CardDnaScreen />));
    const paintedSections = testIdsInTree(tree.toJSON()).filter((testID) =>
      /^card-dna-section-[^-]+$/.test(testID),
    );

    expect(paintedSections).toEqual(
      CARD_DNA_SECTIONS.map((section) => section.testID),
    );
  });

  it('renders a content container for every section the declaration lists', () => {
    const tree = render(wrap(<CardDnaScreen />));

    for (const section of CARD_DNA_SECTIONS) {
      const renderedSection = tree.getByTestId(section.testID);
      expect(
        within(renderedSection).getByTestId(`${section.testID}-content`),
      ).toBeTruthy();
    }
  });

  it('renders no placeholder text in any section container', () => {
    const tree = render(wrap(<CardDnaScreen />));

    for (const section of CARD_DNA_SECTIONS) {
      const content = tree.getByTestId(`${section.testID}-content`);
      expect(content.props.children).toBeUndefined();
      expect(within(content).queryAllByText(/.+/)).toHaveLength(0);
    }
  });
});
