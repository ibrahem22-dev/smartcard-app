import type { Benefit, BenefitsDB } from './benefits.types';
import type { CardInput } from './card.types';

export interface DatabaseRateFields {
  readonly creditInterestRate?: number | null;
  readonly installmentInterestRate?: number | null;
  readonly cardLoanInterestRate?: number | null;
  readonly foreignExchangeCommission?: number | null;
  readonly monthlyFee?: number | null;
}

export interface DatabaseClubRates extends DatabaseRateFields {
  readonly benefits?: readonly Benefit[];
}

export interface DatabaseIssuerRates {
  readonly defaultRates: DatabaseRateFields;
  readonly clubs: Readonly<Record<string, DatabaseClubRates>>;
}

export interface CardRatesDatabase {
  readonly _meta: {
    readonly lastUpdated: string;
  };
  readonly issuers: Readonly<Record<string, DatabaseIssuerRates>>;
}

export interface ResolvedDatabaseRates {
  readonly creditInterestRate: number | null;
  readonly installmentInterestRate: number | null;
  readonly cardLoanInterestRate: number | null;
  readonly foreignExchangeCommission: number | null;
  readonly monthlyFee: number | null;
  readonly lastUpdated: string;
  readonly matchedClub: string | null;
}

export interface UseCardDatabaseRatesResult {
  readonly databaseRates: ResolvedDatabaseRates | null;
  readonly benefitsDB: BenefitsDB;
  readonly card: CardInput;
}
