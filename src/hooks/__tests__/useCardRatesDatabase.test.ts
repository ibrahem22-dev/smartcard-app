import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
} from '../../types/card.types';
import { Currency, PurchaseCategory } from '../../types/purchase.types';
import {
  CARD_RATES_BENEFITS_DB,
  resolveDatabaseRates,
} from '../useCardRatesDatabase';

function makeCard(overrides: Partial<CardInput> = {}): CardInput {
  return {
    cardId: 'rates-card',
    displayName: 'Max Gold',
    last4: '1234',
    issuer: CardIssuer.Max,
    network: CardNetwork.Visa,
    currency: Currency.ILS,
    framework: { creditLimit: 20_000, currentBalance: 0 },
    billingCycle: { statementClosingDay: 5, billingDayOfMonth: 10 },
    roleTags: [CardRole.Daily],
    primaryRole: CardRole.Daily,
    rewardCategories: [PurchaseCategory.Other],
    cashbackRate: 0,
    foreignTransactionFee: 0.03,
    supportsInstallments: true,
    annualFee: 0,
    isActive: true,
    ...overrides,
  };
}

describe('card rates database', () => {
  test('resolves real Max Gold fee and issuer FX commission', () => {
    expect(resolveDatabaseRates(makeCard())).toEqual({
      creditInterestRate: null,
      installmentInterestRate: null,
      cardLoanInterestRate: null,
      foreignExchangeCommission: 3,
      monthlyFee: 19.9,
      lastUpdated: '2026-06-27',
      matchedClub: 'Max Gold (זהב / זהב עסקי)',
    });
  });

  test('uses an exact Isracard club FX override', () => {
    const result = resolveDatabaseRates(
      makeCard({
        issuer: CardIssuer.Isracard,
        displayName: 'Isracard BASIC',
      }),
    );

    expect(result?.foreignExchangeCommission).toBe(0);
    expect(result?.monthlyFee).toBeNull();
  });

  test('maps the existing Diners CAL display name to the database club', () => {
    const result = resolveDatabaseRates(
      makeCard({
        issuer: CardIssuer.Cal,
        displayName: 'Diners CAL',
      }),
    );

    expect(result?.matchedClub).toBe('Diners Club Israel (דיינרס)');
    expect(result?.foreignExchangeCommission).toBe(3);
    expect(result?.monthlyFee).toBe(17.9);
  });

  test('builds the benefits matcher database from real issuer and club keys', () => {
    expect(
      CARD_RATES_BENEFITS_DB.issuers.Max?.clubs[
        'Max Gold (זהב / זהב עסקי)'
      ],
    ).toEqual({ benefits: [] });
    expect(CARD_RATES_BENEFITS_DB.issuers.Isracard).toBeDefined();
    expect(CARD_RATES_BENEFITS_DB.issuers.CAL).toBeDefined();
  });
});
