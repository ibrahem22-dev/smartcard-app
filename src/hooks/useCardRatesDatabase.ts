import { useMemo } from 'react';

import cardRatesJson from '../data/card_rates.json';
import { CardIssuer, type CardInput } from '../types/card.types';
import type {
  CardRatesDatabase,
  DatabaseClubRates,
  DatabaseIssuerRates,
  ResolvedDatabaseRates,
} from '../types/cardRatesDatabase.types';
import type {
  BenefitsClub,
  BenefitsDB,
  BenefitsIssuer,
} from '../types/benefits.types';

const DATABASE = cardRatesJson as CardRatesDatabase;

const ISSUER_KEYS: Readonly<Record<CardIssuer, string>> = {
  [CardIssuer.Max]: 'Max',
  [CardIssuer.Isracard]: 'Isracard',
  [CardIssuer.Cal]: 'CAL',
};

const CLUB_ALIASES: Readonly<Record<string, string>> = {
  'מועדון מקס רגיל': 'Max Classic (ויזה/מאסטרקארד קלאסיק)',
  'Max Platinum': 'Max Platinum (פלטינה)',
  'ישראכרט רגיל': '',
  'ישראכרט זהב': '',
  'אמריקן אקספרס': '',
  'ויזה כאל': 'CAL Standard (מקומי / בינלאומי / זהב / עסקי)',
  'Diners CAL': 'Diners Club Israel (דיינרס)',
  'ויזה פלטינום': 'CAL Platinum (פלטינום)',
};

function resolveClubName(
  displayName: string,
  issuer: DatabaseIssuerRates,
): string | null {
  if (issuer.clubs[displayName] !== undefined) {
    return displayName;
  }

  const alias = CLUB_ALIASES[displayName];
  if (alias !== undefined) {
    return alias === '' ? null : alias;
  }

  const normalized = displayName.trim().toLocaleLowerCase('en');
  return (
    Object.keys(issuer.clubs).find((clubName: string): boolean => {
      const normalizedClub = clubName.toLocaleLowerCase('en');
      return (
        normalizedClub.startsWith(normalized) ||
        normalized.startsWith(normalizedClub.split(' (')[0] ?? normalizedClub)
      );
    }) ?? null
  );
}

function nullableRate(
  clubValue: number | null | undefined,
  defaultValue: number | null | undefined,
): number | null {
  return clubValue ?? defaultValue ?? null;
}

export function resolveDatabaseRates(
  card: CardInput,
): ResolvedDatabaseRates | null {
  const issuer = DATABASE.issuers[ISSUER_KEYS[card.issuer]];
  if (issuer === undefined) {
    return null;
  }
  const matchedClub = resolveClubName(card.displayName, issuer);
  const club: DatabaseClubRates | undefined =
    matchedClub === null ? undefined : issuer.clubs[matchedClub];

  return {
    creditInterestRate: nullableRate(
      club?.creditInterestRate,
      issuer.defaultRates.creditInterestRate,
    ),
    installmentInterestRate: nullableRate(
      club?.installmentInterestRate,
      issuer.defaultRates.installmentInterestRate,
    ),
    cardLoanInterestRate: nullableRate(
      club?.cardLoanInterestRate,
      issuer.defaultRates.cardLoanInterestRate,
    ),
    foreignExchangeCommission: nullableRate(
      club?.foreignExchangeCommission,
      issuer.defaultRates.foreignExchangeCommission,
    ),
    monthlyFee: nullableRate(
      club?.monthlyFee,
      issuer.defaultRates.monthlyFee,
    ),
    lastUpdated: DATABASE._meta.lastUpdated,
    matchedClub,
  };
}

export function buildBenefitsDatabase(): BenefitsDB {
  const issuers: Record<string, BenefitsIssuer> = {};

  Object.entries(DATABASE.issuers).forEach(
    ([issuerName, issuer]: [string, DatabaseIssuerRates]): void => {
      const clubs: Record<string, BenefitsClub> = {};
      Object.entries(issuer.clubs).forEach(
        ([clubName, club]: [string, DatabaseClubRates]): void => {
          clubs[clubName] = { benefits: club.benefits ?? [] };
        },
      );
      Object.entries(CLUB_ALIASES).forEach(
        ([alias, clubName]: [string, string]): void => {
          if (clubName !== '' && clubs[clubName] !== undefined) {
            clubs[alias] = clubs[clubName];
          }
        },
      );
      issuers[issuerName] = { clubs };
    },
  );

  return { issuers };
}

export const CARD_RATES_BENEFITS_DB: BenefitsDB = buildBenefitsDatabase();

export function useCardDatabaseRates(
  card: CardInput | undefined,
): ResolvedDatabaseRates | null {
  return useMemo<ResolvedDatabaseRates | null>(
    () => (card === undefined ? null : resolveDatabaseRates(card)),
    [card],
  );
}
