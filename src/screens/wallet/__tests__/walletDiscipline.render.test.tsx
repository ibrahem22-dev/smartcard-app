import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { ConflictCandidate } from '../../../authority/authorityValue';
import * as mediaResolver from '../../../media/resolveMedia';
import { keyVault } from '../../../security/keyVault';
import { cardCostOverrideKey } from '../../../store/cardOverrides';
import { CARD_COST_PACK_SET } from '../../../store/cardCostResolution';
import { useActivityStore } from '../../../store/useActivityStore';
import { MMKV_KEYS } from '../../../store/keys';
import { useLanguageStore } from '../../../store/useLanguageStore';
import { useLoansStore } from '../../../store/useLoansStore';
import {
  closePackStore,
  putPackRow,
  type PackRow,
} from '../../../store/packStore';
import { useCardsStore } from '../../../store/useCardsStore';
import { useUserStore } from '../../../store/useUserStore';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { WalletTile } from '../WalletTile';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: (): { navigate: typeof mockNavigate } => ({
    navigate: mockNavigate,
  }),
}));

let storedPackRow: PackRow | null = null;

const fakeDb = {
  execSync: (): void => { /* schema creation is irrelevant to this render driver */ },
  closeSync: (): void => { /* this render driver owns no native handle */ },
  runSync: (_sql: string, params?: readonly unknown[]): void => {
    if (params === undefined || params.length !== 4) return;
    storedPackRow = {
      packSet: String(params[0]),
      key: String(params[1]),
      value: String(params[2]),
      packVersion: String(params[3]),
    };
  },
  getFirstSync: <T,>(_sql: string, params?: readonly unknown[]): T | null => {
    if (
      storedPackRow === null
      || params === undefined
      || params[0] !== storedPackRow.packSet
      || params[1] !== storedPackRow.key
    ) {
      return null;
    }
    return {
      pack_set: storedPackRow.packSet,
      key: storedPackRow.key,
      value: storedPackRow.value,
      pack_version: storedPackRow.packVersion,
    } as T;
  },
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

const PROFILE_ID = 'wallet-discipline-profile';

const CARD: EngineCard = {
  cardId: 'card:wallet-discipline',
  cardProductId: 'product:wallet-discipline',
  displayName: 'Disciplined card',
  last4: '1357',
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

const candidates: readonly ConflictCandidate<string>[] = [
  {
    value: '111',
    provenance: 'ESTIMATE',
    sourceId: 'issuer-archive',
    scope: 'Legacy cards',
  },
  {
    value: '333',
    provenance: 'VERIFIED',
    sourceId: 'issuer-current-tariff',
    scope: 'Current premium cards',
  },
];

const conflictEnvelope = JSON.stringify({
  kind: 'card-cost-conflict',
  version: 1,
  reason: 'Published sources disagree',
  candidates,
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

function textsInTree(node: unknown): string[] {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(textsInTree);
  if (node === null || typeof node !== 'object') return [];
  return textsInTree((node as { readonly children?: unknown }).children);
}

function imageSourcesInTree(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(imageSourcesInTree);
  if (node === null || typeof node !== 'object') return [];
  const rendered = node as {
    readonly props?: { readonly source?: unknown };
    readonly children?: unknown;
  };
  const own = rendered.props?.source === undefined ? [] : [rendered.props.source];
  return [...own, ...imageSourcesInTree(rendered.children)];
}

function mount(card: EngineCard = CARD) {
  act(() => {
    useCardsStore.setState({ cards: [card], obligations: [] });
  });
  return render(wrap(<WalletTile card={card} />));
}

function seedConflict(): void {
  act(() => {
    putPackRow({
      packSet: CARD_COST_PACK_SET,
      key: cardCostOverrideKey(CARD.cardId, 'annual-fee'),
      value: conflictEnvelope,
      packVersion: 'wallet-conflict-v1',
    });
  });
}

describe('Wallet tile render discipline', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    storedPackRow = null;
    act(() => {
      const storage = keyVault.getEncryptedStorage();
      storage.set(MMKV_KEYS.activeProfileId, PROFILE_ID);
      storage.delete(MMKV_KEYS.profileCardOverrides(PROFILE_ID));
      closePackStore();
      useLanguageStore.setState({ languageChoice: 'en', resolvedLanguage: 'en' });
      useCardsStore.setState({ cards: [], obligations: [] });
      useLoansStore.setState({ loans: [] });
      useActivityStore.setState({ purchases: [], verdicts: [] });
      useUserStore.setState({
        profile: {
          id: PROFILE_ID,
          monthlyIncome: 10_000,
          createdAt: 1,
          updatedAt: 1,
        },
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders every tile image through the media resolver', () => {
    const resolveSpy = jest.spyOn(mediaResolver, 'resolveMedia');

    mount();

    expect(resolveSpy).toHaveBeenCalledWith(
      {
        subjectKind: 'card',
        subjectId: CARD.cardId,
        fallbackClass: 'card',
      },
      [],
      { context: { issuerId: CARD.issuer } },
    );
  });

  it('renders no image from a hard-coded path', () => {
    const tree = mount();

    expect(imageSourcesInTree(tree.toJSON())).toEqual([]);
  });

  it('renders figures in shekels', () => {
    const tree = mount();

    expect(textsInTree(tree.getByTestId('wallet-tile-annual-fee-value')).join(' '))
      .toContain('₪250.00');
    expect(textsInTree(tree.getByTestId('wallet-limit-bar-available')).join(' '))
      .toContain('₪');
  });

  it('renders a genuine foreign amount in its own currency', () => {
    const tree = mount({
      ...CARD,
      cardId: 'card:wallet-foreign',
      currency: Currency.USD,
      annualFee: 125.5,
    });
    const figure = textsInTree(
      tree.getByTestId('wallet-tile-annual-fee-value'),
    ).join(' ');

    expect(figure).toContain('125.50 USD');
    expect(figure).not.toContain('₪');
  });

  it('carries a conflicted fact as an Estimate', () => {
    seedConflict();
    const tree = mount();

    expect(tree.getByTestId('wallet-tile-annual-fee-value')).toBeTruthy();
    expect(tree.getByTestId('wallet-tile-annual-fee-chip').props.accessibilityLabel)
      .toBe('Estimate');
  });

  it('never surfaces a conflict on a tile', () => {
    seedConflict();
    const tree = mount();
    const painted = textsInTree(tree.toJSON()).join(' ');

    expect(tree.queryAllByTestId(/conflict/i)).toHaveLength(0);
    expect(tree.getByTestId('wallet-tile-annual-fee-chip').props.accessibilityLabel)
      .toBe('Estimate');
    expect(painted).not.toContain('Published sources disagree');
    for (const candidate of candidates) {
      expect(painted).not.toContain(candidate.value);
      expect(painted).not.toContain(candidate.sourceId);
      expect(painted).not.toContain(candidate.scope);
    }
  });
});
