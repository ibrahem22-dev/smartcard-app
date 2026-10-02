import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../types/card.types';
import { Currency } from '../../types/purchase.types';
import {
  CARD_COST_PACK_SET,
  readCardCost,
} from '../cardCostResolution';
import {
  cardCostOverrideKey,
  writeCardCostOverride,
} from '../cardOverrides';
import { MMKV_KEYS } from '../keys';
import { closePackStore, replacePackSet, type PackRow } from '../packStore';

type Row = {
  pack_set: string;
  key: string;
  value: string;
  pack_version: string;
};

const table: Row[] = [];
const mockStorage = new Map<string, string>();

const fakeDb = {
  execSync: (): void => { /* CREATE TABLE — the in-memory table already exists */ },
  closeSync: (): void => { table.length = 0; },
  withTransactionSync: (fn: () => void): void => { fn(); },
  runSync: (sql: string, params: unknown[]): void => {
    if (sql.startsWith('INSERT')) {
      const [pack_set, key, value, pack_version] = params as [string, string, string, string];
      const index = table.findIndex((row) => row.pack_set === pack_set && row.key === key);
      const next = { pack_set, key, value, pack_version };
      if (index === -1) table.push(next);
      else table[index] = next;
      return;
    }
    if (sql.startsWith('DELETE')) {
      const [packSet] = params as [string];
      for (let index = table.length - 1; index >= 0; index -= 1) {
        if (table[index]?.pack_set === packSet) table.splice(index, 1);
      }
      return;
    }
    throw new Error(`unmodelled SQL statement: ${sql}`);
  },
  getFirstSync: <T,>(sql: string, params: unknown[]): T | null => {
    if (!sql.startsWith('SELECT')) throw new Error(`unmodelled SQL statement: ${sql}`);
    const [packSet, key] = params as [string, string];
    return (table.find((row) => row.pack_set === packSet && row.key === key) as T | undefined) ?? null;
  },
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

jest.mock('../../security/keyVault', () => ({
  keyVault: {
    getEncryptedStorage: () => ({
      getString: (key: string): string | undefined => mockStorage.get(key),
      set: (key: string, value: string | number | boolean): void => {
        mockStorage.set(key, String(value));
      },
      delete: (key: string): void => {
        mockStorage.delete(key);
      },
    }),
  },
}));

const PROFILE_ID = 'override-durability-profile';
const CARD_ID = 'card:override-durability';
const OVERRIDDEN_ROW = 'annual-fee' as const;
const UNOVERRIDDEN_ROW = 'fx-commission' as const;
const OVERRIDDEN_KEY = cardCostOverrideKey(CARD_ID, OVERRIDDEN_ROW);
const UNOVERRIDDEN_KEY = cardCostOverrideKey(CARD_ID, UNOVERRIDDEN_ROW);

const CARD: EngineCard = {
  cardId: CARD_ID,
  cardProductId: 'product:override-durability',
  displayName: 'Durability card',
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
  foreignTransactionFee: 0.025,
  supportsInstallments: true,
  annualFee: 250,
  isActive: true,
};

function packRow(key: string, value: string, packVersion: string): PackRow {
  return { packSet: CARD_COST_PACK_SET, key, value, packVersion };
}

function seedInitialPack(): void {
  replacePackSet(
    CARD_COST_PACK_SET,
    [
      packRow(OVERRIDDEN_KEY, '250', '1'),
      packRow(UNOVERRIDDEN_KEY, '2.5', '1'),
    ],
    '1',
  );
}

function importUpdatedPack(): void {
  replacePackSet(
    CARD_COST_PACK_SET,
    [
      packRow(OVERRIDDEN_KEY, '300', '2'),
      packRow(UNOVERRIDDEN_KEY, '3.5', '2'),
    ],
    '2',
  );
}

beforeEach(() => {
  table.length = 0;
  mockStorage.clear();
  mockStorage.set(MMKV_KEYS.activeProfileId, PROFILE_ID);
  closePackStore();
  seedInitialPack();
});

describe('card-cost override durability across catalog pack updates', () => {
  it('reads the catalog value from the pack store before any override exists', () => {
    expect(readCardCost(CARD, OVERRIDDEN_ROW)).toEqual({
      kind: 'known',
      value: '250',
      chip: 'VERIFIED',
      source: 'catalog',
    });
  });

  it('shows the user number once the pencil has written one', () => {
    writeCardCostOverride(CARD_ID, OVERRIDDEN_ROW, '99');

    expect(readCardCost(CARD, OVERRIDDEN_ROW)).toEqual({
      kind: 'known',
      value: '99',
      chip: 'USER',
      source: 'user',
    });
  });

  it('keeps the user number after a pack update that carries a different value', () => {
    writeCardCostOverride(CARD_ID, OVERRIDDEN_ROW, '99');
    importUpdatedPack();

    expect(readCardCost(CARD, OVERRIDDEN_ROW)).toEqual({
      kind: 'known',
      value: '99',
      chip: 'USER',
      source: 'user',
    });
  });

  it('proves the pack update really landed, by reading a row the user never overrode', () => {
    expect(readCardCost(CARD, UNOVERRIDDEN_ROW)).toEqual(expect.objectContaining({ value: '2.5' }));

    importUpdatedPack();

    expect(readCardCost(CARD, UNOVERRIDDEN_ROW)).toEqual({
      kind: 'known',
      value: '3.5',
      chip: 'VERIFIED',
      source: 'catalog',
    });
  });

  it('keeps the user number even when the pack drops the key entirely', () => {
    writeCardCostOverride(CARD_ID, OVERRIDDEN_ROW, '99');
    replacePackSet(
      CARD_COST_PACK_SET,
      [packRow(UNOVERRIDDEN_KEY, '3.5', '2')],
      '2',
    );

    expect(readCardCost(CARD, OVERRIDDEN_ROW)).toEqual({
      kind: 'known',
      value: '99',
      chip: 'USER',
      source: 'user',
    });
  });
});
