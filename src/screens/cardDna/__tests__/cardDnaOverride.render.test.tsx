import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CHIP_LABEL } from '../../../components/provenanceChipState';
import { arBySource } from '../../../i18n/ar';
import { enBySource } from '../../../i18n/en';
import { keyVault } from '../../../security/keyVault';
import { writeCardCostOverride } from '../../../store/cardOverrides';
import { MMKV_KEYS } from '../../../store/keys';
import { useCardsStore } from '../../../store/useCardsStore';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { CardDnaScreen } from '../CardDnaScreen';

const fakeDb = {
  execSync: (): void => { /* the render suite needs only an empty catalog table */ },
  closeSync: (): void => { /* no native handle to close */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

const PROFILE_ID = 'card-dna-override-profile';
const ROW = 'card-dna-cost-annual-fee';

const CARD: EngineCard = {
  cardId: 'card:dna-override',
  cardProductId: 'product:dna-override',
  displayName: 'Override card',
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
  annualFee: 250,
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
  return textsInTree((node as { readonly children?: unknown }).children);
}

function show(card: EngineCard = CARD) {
  act(() => {
    useCardsStore.setState({ cards: [card] });
  });
  return render(wrap(<CardDnaScreen />));
}

describe('Card DNA cost overrides', () => {
  beforeEach(() => {
    const storage = keyVault.getEncryptedStorage();
    storage.set(MMKV_KEYS.activeProfileId, PROFILE_ID);
    storage.delete(MMKV_KEYS.profileCardOverrides(PROFILE_ID));
    act(() => {
      useCardsStore.setState({ cards: [] });
    });
  });

  it('renders Your value on a row the user has overridden', () => {
    act(() => {
      writeCardCostOverride(CARD.cardId, 'annual-fee', '99');
    });
    const tree = show();
    const chipText = textsInTree(tree.getByTestId(`${ROW}-chip`)).join(' ');
    const source = CHIP_LABEL.USER;

    expect([source, enBySource[source], arBySource[source]]).toContain(chipText.replace('✎ ', ''));
  });

  it('renders the user number instead of the catalog number after an override', () => {
    const tree = show();
    fireEvent.press(tree.getByTestId(`${ROW}-pencil`));
    fireEvent.changeText(tree.getByTestId(`${ROW}-input`), '99');
    act(() => {
      fireEvent.press(tree.getByTestId(`${ROW}-save`));
    });

    const painted = textsInTree(tree.getByTestId(`${ROW}-value`)).join(' ');
    expect(painted).toContain('99');
    expect(painted).not.toContain('250');
  });

  it('opens the editor from the pencil on a known row', () => {
    const tree = show();
    fireEvent.press(tree.getByTestId(`${ROW}-pencil`));

    expect(tree.getByTestId(`${ROW}-input`)).toBeTruthy();
    expect(tree.getByTestId(`${ROW}-save`)).toBeTruthy();
  });

  it('opens the same editor from Add this on an unknown row', () => {
    const tree = show({ ...CARD, annualFee: 0 });
    fireEvent.press(tree.getByTestId(`${ROW}-add`));

    expect(tree.getByTestId(`${ROW}-input`)).toBeTruthy();
    expect(tree.getByTestId(`${ROW}-save`)).toBeTruthy();
  });

  it('renders a user-asserted zero as a value and not as Add this', () => {
    act(() => {
      writeCardCostOverride(CARD.cardId, 'annual-fee', '0');
    });
    const tree = show({ ...CARD, annualFee: 0 });

    expect(textsInTree(tree.getByTestId(`${ROW}-value`)).join(' ')).toContain('0');
    expect(tree.queryByTestId(`${ROW}-add`)).toBeNull();
    expect(tree.getByTestId(`${ROW}-chip`)).toBeTruthy();
  });
});
