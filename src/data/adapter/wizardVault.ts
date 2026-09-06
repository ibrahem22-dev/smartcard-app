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
import { catalogProductById } from './cardCatalog';
import { cardFeeProfileFor } from './cardFeeProfile';

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
  /** Programme/club node ids the user selected in the guided flow. Absent: never asked. */
  readonly programmeNodeIds?: readonly string[];
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

  /* CANONICAL IDENTITY, WHERE THE CATALOG HAS IT — the addendum's §3 requirement.
     A catalog pick keeps the estate's own issuer, operator, network ids and product type, so every
     later question about this card (its fee, its programmes, its benefits, whom to phone) is asked
     of a canonical id and never of a display name. A manually described card carries none of them,
     and that absence is what marks it for reconciliation rather than a guessed id. */
  const canonical =
    input.catalogCardId === undefined ? undefined : catalogProductById(input.catalogCardId);

  /* THE FX COMMISSION COMES FROM THE PACK, NOT FROM THE USER — the defect the addendum names.
     `costs.fxCommissionPct` is VERIFIED and USABLE on all 378 current products, resolved per card
     by the pipeline including the card-level exceptions. Storing what the user typed while that
     figure sat in the bundle is what made the app appear not to bind fees at all. The user's own
     figure is still honoured when there is no catalog row to read. */
  const catalogFx =
    input.catalogCardId === undefined
      ? undefined
      : cardFeeProfileFor(input.catalogCardId)?.fxCommissionPct.single;
  const foreignTransactionFee =
    catalogFx !== undefined && catalogFx.unit === 'PERCENT'
      ? catalogFx.value / 100
      : input.foreignTransactionFee ?? Number.NaN;

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
    ...(input.programmeNodeIds === undefined ? {} : { programmeNodeIds: input.programmeNodeIds }),
  };

  const product: CardProduct = {
    cardProductId,
    issuer: input.issuer,
    network,
    currency: Currency.ILS,
    roleTags: [],
    rewardCategories: [],
    cashbackRate: 0,
    foreignTransactionFee,
    supportsInstallments: false,
    annualFee: 0,
    ...(canonical === undefined
      ? {}
      : {
        issuerOrgId: canonical.issuerOrgId,
        networkIds: canonical.networkIds,
        ...(canonical.operatingCardCompanyId === undefined
          ? {}
          : { operatingCardCompanyId: canonical.operatingCardCompanyId }),
        ...(canonical.productType === undefined ? {} : { productType: canonical.productType }),
      }),
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
