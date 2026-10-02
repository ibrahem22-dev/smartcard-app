import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { ConflictCandidate } from '../../../authority/authorityValue';
import { CHIP_LABEL } from '../../../components/provenanceChipState';
import { arBySource } from '../../../i18n/ar';
import { enBySource } from '../../../i18n/en';
import { keyVault } from '../../../security/keyVault';
import { cardCostOverrideKey } from '../../../store/cardOverrides';
import {
  CARD_COST_PACK_SET,
} from '../../../store/cardCostResolution';
import { MMKV_KEYS } from '../../../store/keys';
import {
  closePackStore,
  putPackRow,
  type PackRow,
} from '../../../store/packStore';
import { useCardsStore } from '../../../store/useCardsStore';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../../types/card.types';
import { Currency } from '../../../types/purchase.types';
import { CardDnaScreen } from '../CardDnaScreen';

let storedPackRow: PackRow | null = null;

const fakeDb = {
  execSync: (): void => { /* schema creation is irrelevant to this render driver */ },
  closeSync: (): void => { /* no native handle to close */ },
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
      storedPackRow === null ||
      params === undefined ||
      params[0] !== storedPackRow.packSet ||
      params[1] !== storedPackRow.key
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

// P2 proves renderPlanFor's closed-domain behavior. This render suite exercises the Section A
// call site without asking Jest to load the linked Node-targeted adapter package through Expo Babel.
jest.mock('../../../data/adapter/conflictRender', () => ({
  renderPlanFor: (): unknown => ({
    availability: 'RECORDS_AVAILABLE',
    plan: 'RENDER_ALL_CANDIDATES',
    candidateCount: 1,
    rankability: 'NOT_RANKABLE_AXIS_NOT_CLASSIFIED',
  }),
}));

const PROFILE_ID = 'card-dna-conflict-profile';
const ROW = 'card-dna-cost-annual-fee';
const ROW_ID = 'annual-fee' as const;

const CARD: EngineCard = {
  cardId: 'card:dna-conflict',
  cardProductId: 'product:dna-conflict',
  displayName: 'Conflict card',
  last4: '2468',
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
    observedAt: '2024-02-05T08:00:00Z',
    scope: 'Archive tier (legacy only)',
  },
  {
    value: '333',
    provenance: 'VERIFIED',
    sourceId: 'issuer-current-tariff',
    observedAt: '2026-08-27T15:30:00Z',
    scope: 'Premium — "Blue+" / members only!',
  },
  {
    value: '222',
    provenance: 'VERIFIED',
    sourceId: 'regulator-filing',
    observedAt: '2025-11-14T12:00:00Z',
    scope: 'All consumer cards; excluding campus cards',
  },
];

const newestFirst = [...candidates].sort(
  (left, right) =>
    Date.parse(right.observedAt ?? '') - Date.parse(left.observedAt ?? ''),
);

const envelope = JSON.stringify({
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

function show() {
  act(() => {
    useCardsStore.setState({ cards: [CARD] });
  });
  return render(wrap(<CardDnaScreen />));
}

describe('Card DNA conflicted Section A cost', () => {
  beforeEach(() => {
    const storage = keyVault.getEncryptedStorage();
    storage.set(MMKV_KEYS.activeProfileId, PROFILE_ID);
    storage.delete(MMKV_KEYS.profileCardOverrides(PROFILE_ID));
    storedPackRow = null;
    act(() => {
      closePackStore();
      putPackRow({
        packSet: CARD_COST_PACK_SET,
        key: cardCostOverrideKey(CARD.cardId, ROW_ID),
        value: envelope,
        packVersion: 'conflict-fixture-v1',
      });
      useCardsStore.setState({ cards: [] });
    });
  });

  it('renders ConflictedValue in place of the single figure on a conflicted row', () => {
    const tree = show();

    expect(tree.getByTestId(`${ROW}-conflict`)).toBeTruthy();
    expect(tree.queryByTestId(`${ROW}-value`)).toBeNull();
    expect(tree.queryByTestId(`${ROW}-chip`)).toBeNull();
    expect(tree.queryByTestId(`${ROW}-add`)).toBeNull();
  });

  it('renders every competing value, not just the newest', () => {
    const tree = show();
    const conflictText = textsInTree(tree.getByTestId(`${ROW}-conflict`)).join(' ');

    for (const candidate of candidates) {
      expect(conflictText).toContain(candidate.value);
    }
  });

  it('renders each candidate scope verbatim as the source gave it', () => {
    const tree = show();
    const conflictText = textsInTree(tree.getByTestId(`${ROW}-conflict`)).join(' ');

    for (const candidate of candidates) {
      if (candidate.scope !== undefined) {
        expect(conflictText).toContain(candidate.scope);
      }
    }
    expect(conflictText).toContain('Premium — "Blue+" / members only!');
  });

  it('renders the sources newest first and says that is the order', () => {
    const tree = show();
    const conflictText = textsInTree(tree.getByTestId(`${ROW}-conflict`)).join(' ');
    const sourcePositions = newestFirst.map((candidate) =>
      conflictText.indexOf(candidate.sourceId ?? ''),
    );
    const orderSource = 'המקורות החדשים ביותר מוצגים תחילה';
    const orderLabels = [
      orderSource,
      enBySource[orderSource],
      arBySource[orderSource],
    ].filter((label): label is string => label !== undefined);

    expect(sourcePositions.every((position) => position >= 0)).toBe(true);
    expect(sourcePositions).toEqual([...sourcePositions].sort((a, b) => a - b));
    expect(orderLabels.some((label) => conflictText.includes(label))).toBe(true);
  });

  it('renders no most-likely badge and preselects nothing', () => {
    const tree = show();
    const painted = JSON.stringify(tree.toJSON());

    expect(painted).not.toMatch(/most likely|best guess|recommended|selected|הסביר ביותר|الأرجح/i);
  });

  it('keeps the pencil on a conflicted row so the user can settle it', () => {
    const tree = show();

    fireEvent.press(tree.getByTestId(`${ROW}-pencil`));
    expect(tree.getByTestId(`${ROW}-input`)).toBeTruthy();
    expect(tree.getByTestId(`${ROW}-save`)).toBeTruthy();
  });

  it('replaces the conflict with Your value once the user saves', () => {
    const tree = show();
    fireEvent.press(tree.getByTestId(`${ROW}-pencil`));
    fireEvent.changeText(tree.getByTestId(`${ROW}-input`), '77');
    act(() => {
      fireEvent.press(tree.getByTestId(`${ROW}-save`));
    });

    expect(tree.queryByTestId(`${ROW}-conflict`)).toBeNull();
    expect(textsInTree(tree.getByTestId(`${ROW}-value`)).join(' ')).toContain('77');
    const chipText = textsInTree(tree.getByTestId(`${ROW}-chip`)).join(' ');
    const source = CHIP_LABEL.USER;
    expect([source, enBySource[source], arBySource[source]]).toContain(
      chipText.replace('✎ ', ''),
    );
  });
});
