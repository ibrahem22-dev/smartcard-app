// /src/types/card.types.ts
//
// P4 criterion M6 — CardProduct and UserCard are structurally separate.
// The legacy `CardInput` interface mixed catalog facts, user vault state and
// engine output into one record. That shape is gone as a stored type.
//
//   CardProduct  — shared facts (and, later, artwork identity). No user state.
//   UserCard     — product reference + optional last4 + local state. No artwork,
//                  no asset reference, no shared product fact.
//   EngineCard   — composed at the store boundary for engines and screens that
//                  still consume a flat view. Never persisted.

import type { Currency, PurchaseCategory } from './purchase.types';

/**
 * The only three credit-card issuers operating in Israel.
 * Isracard also issues Amex; CAL issues Visa + Diners.
 */
export enum CardIssuer {
  Max = 'max',
  Isracard = 'isracard',
  Cal = 'cal',
}

export enum CardNetwork {
  Visa = 'visa',
  Mastercard = 'mastercard',
  Amex = 'amex',
  Diners = 'diners',
}

export type ForeignCurrencyType =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'CHF'
  | 'other';

/** The single primary classification cardRoleEngine assigns to a card. */
export enum CardRole {
  Daily = 'daily',
  Travel = 'travel',
  Subscriptions = 'subscriptions',
  Installments = 'installments',
  Education = 'education',
  Benefits = 'benefits',
}

/**
 * Israeli billing model: the bank account is debited (חיוב) on a fixed day each
 * month, which can differ PER CARD. The statement cycle closes a few days before
 * that. Both are day-of-month values (1-31).
 */
export interface CardBillingCycle {
  readonly statementClosingDay: number;
  readonly billingDayOfMonth: number;
}

/** מסגרת אשראי — framework limit and current usage. availableCredit is derived
 *  by the engines (creditLimit - currentBalance) and intentionally NOT stored,
 *  to avoid a second source of truth. */
export interface CardCreditFramework {
  /** Security boundary: engine inputs silently cap this value at ₪9,999,999. */
  readonly creditLimit: number;    // total framework (₪)
  readonly currentBalance: number; // amount already charged this cycle (₪)
}

/** Financial rates and fees associated with a card product. */
export interface CardRates {
  readonly creditInterestRate: number;
  readonly installmentInterestRate: number;
  readonly cardLoanInterestRate: number;
  readonly foreignExchangeCommission: number;
  readonly monthlyFee: number;
  readonly source: string;
  /** ISO 8601 date. */
  readonly lastUpdated: string;
}

/** Current card-fee discount details. */
export interface CardFeeInfo {
  readonly originalFee: number;
  readonly discountPercent: number;
  readonly effectiveFee: number;
  /** ISO 8601 date. */
  readonly discountEndDate?: string;
  readonly discountSource?: string;
}

/**
 * Catalog / shared product. Artwork identity is this id (MEDIA_ARCHITECTURE §5.1
 * tier 3 is generated from product facts). No last4, no balances, no nickname.
 */
export interface CardProduct {
  readonly cardProductId: string;
  /**
   * THE LEGACY PRESENTATION-TIER ISSUER KEY — three values, and it is not canonical identity.
   *
   * It predates the canonical catalog and drives theme colour, card artwork and the legacy
   * benefits vocabulary. It cannot express the estate's model: 303 of 378 current products are
   * issued by one of THIRTEEN BANKS and merely OPERATED by a card company, and `org:amex-il` is a
   * fourth card company this enum has no member for.
   *
   * `issuerOrgId` below is the canonical answer to "whose card is this". Every consumer added from
   * the canonical campaign onward reads that; this field is kept so the existing surfaces that
   * switch on it keep compiling and keep looking right.
   */
  readonly issuer: CardIssuer;
  /**
   * WHOSE CARD IT IS — the canonical `org:*` id, from the catalog.
   *
   * Present on a card the user picked from the catalog and on a legacy card the reconciler could
   * resolve. ABSENT means the product is not a catalog row (a manually described card) or the
   * reconciler refused to guess between candidates — and absent is a first-class state, because a
   * canonical id nobody verified is worse than none.
   */
  readonly issuerOrgId?: string;
  /**
   * WHICH CARD COMPANY RUNS IT — canonical, and deliberately a SEPARATE key from the issuer.
   *
   * The `org:amex-il` catalog row states the reason verbatim: Amex-IL and Isracard *"are NOT
   * disjoint issuers — any filter or join that assumes disjointness is wrong"*, and yet they
   * *"carry genuinely different fee terms (e.g. FX 2.9% vs 2.5%) and must not be merged into one
   * fee scope."* Every tariff join in this app is issuer × operator for that reason.
   */
  readonly operatingCardCompanyId?: string;
  /**
   * The canonical `net:*` ids the estate's network string resolves to. Empty or absent where the
   * estate wrote `UNKNOWN`, `NOT_CONFIRMED` or `MULTI_NETWORK_SEE_VARIANTS`; never defaulted.
   */
  readonly networkIds?: readonly string[];
  /** The estate's own product classification, verbatim. NOT a tier — the estate models no tier. */
  readonly productType?: string;
  readonly network: CardNetwork;
  readonly currency: Currency;
  /** Roles this product is capable of filling (capability tags). May be empty. */
  readonly roleTags: readonly CardRole[];
  readonly rewardCategories: readonly PurchaseCategory[];
  /** Baseline reward as a fraction (e.g. 0.02 = 2%). */
  readonly cashbackRate: number;
  /** FX fee as a fraction (e.g. 0.03 = 3%); low value favors the travel role. */
  readonly foreignTransactionFee: number;
  readonly supportsInstallments: boolean;
  readonly annualFee: number;
  readonly bankName?: string;
  readonly cardRates?: CardRates;
  readonly cardFee?: CardFeeInfo;
}

/**
 * One card in the user's vault. Holds a product reference, an optional last4,
 * and local state. Artwork is never stored per user — it is resolved from the
 * product at render time (MEDIA_ARCHITECTURE §7.2).
 */
export interface UserCard {
  readonly cardId: string;
  readonly cardProductId: string;
  readonly displayName: string;
  /** Optional. Spec §10: the tile that omits digits is the normal case. */
  readonly last4?: string;
  readonly framework: CardCreditFramework;
  readonly billingCycle: CardBillingCycle;
  readonly isActive: boolean;
  /** The single role assigned by cardRoleEngine. null until assigned. */
  readonly primaryRole: CardRole | null;
  readonly unknownClub?: boolean;
  readonly hasForeignCurrencyAccount?: boolean;
  readonly foreignCurrencyType?: ForeignCurrencyType;
  readonly bankFxCommission?: number;
  readonly cardIssuanceDate?: string;
  /**
   * Programmes and clubs the USER said this card carries, as canonical node ids.
   *
   * On the UserCard rather than the product, because two people holding the same product can be in
   * different clubs — the product says which programmes are COMPATIBLE, and this says which the
   * holder actually has. Empty means none chosen; absent means the question was never asked, which
   * is the state every card created before the guided flow is in.
   */
  readonly programmeNodeIds?: readonly string[];
}

/**
 * Flat view engines and existing screens consume. Composed at the store
 * boundary from UserCard + CardProduct. Not a persisted record.
 */
export interface EngineCard {
  readonly cardId: string;
  /** Present on compositions from the store. Fixtures may omit it; split then mints `legacy:${cardId}`. */
  readonly cardProductId?: string;
  readonly displayName: string;
  readonly last4: string;
  readonly issuer: CardIssuer;
  readonly network: CardNetwork;
  readonly currency: Currency;
  readonly framework: CardCreditFramework;
  readonly billingCycle: CardBillingCycle;
  readonly roleTags: readonly CardRole[];
  readonly primaryRole: CardRole | null;
  readonly rewardCategories: readonly PurchaseCategory[];
  readonly cashbackRate: number;
  readonly foreignTransactionFee: number;
  readonly supportsInstallments: boolean;
  readonly annualFee: number;
  readonly isActive: boolean;
  readonly bankName?: string;
  readonly unknownClub?: boolean;
  readonly cardRates?: CardRates;
  readonly cardFee?: CardFeeInfo;
  readonly hasForeignCurrencyAccount?: boolean;
  readonly foreignCurrencyType?: ForeignCurrencyType;
  readonly bankFxCommission?: number;
  readonly cardIssuanceDate?: string;
  /** Canonical issuer id, from the product. See `CardProduct.issuerOrgId`. */
  readonly issuerOrgId?: string;
  /** Canonical operating card company id, from the product. */
  readonly operatingCardCompanyId?: string;
  /** Canonical `net:*` ids, from the product. */
  readonly networkIds?: readonly string[];
  /** The estate's product classification, from the product. */
  readonly productType?: string;
  /** Programmes the holder said this card carries, from the user card. */
  readonly programmeNodeIds?: readonly string[];
}

/**
 * @deprecated The mixed stored record is gone. This alias is the engine view
 * (`EngineCard`) so existing call sites typecheck while they still consume the
 * composition. Do not persist a CardInput; persist UserCard + CardProduct.
 */
export type CardInput = EngineCard;

export function composeEngineCard(user: UserCard, product: CardProduct): EngineCard {
  return {
    cardId: user.cardId,
    cardProductId: product.cardProductId,
    displayName: user.displayName,
    last4: user.last4 ?? '',
    issuer: product.issuer,
    network: product.network,
    currency: product.currency,
    framework: user.framework,
    billingCycle: user.billingCycle,
    roleTags: product.roleTags,
    primaryRole: user.primaryRole,
    rewardCategories: product.rewardCategories,
    cashbackRate: product.cashbackRate,
    foreignTransactionFee: product.foreignTransactionFee,
    supportsInstallments: product.supportsInstallments,
    annualFee: product.annualFee,
    isActive: user.isActive,
    ...(product.bankName !== undefined ? { bankName: product.bankName } : {}),
    ...(user.unknownClub !== undefined ? { unknownClub: user.unknownClub } : {}),
    ...(product.cardRates !== undefined ? { cardRates: product.cardRates } : {}),
    ...(product.cardFee !== undefined ? { cardFee: product.cardFee } : {}),
    ...(user.hasForeignCurrencyAccount !== undefined
      ? { hasForeignCurrencyAccount: user.hasForeignCurrencyAccount }
      : {}),
    ...(user.foreignCurrencyType !== undefined
      ? { foreignCurrencyType: user.foreignCurrencyType }
      : {}),
    ...(user.bankFxCommission !== undefined ? { bankFxCommission: user.bankFxCommission } : {}),
    ...(user.cardIssuanceDate !== undefined ? { cardIssuanceDate: user.cardIssuanceDate } : {}),
    ...(product.issuerOrgId !== undefined ? { issuerOrgId: product.issuerOrgId } : {}),
    ...(product.operatingCardCompanyId !== undefined
      ? { operatingCardCompanyId: product.operatingCardCompanyId }
      : {}),
    ...(product.networkIds !== undefined ? { networkIds: product.networkIds } : {}),
    ...(product.productType !== undefined ? { productType: product.productType } : {}),
    ...(user.programmeNodeIds !== undefined ? { programmeNodeIds: user.programmeNodeIds } : {}),
  };
}

export function splitEngineCard(card: EngineCard): { user: UserCard; product: CardProduct } {
  const cardProductId =
    card.cardProductId !== undefined && card.cardProductId.length > 0
      ? card.cardProductId
      : 'legacy:' + card.cardId;
  const user: UserCard = {
    cardId: card.cardId,
    cardProductId,
    displayName: card.displayName,
    framework: card.framework,
    billingCycle: card.billingCycle,
    isActive: card.isActive,
    primaryRole: card.primaryRole,
    ...(card.last4.length > 0 ? { last4: card.last4 } : {}),
    ...(card.unknownClub !== undefined ? { unknownClub: card.unknownClub } : {}),
    ...(card.hasForeignCurrencyAccount !== undefined
      ? { hasForeignCurrencyAccount: card.hasForeignCurrencyAccount }
      : {}),
    ...(card.foreignCurrencyType !== undefined
      ? { foreignCurrencyType: card.foreignCurrencyType }
      : {}),
    ...(card.bankFxCommission !== undefined ? { bankFxCommission: card.bankFxCommission } : {}),
    ...(card.cardIssuanceDate !== undefined ? { cardIssuanceDate: card.cardIssuanceDate } : {}),
    ...(card.programmeNodeIds !== undefined ? { programmeNodeIds: card.programmeNodeIds } : {}),
  };
  const product: CardProduct = {
    cardProductId,
    issuer: card.issuer,
    network: card.network,
    currency: card.currency,
    roleTags: card.roleTags,
    rewardCategories: card.rewardCategories,
    cashbackRate: card.cashbackRate,
    foreignTransactionFee: card.foreignTransactionFee,
    supportsInstallments: card.supportsInstallments,
    annualFee: card.annualFee,
    ...(card.bankName !== undefined ? { bankName: card.bankName } : {}),
    ...(card.cardRates !== undefined ? { cardRates: card.cardRates } : {}),
    ...(card.cardFee !== undefined ? { cardFee: card.cardFee } : {}),
    ...(card.issuerOrgId !== undefined ? { issuerOrgId: card.issuerOrgId } : {}),
    ...(card.operatingCardCompanyId !== undefined
      ? { operatingCardCompanyId: card.operatingCardCompanyId }
      : {}),
    ...(card.networkIds !== undefined ? { networkIds: card.networkIds } : {}),
    ...(card.productType !== undefined ? { productType: card.productType } : {}),
  };
  return { user, product };
}

/** Ranked card pick returned by cardRoleEngine.recommendCard. */
export interface CardRecommendation {
  readonly card: EngineCard;
  /** 0–100 suitability score for the purchase context. */
  readonly score: number;
  readonly scoreReason: string;
  readonly scoreReasonAr: string;
}
