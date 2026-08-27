// /src/utils/manualCard.ts
//
// Builds a valid CardInput from the minimal fields an MVP user enters by hand
// (Owner decision #10, option c). LOCK-007 discipline: unknown financial values
// stay unknown — they are NEVER fabricated into a value that a purchase decision
// reads.
//
//   creditLimit / currentBalance  — user-entered (the fields the Purchase Gate uses)
//   billingDayOfMonth             — optional; when unknown it is 0, an invalid day
//                                   that predictChargeReturn filters out, so the
//                                   card contributes NO fabricated charge-return risk.
//   foreignTransactionFee         — optional; when unknown it is NaN, so the FX
//                                   warning is skipped entirely instead of claiming
//                                   a false "0.00%" fee for international purchases.
//
// Fields the MVP Purchase Gate does not read (network, rewards, roles, cashbackRate,
// annualFee) are neutral placeholders here and must be corrected from verified
// issuer data before any feature that consumes them ships. They influence no MVP
// purchase decision.

import * as Crypto from 'expo-crypto';

import { CardIssuer, CardNetwork, type EngineCard } from '../types/card.types';
import { Currency } from '../types/purchase.types';

export interface ManualCardInput {
  readonly displayName: string;
  readonly last4: string;
  readonly issuer: CardIssuer;
  readonly creditLimit: number;
  readonly currentBalance: number;
  /** 1-31; omit when the user does not know it (card is then excluded from
   *  charge-return detection rather than assigned a fabricated billing day). */
  readonly billingDayOfMonth?: number;
  readonly statementClosingDay?: number;
  /** Fraction, e.g. 0.03 = 3%. Omit when unknown — stays unknown (NaN). */
  readonly foreignTransactionFee?: number;
  readonly bankName?: string;
  /** Catalog cardId when the user picked a CURRENT product; omit on the generic path. */
  readonly cardProductId?: string;
  readonly unknownClub?: boolean;
}

// Metadata only: not read by the MVP Purchase Gate. Replaced by verified issuer
// data when available; a placeholder here never drives a purchase decision.
const ISSUER_DEFAULT_NETWORK: Record<CardIssuer, CardNetwork> = {
  [CardIssuer.Max]: CardNetwork.Mastercard,
  [CardIssuer.Isracard]: CardNetwork.Mastercard,
  [CardIssuer.Cal]: CardNetwork.Visa,
};

export function createManualCard(input: ManualCardInput): EngineCard {
  const cardId = Crypto.randomUUID();
  return {
    cardId,
    cardProductId: input.cardProductId ?? 'manual:' + cardId,
    displayName: input.displayName,
    last4: input.last4,
    issuer: input.issuer,
    network: ISSUER_DEFAULT_NETWORK[input.issuer],
    currency: Currency.ILS,
    framework: {
      creditLimit: input.creditLimit,
      currentBalance: input.currentBalance,
    },
    billingCycle: {
      statementClosingDay: input.statementClosingDay ?? 0,
      billingDayOfMonth: input.billingDayOfMonth ?? 0,
    },
    roleTags: [],
    primaryRole: null,
    rewardCategories: [],
    cashbackRate: 0,
    foreignTransactionFee: input.foreignTransactionFee ?? Number.NaN,
    supportsInstallments: false,
    annualFee: 0,
    isActive: true,
    ...(input.bankName === undefined ? {} : { bankName: input.bankName }),
    ...(input.unknownClub === true ? { unknownClub: true } : {}),
  };
}
