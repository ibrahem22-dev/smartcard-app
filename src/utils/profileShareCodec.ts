import {
  CardIssuer,
  CardNetwork,
  CardRole,
  type CardInput,
  type CardRates,
} from '../types/card.types';
import type {
  ProfileShareSource,
  TransferCard,
  TransferProfile,
} from '../types/profileShare.types';
import { Currency, PurchaseCategory } from '../types/purchase.types';
import {
  TRANSFER_RATE_MAX_PCT,
  TRANSFER_FX_COMMISSION_MAX_PCT,
  MONETARY_MIN_ILS,
  MONETARY_MAX_ILS,
} from '../config/financial';

const ISSUERS: readonly string[] = Object.values(CardIssuer);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCardRates(value: unknown): value is CardRates {
  return (
    isRecord(value) &&
    isFiniteNumber(value.creditInterestRate) &&
    value.creditInterestRate >= 0 &&
    value.creditInterestRate <= TRANSFER_RATE_MAX_PCT &&
    isFiniteNumber(value.installmentInterestRate) &&
    value.installmentInterestRate >= 0 &&
    value.installmentInterestRate <= TRANSFER_RATE_MAX_PCT &&
    isFiniteNumber(value.cardLoanInterestRate) &&
    value.cardLoanInterestRate >= 0 &&
    value.cardLoanInterestRate <= TRANSFER_RATE_MAX_PCT &&
    isFiniteNumber(value.foreignExchangeCommission) &&
    value.foreignExchangeCommission >= 0 &&
    value.foreignExchangeCommission <= TRANSFER_FX_COMMISSION_MAX_PCT &&
    isFiniteNumber(value.monthlyFee) &&
    value.monthlyFee >= 0 &&
    value.monthlyFee <= MONETARY_MAX_ILS &&
    (value.source === 'db' || value.source === 'manual') &&
    typeof value.lastUpdated === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.lastUpdated)
  );
}

function isTransferCard(value: unknown): value is TransferCard {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.issuer === 'string' &&
    ISSUERS.includes(value.issuer) &&
    typeof value.club === 'string' &&
    value.club.trim() !== '' &&
    typeof value.last4 === 'string' &&
    /^\d{4}$/.test(value.last4) &&
    Number.isInteger(value.billingDay) &&
    isFiniteNumber(value.billingDay) &&
    value.billingDay >= 1 &&
    value.billingDay <= 31 &&
    isFiniteNumber(value.creditLimit) &&
    value.creditLimit >= MONETARY_MIN_ILS &&
    value.creditLimit <= MONETARY_MAX_ILS &&
    (value.cardRates === undefined || isCardRates(value.cardRates))
  );
}

export function serializeTransferProfile(
  profile: ProfileShareSource,
  cards: readonly CardInput[],
): TransferProfile {
  // SEC: pinHash explicitly excluded — do not remove (Agent 5 traceability)
  return {
    displayName: profile.displayName,
    bankName: profile.bankName,
    cards: cards.map(
      (card: CardInput): TransferCard => ({
        issuer: card.issuer,
        club: card.displayName,
        last4: card.last4,
        billingDay: card.billingCycle.billingDayOfMonth,
        creditLimit: card.framework.creditLimit,
        ...(card.cardRates === undefined
          ? {}
          : { cardRates: card.cardRates }),
      }),
    ),
  };
}

export function parseTransferProfile(value: unknown): TransferProfile | null {
  if (
    !isRecord(value) ||
    typeof value.displayName !== 'string' ||
    value.displayName.trim() === '' ||
    typeof value.bankName !== 'string' ||
    value.bankName.trim() === '' ||
    !Array.isArray(value.cards) ||
    !value.cards.every(isTransferCard)
  ) {
    return null;
  }

  return {
    displayName: value.displayName.trim(),
    bankName: value.bankName.trim(),
    cards: value.cards,
  };
}

export function buildImportedCards(
  profileId: string,
  cards: readonly TransferCard[],
): CardInput[] {
  return cards.map(
    (card: TransferCard, index: number): CardInput => ({
      cardId: `${profileId}-card-${index + 1}`,
      displayName: card.club,
      last4: card.last4,
      issuer: card.issuer,
      network: CardNetwork.Visa,
      currency: Currency.ILS,
      framework: {
        creditLimit: card.creditLimit,
        currentBalance: 0,
      },
      billingCycle: {
        statementClosingDay: Math.max(1, card.billingDay - 5),
        billingDayOfMonth: card.billingDay,
      },
      roleTags: [CardRole.Daily],
      primaryRole: null,
      rewardCategories: [PurchaseCategory.Other],
      cashbackRate: 0,
      foreignTransactionFee: 0,
      supportsInstallments: true,
      annualFee: 0,
      isActive: true,
      bankName: card.club,
      ...(card.cardRates === undefined ? {} : { cardRates: card.cardRates }),
    }),
  );
}
