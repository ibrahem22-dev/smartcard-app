/**
 * LEGACY CARD RECONCILIATION — what a card created before the canonical flow resolves to.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * NOTHING IS DESTROYED AND NOTHING IS SILENTLY CHOSEN
 *
 * Cards already in a vault were created by the free-form path: a display name the user typed, one
 * of three legacy issuer values, and a `manual:` product id that is not a catalog row. The
 * addendum's instruction is exact — *"Do not destroy them… Do not silently choose between
 * ambiguous products… Preserve previous user-entered data until reconciliation succeeds."*
 *
 * So this module CLASSIFIES and never writes. It answers one question per card and hands the
 * answer to a surface, which asks the user when the answer is not certain.
 *
 *   · `CANONICALLY_RESOLVED` — the stored `cardProductId` IS a current catalog product. Nothing to
 *      ask: the card already carries canonical identity and every canonical query works on it.
 *   · `AMBIGUOUS`            — the catalog holds one or more products whose published name matches
 *      what the user typed. A candidate is OFFERED, never adopted.
 *   · `UNRESOLVED`           — no candidate. The card keeps working on what the user entered.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A SINGLE NAME MATCH IS STILL AMBIGUOUS, AND THAT IS DELIBERATE
 *
 * It would be easy to auto-adopt a unique name match and report a higher resolution rate. The
 * directive forbids modelling card identity from display text, and the cost of being wrong is not
 * cosmetic: a wrongly adopted product id would bind the card to another product's FX commission,
 * another product's tariff scope and another product's benefits, and every one of those would then
 * be rendered to the user as verified. One tap of confirmation is cheaper than that.
 *
 * The legacy issuer enum is used only to NARROW candidates, never to identify: `max`, `isracard`
 * and `cal` name operating card companies, and a card whose stored issuer is `cal` cannot be a
 * product no card company operates on behalf of anybody.
 */
import {
  allCatalogProducts,
  catalogProductById,
  issuerByOrgId,
  type CatalogProduct,
} from './cardCatalog';
import { CardIssuer } from '../../types/card.types';

export type ReconciliationState = 'CANONICALLY_RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED';

export interface ReconciliationReading {
  readonly state: ReconciliationState;
  /** The product it already resolves to. Present only in the resolved state. */
  readonly product?: CatalogProduct;
  /** Products the user could be asked to choose between. Never adopted automatically. */
  readonly candidates: readonly CatalogProduct[];
  /** Why the reading is what it is, for a surface that wants to explain itself. */
  readonly reason:
    | 'PRODUCT_ID_IS_A_CURRENT_CATALOG_ROW'
    | 'NAME_MATCHES_CATALOG_PRODUCTS'
    | 'NO_CATALOG_PRODUCT_MATCHES'
    | 'PRODUCT_ID_IS_NOT_A_CATALOG_ROW';
}

/** The card facts reconciliation reads. A narrow view so a caller cannot hand it a whole vault. */
export interface ReconcilableCard {
  readonly cardId: string;
  readonly cardProductId?: string;
  readonly displayName: string;
  readonly issuer: CardIssuer;
}

/**
 * The legacy enum's three values as canonical OPERATOR ids.
 *
 * `isracard` narrows to Isracard AND Amex-IL because the estate's own join caveat says the two are
 * not disjoint — Amex Israel cards are issued inside the Isracard group. Narrowing to one would
 * drop every Amex product for a user whose card was stored as Isracard, which is what the caveat
 * exists to prevent.
 */
const OPERATORS_FOR_LEGACY_ISSUER: Readonly<Record<CardIssuer, readonly string[]>> = {
  [CardIssuer.Max]: ['org:max'],
  [CardIssuer.Cal]: ['org:cal'],
  [CardIssuer.Isracard]: ['org:isracard', 'org:amex-il'],
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFC')
    .replace(/[־'"`׳״\-–—_/\\.,()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const publishedNames = (product: CatalogProduct): readonly string[] =>
  [product.nameHe, product.nameEn, product.nameAr].filter(
    (name): name is string => typeof name === 'string' && name.trim() !== '',
  );

/**
 * Classify one stored card.
 *
 * Reads only. A caller that wants to adopt a candidate calls `adoptCanonicalProduct` with an id
 * the USER chose.
 */
export function reconcileCard(card: ReconcilableCard): ReconciliationReading {
  const stored = card.cardProductId;
  if (stored !== undefined && stored !== '') {
    const product = catalogProductById(stored);
    if (product !== undefined) {
      return {
        state: 'CANONICALLY_RESOLVED',
        product,
        candidates: [],
        reason: 'PRODUCT_ID_IS_A_CURRENT_CATALOG_ROW',
      };
    }
  }

  const needle = normalize(card.displayName);
  if (needle === '') {
    return {
      state: 'UNRESOLVED',
      candidates: [],
      reason: stored === undefined ? 'NO_CATALOG_PRODUCT_MATCHES' : 'PRODUCT_ID_IS_NOT_A_CATALOG_ROW',
    };
  }

  const operators = new Set(OPERATORS_FOR_LEGACY_ISSUER[card.issuer]);
  const candidates = allCatalogProducts().filter((product) => {
    /* Narrow by operator where the estate recorded one. A product with no recorded operator is
       still a candidate: an absent operator is not a statement that it is a different company's. */
    if (
      product.operatingCardCompanyId !== undefined
      && !operators.has(product.operatingCardCompanyId)
    ) {
      /* Unless the product is ISSUED by that card company directly, which is the non-bank case. */
      if (!operators.has(product.issuerOrgId)) return false;
    }
    return publishedNames(product).some((name) => normalize(name) === needle);
  });

  return candidates.length === 0
    ? {
      state: 'UNRESOLVED',
      candidates: [],
      reason: 'NO_CATALOG_PRODUCT_MATCHES',
    }
    : {
      state: 'AMBIGUOUS',
      candidates,
      reason: 'NAME_MATCHES_CATALOG_PRODUCTS',
    };
}

/** A whole vault's reconciliation, for the one-time "confirm your cards" prompt. */
export function reconcileAll(
  cards: readonly ReconcilableCard[],
): readonly (ReconciliationReading & { readonly cardId: string })[] {
  return cards.map((card) => ({ ...reconcileCard(card), cardId: card.cardId }));
}

/**
 * The canonical fields a confirmed product contributes, ready to merge onto a stored product.
 *
 * Returns `undefined` for an id the catalog does not hold — a confirmation the user could not have
 * given. Nothing here writes: the store owns persistence, and this owns the shape.
 */
export function adoptCanonicalProduct(cardProductId: string): {
  readonly cardProductId: string;
  readonly issuerOrgId: string;
  readonly operatingCardCompanyId?: string;
  readonly networkIds: readonly string[];
  readonly productType?: string;
  readonly issuerKind?: 'BANK' | 'CARD_COMPANY';
} | undefined {
  const product = catalogProductById(cardProductId);
  if (product === undefined) return undefined;
  const issuer = issuerByOrgId(product.issuerOrgId);
  return {
    cardProductId: product.cardId,
    issuerOrgId: product.issuerOrgId,
    networkIds: product.networkIds,
    ...(product.operatingCardCompanyId === undefined
      ? {}
      : { operatingCardCompanyId: product.operatingCardCompanyId }),
    ...(product.productType === undefined ? {} : { productType: product.productType }),
    ...(issuer === undefined ? {} : { issuerKind: issuer.kind }),
  };
}
