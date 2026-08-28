import React from 'react';
import { act, render, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CardDnaScreen } from '../CardDnaScreen';

/*
 * SECTION A NOW READS THROUGH THE PACK STORE, SO RENDERING OPENS SQLITE.
 *
 * That is D-015's required fix landing: until WP-2.4, the catalog path read EngineCard fields and a
 * pack import could not change what Section A showed, which made N4 unfalsifiable. The cost is that
 * this suite — which is about LAYOUT and does not care what any row contains — now needs a driver.
 *
 * An empty catalog is the right fixture for it. Every row resolves to unknown, the four section
 * containers still render in spec §11 order, and the order is what N1 measures.
 */
const fakeDb = {
  execSync: (): void => { /* the layout suite needs only an empty catalog table */ },
  closeSync: (): void => { /* no native handle to close */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));
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

  /*
   * WHAT THIS CASE MEANS, AND WHAT IT DELIBERATELY DOES NOT.
   *
   * It first asserted that every section container was COMPLETELY EMPTY. That was true when the
   * shell shipped and every section was empty, and it read as harmless — but it made N1 fail the
   * moment N2 filled section A, which is the plan working. A check that can only be satisfied by
   * the product not being built is a red with no path back.
   *
   * What N1 is about is order. What B2 is about is placeholders. Neither is about a section having
   * content, so this asserts what its name says: no section container carries the wording that
   * turns an honest empty container into a shipped promise.
   */
  it('renders no placeholder text in any section container', () => {
    const tree = render(wrap(<CardDnaScreen />));
    const PLACEHOLDER = /coming soon|not yet|placeholder|todo|tbd|under construction|בקרוב/i;

    for (const section of CARD_DNA_SECTIONS) {
      const content = tree.getByTestId(`${section.testID}-content`);
      expect(within(content).queryAllByText(PLACEHOLDER)).toHaveLength(0);
    }
  });
});
