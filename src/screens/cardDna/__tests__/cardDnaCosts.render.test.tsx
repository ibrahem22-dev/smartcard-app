import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PROVENANCE_CHIPS } from '../../../authority/provenanceChip';
import { CHIP_LABEL } from '../../../components/provenanceChipState';
import { arBySource } from '../../../i18n/ar';
import { enBySource } from '../../../i18n/en';
import { useCardsStore } from '../../../store/useCardsStore';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { CardDnaScreen } from '../CardDnaScreen';
import { CARD_COST_ROWS } from '../costRows';

const CARD_WITH_UNKNOWN_COSTS: EngineCard = {
  cardId: 'card:dna-costs',
  cardProductId: 'product:dna-costs',
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

const CARD_WITH_KNOWN_COSTS: EngineCard = {
  ...CARD_WITH_UNKNOWN_COSTS,
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

function testIdsInTree(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(testIdsInTree);
  if (node === null || typeof node !== 'object') return [];

  const rendered = node as {
    readonly props?: { readonly testID?: unknown };
    readonly children?: unknown;
  };
  const own =
    typeof rendered.props?.testID === 'string' ? [rendered.props.testID] : [];
  return [...own, ...testIdsInTree(rendered.children)];
}

function textsInTree(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textsInTree);
  if (node === null || typeof node !== 'object') return [];

  const rendered = node as { readonly children?: unknown };
  return textsInTree(rendered.children);
}

function show(card: EngineCard) {
  act(() => {
    useCardsStore.setState({ cards: [card] });
  });
  return render(wrap(<CardDnaScreen />));
}

describe('Card DNA costs', () => {
  beforeEach(() => {
    act(() => {
      useCardsStore.setState({ cards: [] });
    });
  });

  it('renders all six cost rows in the declared order', () => {
    const tree = show(CARD_WITH_KNOWN_COSTS);
    const declaredTestIDs = CARD_COST_ROWS.map((row) => row.testID);
    const declared = new Set(declaredTestIDs);
    const painted = testIdsInTree(tree.toJSON()).filter((testID) =>
      declared.has(testID),
    );

    expect(painted).toEqual(declaredTestIDs);
  });

  it('renders a provenance chip from the adapter vocabulary on every known row', () => {
    const tree = show(CARD_WITH_KNOWN_COSTS);
    const allowedLabels = new Set(
      PROVENANCE_CHIPS.flatMap((chip) => {
        const source = CHIP_LABEL[chip];
        return [source, enBySource[source], arBySource[source]];
      }),
    );
    const knownRows = CARD_COST_ROWS.filter(
      (row) => tree.queryByTestId(`${row.testID}-value`) !== null,
    );

    expect(knownRows.length).toBeGreaterThan(0);
    for (const row of knownRows) {
      const chip = tree.getByTestId(`${row.testID}-chip`);
      expect(textsInTree(chip).some((text) => allowedLabels.has(text))).toBe(true);
    }
  });

  it('renders Add this instead of a number when the value is not known', () => {
    const tree = show(CARD_WITH_UNKNOWN_COSTS);

    for (const row of CARD_COST_ROWS) {
      expect(tree.getByTestId(`${row.testID}-add`)).toBeTruthy();
      expect(tree.queryByTestId(`${row.testID}-value`)).toBeNull();
    }
  });

  it('renders no chip on a row that has no value', () => {
    const tree = show(CARD_WITH_UNKNOWN_COSTS);

    for (const row of CARD_COST_ROWS) {
      expect(tree.queryByTestId(`${row.testID}-chip`)).toBeNull();
    }
  });

  it('renders a pencil on every row including the unknown ones', () => {
    const tree = show(CARD_WITH_KNOWN_COSTS);
    const unknownRows = CARD_COST_ROWS.filter(
      (row) => tree.queryByTestId(`${row.testID}-value`) === null,
    );

    expect(unknownRows.length).toBeGreaterThan(0);
    for (const row of CARD_COST_ROWS) {
      expect(tree.getByTestId(`${row.testID}-pencil`)).toBeTruthy();
    }
  });

  it('renders no zero for a fee the card type cannot distinguish from unknown', () => {
    const tree = show({ ...CARD_WITH_KNOWN_COSTS, annualFee: 0 });
    const annualFee = CARD_COST_ROWS.find((row) => row.id === 'annual-fee');

    if (annualFee === undefined) {
      throw new Error('CARD_COST_ROWS must declare annual-fee');
    }

    const row = tree.getByTestId(annualFee.testID);
    expect(tree.queryByTestId(`${annualFee.testID}-value`)).toBeNull();
    expect(tree.getByTestId(`${annualFee.testID}-add`)).toBeTruthy();
    expect(textsInTree(row).join(' ')).not.toMatch(/₪\s*0(?:[.,]00)?/);
  });

  it('renders the annual fee as a value when the card carries a non-zero one', () => {
    const tree = show({ ...CARD_WITH_KNOWN_COSTS, annualFee: 250 });
    const annualFee = CARD_COST_ROWS.find((row) => row.id === 'annual-fee');

    if (annualFee === undefined) {
      throw new Error('CARD_COST_ROWS must declare annual-fee');
    }

    expect(tree.getByTestId(`${annualFee.testID}-value`)).toBeTruthy();
    expect(tree.getByTestId(`${annualFee.testID}-chip`)).toBeTruthy();
    expect(tree.queryByTestId(`${annualFee.testID}-add`)).toBeNull();
  });
});
