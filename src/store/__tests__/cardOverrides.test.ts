import { CHIP_PRECEDENCE } from '../../authority/provenanceChip';
import {
  CardIssuer,
  CardNetwork,
  type EngineCard,
} from '../../types/card.types';
import { Currency } from '../../types/purchase.types';
import { readCardCost } from '../cardCostResolution';
import {
  cardCostOverrideKey,
  cardCostOverrideVault,
  clearCardCostOverride,
  readCardCostOverride,
  writeCardCostOverride,
} from '../cardOverrides';
import { MMKV_KEYS } from '../keys';
import { closePackStore } from '../packStore';
import { resolveValue } from '../storeAdapter';

const mockStorage = new Map<string, string>();

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

const fakeDb = {
  execSync: (): void => { /* the in-memory table needs no schema setup */ },
  closeSync: (): void => { /* no native handle to close */ },
  getFirstSync: <T,>(): T | null => null,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

const PROFILE_ID = 'card-override-profile';
const CARD_ID = 'card:override-test';

const CARD: EngineCard = {
  cardId: CARD_ID,
  cardProductId: 'product:override-test',
  displayName: 'Override test',
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

beforeEach(() => {
  mockStorage.clear();
  mockStorage.set(MMKV_KEYS.activeProfileId, PROFILE_ID);
  closePackStore();
});

describe('card cost overrides', () => {
  it('writes an override that reads back through the adapter', () => {
    writeCardCostOverride(CARD_ID, 'annual-fee', '99');

    expect(
      resolveValue(
        cardCostOverrideVault,
        'catalog',
        cardCostOverrideKey(CARD_ID, 'annual-fee'),
      ),
    ).toEqual({
      value: '99',
      chip: 'USER',
      stale: false,
      source: 'vault',
    });
  });

  it('stores a user value as USER and never as VERIFIED or ESTIMATE', () => {
    writeCardCostOverride(CARD_ID, 'monthly-fee', '14.9');

    const stored = readCardCostOverride(CARD_ID, 'monthly-fee');
    expect(stored?.chip).toBe('USER');
    expect(stored?.chip).not.toBe('VERIFIED');
    expect(stored?.chip).not.toBe('ESTIMATE');
    expect(CHIP_PRECEDENCE.USER).toBeLessThan(CHIP_PRECEDENCE.VERIFIED);
    expect(CHIP_PRECEDENCE.USER).toBeLessThan(CHIP_PRECEDENCE.ESTIMATE);
  });

  it('lets the user assert a zero, which is a known value and not a missing one', () => {
    writeCardCostOverride(CARD_ID, 'annual-fee', '0');

    expect(readCardCost({ ...CARD, annualFee: 0 }, 'annual-fee')).toEqual({
      kind: 'known',
      value: '0',
      chip: 'USER',
      source: 'user',
    });
  });

  it('derives every key from one scheme, so a read and a write cannot disagree', () => {
    writeCardCostOverride(CARD_ID, 'fx-commission', '2.25');

    const raw = mockStorage.get(MMKV_KEYS.profileCardOverrides(PROFILE_ID));
    if (raw === undefined) throw new Error('override map was not persisted');
    const persisted = JSON.parse(raw) as Record<string, unknown>;
    const derived = cardCostOverrideKey(CARD_ID, 'fx-commission');

    expect(Object.keys(persisted)).toEqual([derived]);
    expect(readCardCostOverride(CARD_ID, 'fx-commission')).toEqual(
      persisted[derived],
    );
  });

  it('clears an override and falls back to the catalog value', () => {
    writeCardCostOverride(CARD_ID, 'annual-fee', '99');
    clearCardCostOverride(CARD_ID, 'annual-fee');

    expect(readCardCost(CARD, 'annual-fee')).toEqual({
      kind: 'known',
      value: '250',
      chip: 'ESTIMATE',
      source: 'catalog',
    });
  });
});
