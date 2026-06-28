import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import type { ProfileShareSource } from '../../types/profileShare.types';
import { Currency, PurchaseCategory } from '../../types/purchase.types';
import { serializeTransferProfile } from '../profileShareCodec';

function makeCard(): CardInput {
  return {
    cardId: 'private-card-id',
    displayName: 'Max Gold',
    last4: '1234',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: { creditLimit: 15_000, currentBalance: 2_500 },
    billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
    roleTags: [CardRole.Benefits],
    primaryRole: CardRole.Benefits,
    rewardCategories: [PurchaseCategory.Groceries],
    cashbackRate: 0.02,
    foreignTransactionFee: 0.025,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
  };
}

describe('serializeTransferProfile', () => {
  test('explicitly excludes PIN, KDF, balance, income, and key material', () => {
    const source: ProfileShareSource = {
      id: '00000000-0000-4000-8000-000000000001',
      displayName: 'Family',
      bankName: 'Leumi',
      languagePreference: 'he',
      cardIds: ['private-card-id'],
      pinHash: 'must-not-leave-device',
      pinSalt: 'must-not-leave-device',
      kdfVersion: 2,
      balance: 42_000,
      income: 18_000,
    };

    const serialized = serializeTransferProfile(source, [makeCard()]);
    const encodedPlaintext = JSON.stringify(serialized);
    const record: Record<string, unknown> = JSON.parse(
      encodedPlaintext,
    ) as Record<string, unknown>;

    expect(record.pinHash).toBeUndefined();
    expect(record.pinSalt).toBeUndefined();
    expect(record.kdfVersion).toBeUndefined();
    expect(record.balance).toBeUndefined();
    expect(record.income).toBeUndefined();
    expect(encodedPlaintext).not.toContain('must-not-leave-device');
    expect(encodedPlaintext).not.toContain('private-card-id');
    expect(serialized.cards[0]).toEqual({
      issuer: CardIssuer.Max,
      club: 'Max Gold',
      last4: '1234',
      billingDay: 10,
      creditLimit: 15_000,
    });
  });
});
