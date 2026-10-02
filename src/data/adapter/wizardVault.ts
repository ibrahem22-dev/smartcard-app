/**
 * W5 — wizard vault write. The created card reaches the vault as UserCard + CardProduct
 * through this adapter. The wizard never writes a pack row, a dataset unit, or packStore.
 *
 * Catalog picks keep the catalog product id; product facts are mapped here, not copied as
 * raw JSON. The generic path mints a local `manual:` product id that is not a catalog row.
 */
import * as Crypto from 'expo-crypto';

import {
  CardIssuer,
  CardNetwork,
  type CardProduct,
  type UserCard,
} from '../../types/card.types';
import { Currency } from '../../types/purchase.types';
import { catalogCardRows, isCurrentCatalogProduct } from './catalogSearch';

export type WizardCardInput = {
  readonly displayName: string;
  readonly last4: string;
  readonly issuer: CardIssuer;
  readonly creditLimit: number;
  readonly currentBalance: number;
  readonly billingDayOfMonth?: number;
  readonly statementClosingDay?: number;
  readonly foreignTransactionFee?: number;
  readonly catalogCardId?: string;
  readonly unknownClub?: boolean;
};

export type VaultCardWrite = {
  readonly user: UserCard;
  readonly product: CardProduct;
};

const NETWORK_FROM_PACK: Readonly<Record<string, CardNetwork>> = {
  VISA: CardNetwork.Visa,
  MASTERCARD: CardNetwork.Mastercard,
  AMERICAN_EXPRESS: CardNetwork.Amex,
  AMEX: CardNetwork.Amex,
  DINERS: CardNetwork.Diners,
};

const ISSUER_DEFAULT_NETWORK: Readonly<Record<CardIssuer, CardNetwork>> = {
  [CardIssuer.Max]: CardNetwork.Mastercard,
  [CardIssuer.Isracard]: CardNetwork.Mastercard,
  [CardIssuer.Cal]: CardNetwork.Visa,
};

function asText(row: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = row[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function networkFromCatalog(cardId: string, fallback: CardIssuer): CardNetwork {
  const row = catalogCardRows().find(candidate => candidate['cardId'] === cardId);
  const raw = row === undefined ? undefined : asText(row, 'networkRaw');
  if (raw !== undefined && NETWORK_FROM_PACK[raw] !== undefined) {
    return NETWORK_FROM_PACK[raw];
  }
  return ISSUER_DEFAULT_NETWORK[fallback];
}

export function writeWizardCard(input: WizardCardInput): VaultCardWrite {
  if (input.catalogCardId !== undefined && !isCurrentCatalogProduct(input.catalogCardId)) {
    throw new Error(
      'refusing to persist a catalog id that is not a CURRENT product — that would invent a dataset row',
    );
  }

  const cardId = Crypto.randomUUID();
  const cardProductId = input.catalogCardId ?? 'manual:' + cardId;
  const network =
    input.catalogCardId === undefined
      ? ISSUER_DEFAULT_NETWORK[input.issuer]
      : networkFromCatalog(input.catalogCardId, input.issuer);

  const user: UserCard = {
    cardId,
    cardProductId,
    displayName: input.displayName,
    framework: {
      creditLimit: input.creditLimit,
      currentBalance: input.currentBalance,
    },
    billingCycle: {
      statementClosingDay: input.statementClosingDay ?? 0,
      billingDayOfMonth: input.billingDayOfMonth ?? 0,
    },
    isActive: true,
    primaryRole: null,
    ...(input.last4.length > 0 ? { last4: input.last4 } : {}),
    ...(input.unknownClub === true ? { unknownClub: true } : {}),
  };

  const product: CardProduct = {
    cardProductId,
    issuer: input.issuer,
    network,
    currency: Currency.ILS,
    roleTags: [],
    rewardCategories: [],
    cashbackRate: 0,
    foreignTransactionFee: input.foreignTransactionFee ?? Number.NaN,
    supportsInstallments: false,
    annualFee: 0,
  };

  return { user, product };
}

/** True when a persisted record still looks like a pack/dataset row rather than a vault write. */
export function isRawDatasetValue(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const keys = Object.keys(value);
  return (
    keys.includes('units') ||
    keys.includes('lifecycleStatus') ||
    keys.includes('datasetVersion') ||
    keys.includes('costs') ||
    keys.includes('conflicts')
  );
}
