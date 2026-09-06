/**
 * THE CANONICAL CARD QUERY LAYER — issuers, products, networks, programmes, fees, waivers.
 *
 * One module inside `src/data/adapter/**` reads the catalog pack for card identity, and every
 * consumer — the guided add-card flow, Card Detail, Card DNA, the Benefits Hub, Merchant Radar and
 * the Negotiation Hub — asks it rather than joining raw units of its own. Two joiners would be two
 * answers to "what does this card cost", which is the defect this layer exists to prevent.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE ESTATE ACTUALLY MODELS, AND WHAT IT DOES NOT
 *
 * ISSUER AND OPERATOR ARE DIFFERENT ENTITIES AND THE ESTATE SAYS SO. `issuerOrgId` is whose card
 * it is; `operatingCardCompanyId` is which card company runs it. 303 of 378 current products are
 * BANK-issued and most of those are operated by CAL, Isracard, max or Amex-IL. The
 * `org:amex-il` row carries the caveat verbatim: *"'isracard' and 'amex' are NOT disjoint issuers
 * — any filter or join that assumes disjointness is wrong… they nevertheless carry genuinely
 * different fee terms (e.g. FX 2.9% vs 2.5%) and must not be merged into one fee scope."* So this
 * layer keeps both keys on every product and never collapses them.
 *
 * THERE IS NO TIER FIELD. `productType` carries 66 distinct values across 474 rows — everything
 * from `CREDIT_CARD` to `TEACHERS_UNION_CLUB_CREDIT_CARD` — and no row carries a Gold/Platinum
 * tier as a field. So this layer exposes `productType` verbatim and **invents no tier**. A UI that
 * offered "Gold" as a filter would be offering a dimension the estate does not model.
 *
 * NETWORK IS FREE TEXT AND IS NORMALISED, NOT GUESSED. `networkRaw` has 21 spellings including
 * `Mastercard, Visa`, `MULTI_NETWORK_SEE_VARIANTS`, `NOT_CONFIRMED` and `UNKNOWN`. Each is mapped
 * to the canonical `net:*` ids the `networks` unit publishes, a multi-network row resolves to the
 * SET it names, and an unconfirmed one resolves to nothing rather than to a default.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A FEE IS NOT KEYED BY CARD, AND PRETENDING OTHERWISE IS THE WHOLE RISK
 *
 * `fees` rows carry `issuerOrgId`, `operatingCardCompanyId` and a `scopeKind`, and 828 of 1090 are
 * `ALL_CARDS_OF_OPERATOR_AT_ISSUER` — a scope this layer can resolve EXACTLY from a product's own
 * two ids. 207 are `NAMED_CARD_OR_LEVEL`, whose `cardLevels` are display labels ("Blue", "Gold")
 * that no field on a card row matches; joining those would mean matching a fee to a card by its
 * NAME, which is precisely what the directive forbids. Those rows are counted and reported as
 * unbound rather than attached to a plausible-looking product.
 *
 * The one card-name join that IS performed is the estate's OWN: the 14 `exceptions` rows carry
 * `matchSemantics: CASE_INSENSITIVE_SUBSTRING_OF_CARD_NAME_LONGEST_RULE_WINS` and an explicit
 * `matchPrecedence`. That is a rule the pipeline published, with the tie-break stated, so applying
 * it is following the estate rather than inventing a heuristic.
 */
import { openVerifiedCatalog } from './catalogSearch';

/** A shipping organisation: a bank or a card company. */
export interface CatalogIssuer {
  readonly orgId: string;
  readonly slug: string;
  readonly kind: 'BANK' | 'CARD_COMPANY';
  readonly nameHe?: string;
  readonly nameEn?: string;
  readonly nameAr?: string;
  /** The entity that legally issues this org's cards, where the estate distinguishes them. */
  readonly issuingEntityOrgId?: string;
  readonly lifecycleStatus: string;
  /** The estate's own warning about joining this org with another. Never paraphrased. */
  readonly joinCaveat?: string;
}

export interface CatalogNetwork {
  readonly networkId: string;
  readonly slug: string;
  readonly nameHe?: string;
  readonly nameEn?: string;
}

/** One canonical card product, with both identity keys and no invented tier. */
export interface CatalogProduct {
  readonly cardId: string;
  readonly issuerOrgId: string;
  readonly operatingCardCompanyId?: string;
  readonly nameHe?: string;
  readonly nameEn?: string;
  readonly nameAr?: string;
  /** The estate's own product classification, verbatim. Not a tier. */
  readonly productType?: string;
  /** The `networks` ids `networkRaw` resolves to. Empty when the estate did not confirm one. */
  readonly networkIds: readonly string[];
  /** The raw string, kept so a surface can show what the estate actually wrote. */
  readonly networkRaw?: string;
  readonly benefitCoverageStatus?: string;
  readonly benefitCountDirect: number;
  readonly benefitCountInherited: number;
}

/** A club or programme a product can be attached to, and how. */
export interface CatalogProgramme {
  readonly nodeId: string;
  readonly orgId: string;
  readonly kind: string;
  readonly displayName: string;
}

export interface ProductProgrammeLink {
  readonly programme: CatalogProgramme;
  /** The estate's word for how the card reaches the programme. Never widened to "eligible". */
  readonly attachmentBasis?: string;
}

type Row = Readonly<Record<string, unknown>>;

const text = (row: Row, key: string): string | undefined => {
  const value = row[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
};

const num = (row: Row, key: string): number => {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

/**
 * `networkRaw` → canonical `net:*` ids.
 *
 * Every spelling in the shipped pack is listed. A spelling that is not here resolves to NO
 * network, which is the honest outcome for a string nobody has classified — and `UNKNOWN`,
 * `NOT_CONFIRMED` and `MULTI_NETWORK_SEE_VARIANTS` are listed explicitly as resolving to nothing
 * so that a reader can see they were considered rather than missed.
 */
const NETWORK_IDS: Readonly<Record<string, readonly string[]>> = {
  VISA: ['net:visa'],
  Visa: ['net:visa'],
  MASTERCARD: ['net:mastercard'],
  Mastercard: ['net:mastercard'],
  'Mastercard (partially confirmed)': ['net:mastercard'],
  AMERICAN_EXPRESS: ['net:amex'],
  'American Express': ['net:amex'],
  AMEX: ['net:amex'],
  DINERS: ['net:diners'],
  Diners: ['net:diners'],
  'Diners Club': ['net:diners'],
  ISRACARD_LOCAL: ['net:isracard-local'],
  'Mastercard, Visa': ['net:mastercard', 'net:visa'],
  'Visa, Mastercard': ['net:visa', 'net:mastercard'],
  'VISA, MASTERCARD': ['net:visa', 'net:mastercard'],
  'Diners, Mastercard': ['net:diners', 'net:mastercard'],
  'Mastercard, Diners': ['net:mastercard', 'net:diners'],
  /* Considered and resolving to nothing. An unconfirmed network is not a network. */
  UNKNOWN: [],
  NOT_CONFIRMED: [],
  MULTI_NETWORK_SEE_VARIANTS: [],
};

export function networkIdsFor(networkRaw: string | undefined): readonly string[] {
  if (networkRaw === undefined) return [];
  return NETWORK_IDS[networkRaw] ?? [];
}

interface CatalogIndex {
  readonly issuers: readonly CatalogIssuer[];
  readonly networks: readonly CatalogNetwork[];
  readonly products: readonly CatalogProduct[];
  readonly programmesByCardId: ReadonlyMap<string, readonly ProductProgrammeLink[]>;
  readonly productById: ReadonlyMap<string, CatalogProduct>;
  readonly issuerByOrgId: ReadonlyMap<string, CatalogIssuer>;
  readonly networkById: ReadonlyMap<string, CatalogNetwork>;
  readonly feeRows: readonly Row[];
  readonly waiverRows: readonly Row[];
  readonly exceptionRows: readonly Row[];
  readonly interestRows: readonly Row[];
}

let indexMemo: CatalogIndex | null = null;

/**
 * Build the index once, on first use.
 *
 * The catalog pack is the largest the app ships. Building this at import time would put it on the
 * critical path of every render suite that mounts any screen; building it once on first ask keeps
 * the "one join" property without that cost.
 */
function catalogIndex(): CatalogIndex {
  if (indexMemo !== null) return indexMemo;
  const units = openVerifiedCatalog();

  const issuers: CatalogIssuer[] = [];
  for (const row of units['issuers'] ?? []) {
    const orgId = text(row, 'orgId');
    const slug = text(row, 'slug');
    const kind = text(row, 'kind');
    if (orgId === undefined || slug === undefined) continue;
    if (row['shipToApp'] !== true) continue;
    if (kind !== 'BANK' && kind !== 'CARD_COMPANY') continue;
    issuers.push({
      orgId,
      slug,
      kind,
      lifecycleStatus: text(row, 'lifecycleStatus') ?? 'UNKNOWN',
      ...(text(row, 'nameHe') === undefined ? {} : { nameHe: text(row, 'nameHe') as string }),
      ...(text(row, 'nameEn') === undefined ? {} : { nameEn: text(row, 'nameEn') as string }),
      ...(text(row, 'nameAr') === undefined ? {} : { nameAr: text(row, 'nameAr') as string }),
      ...(text(row, 'issuingEntityOrgId') === undefined
        ? {}
        : { issuingEntityOrgId: text(row, 'issuingEntityOrgId') as string }),
      ...(text(row, 'joinCaveat') === undefined
        ? {}
        : { joinCaveat: text(row, 'joinCaveat') as string }),
    });
  }

  const networks: CatalogNetwork[] = [];
  for (const row of units['networks'] ?? []) {
    const networkId = text(row, 'networkId');
    const slug = text(row, 'slug');
    if (networkId === undefined || slug === undefined) continue;
    if (row['shipToApp'] !== true) continue;
    networks.push({
      networkId,
      slug,
      ...(text(row, 'nameHe') === undefined ? {} : { nameHe: text(row, 'nameHe') as string }),
      ...(text(row, 'nameEn') === undefined ? {} : { nameEn: text(row, 'nameEn') as string }),
    });
  }

  const products: CatalogProduct[] = [];
  for (const row of units['cards'] ?? []) {
    /* CURRENT and selectable only. A RETIRED product is not something a user can be holding for
       the first time, and `TARIFF_ONLY_NOT_PROVEN_CURRENT` is the estate saying it found a price
       and not a product. */
    if (row['lifecycleStatus'] !== 'CURRENT') continue;
    if (row['isSelectable'] !== true) continue;
    const cardId = text(row, 'cardId');
    const issuerOrgId = text(row, 'issuerOrgId');
    if (cardId === undefined || issuerOrgId === undefined) continue;
    const networkRaw = text(row, 'networkRaw');
    products.push({
      cardId,
      issuerOrgId,
      networkIds: networkIdsFor(networkRaw),
      benefitCountDirect: num(row, 'benefitCountDirect'),
      benefitCountInherited: num(row, 'benefitCountInherited'),
      ...(text(row, 'operatingCardCompanyId') === undefined
        ? {}
        : { operatingCardCompanyId: text(row, 'operatingCardCompanyId') as string }),
      ...(text(row, 'nameHe') === undefined ? {} : { nameHe: text(row, 'nameHe') as string }),
      ...(text(row, 'nameEn') === undefined ? {} : { nameEn: text(row, 'nameEn') as string }),
      ...(text(row, 'nameAr') === undefined ? {} : { nameAr: text(row, 'nameAr') as string }),
      ...(text(row, 'productType') === undefined
        ? {}
        : { productType: text(row, 'productType') as string }),
      ...(networkRaw === undefined ? {} : { networkRaw }),
      ...(text(row, 'benefitCoverageStatus') === undefined
        ? {}
        : { benefitCoverageStatus: text(row, 'benefitCoverageStatus') as string }),
    });
  }

  /* Clubs and programmes are two units of one vocabulary: an edge names either by nodeId. */
  const nodeById = new Map<string, CatalogProgramme>();
  for (const unit of ['clubs', 'programmes'] as const) {
    for (const row of units[unit] ?? []) {
      if (row['shipToApp'] !== true) continue;
      if (row['lifecycleStatus'] !== 'CURRENT') continue;
      const nodeId = text(row, 'nodeId');
      const orgId = text(row, 'orgId');
      const displayName = text(row, 'displayName');
      if (nodeId === undefined || orgId === undefined || displayName === undefined) continue;
      nodeById.set(nodeId, {
        nodeId,
        orgId,
        displayName,
        kind: text(row, 'kind') ?? 'UNKNOWN',
      });
    }
  }

  const programmesByCardId = new Map<string, ProductProgrammeLink[]>();
  for (const row of units['edges'] ?? []) {
    if (row['shipToApp'] !== true) continue;
    if (text(row, 'type') !== 'CARD_ATTACHED_TO_PROGRAMME') continue;
    const from = text(row, 'fromNodeId');
    const to = text(row, 'toNodeId');
    if (from === undefined || to === undefined) continue;
    const programme = nodeById.get(to);
    if (programme === undefined) continue;
    const basis = text(row, 'attachmentBasis');
    const list = programmesByCardId.get(from) ?? [];
    list.push({ programme, ...(basis === undefined ? {} : { attachmentBasis: basis }) });
    programmesByCardId.set(from, list);
  }

  indexMemo = {
    issuers,
    networks,
    products,
    programmesByCardId,
    productById: new Map(products.map((p) => [p.cardId, p] as const)),
    issuerByOrgId: new Map(issuers.map((i) => [i.orgId, i] as const)),
    networkById: new Map(networks.map((n) => [n.networkId, n] as const)),
    feeRows: (units['fees'] ?? []).filter((r) => r['shipToApp'] !== false),
    waiverRows: (units['waivers'] ?? []).filter((r) => r['shipToApp'] !== false),
    exceptionRows: (units['exceptions'] ?? []).filter((r) => r['shipToApp'] !== false),
    interestRows: units['interest'] ?? [],
  };
  return indexMemo;
}

// ── Identity queries ──────────────────────────────────────────────────────────────────────────

/** Every shipping organisation of a kind that currently has at least one selectable product. */
function issuersWithProducts(kind: CatalogIssuer['kind']): readonly CatalogIssuer[] {
  const index = catalogIndex();
  const withProducts = new Set(index.products.map((p) => p.issuerOrgId));
  return index.issuers
    .filter((i) => i.kind === kind && withProducts.has(i.orgId))
    .sort((a, b) => a.orgId.localeCompare(b.orgId, 'en'));
}

/**
 * Banks the add-card flow may offer.
 *
 * DERIVED, NEVER LISTED. A hardcoded bank list is a second home for a fact the catalog owns, and
 * the first thing it would do is keep offering a bank whose products were retired.
 */
export function availableBanks(): readonly CatalogIssuer[] {
  return issuersWithProducts('BANK');
}

/** Card companies the add-card flow may offer, derived the same way. */
export function availableCardCompanies(): readonly CatalogIssuer[] {
  return issuersWithProducts('CARD_COMPANY');
}

export function issuerByOrgId(orgId: string): CatalogIssuer | undefined {
  return catalogIndex().issuerByOrgId.get(orgId);
}

export function networkByIdCatalog(networkId: string): CatalogNetwork | undefined {
  return catalogIndex().networkById.get(networkId);
}

export function allCatalogNetworks(): readonly CatalogNetwork[] {
  return catalogIndex().networks;
}

/** Every selectable CURRENT product, in the pack's canonical order. */
export function allCatalogProducts(): readonly CatalogProduct[] {
  return catalogIndex().products;
}

export function catalogProductById(cardId: string): CatalogProduct | undefined {
  return catalogIndex().productById.get(cardId);
}

/**
 * The products of ONE issuer.
 *
 * Filtered on `issuerOrgId` — whose card it is — and never on the operator, because a Bank Leumi
 * card operated by CAL is Leumi's product and not CAL's. Offering it under CAL would tell the user
 * their bank card belongs to a card company.
 */
export function cardProductsForIssuer(orgId: string): readonly CatalogProduct[] {
  return catalogIndex().products.filter((p) => p.issuerOrgId === orgId);
}

/**
 * The programmes a product is EVIDENCED to attach to, with the estate's own attachment basis.
 *
 * Empty for the 306 of 378 current products that carry no programme edge — which is an absence of
 * evidence, not evidence that the product has no club, and the surface says so. Nothing is
 * inferred from a similar display name.
 */
export function compatibleProgrammesForProduct(cardId: string): readonly ProductProgrammeLink[] {
  return catalogIndex().programmesByCardId.get(cardId) ?? [];
}

/** Text search within one issuer's products, over every published name. */
export function searchProductsForIssuer(
  orgId: string,
  query: string,
): readonly CatalogProduct[] {
  const needle = query.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
  const pool = cardProductsForIssuer(orgId);
  if (needle === '') return pool;
  return pool.filter((p) =>
    [p.cardId, p.nameHe, p.nameEn, p.nameAr]
      .filter((part): part is string => typeof part === 'string')
      .some((part) => part.toLowerCase().normalize('NFC').includes(needle)),
  );
}

/** The product's name in the reader's language, falling back to a name somebody published. */
export function productDisplayName(
  product: CatalogProduct,
  language: 'he' | 'ar' | 'en',
): string {
  if (language === 'ar') return product.nameAr ?? product.nameEn ?? product.nameHe ?? product.cardId;
  if (language === 'en') return product.nameEn ?? product.nameHe ?? product.cardId;
  return product.nameHe ?? product.nameEn ?? product.cardId;
}

/** An organisation's name in the reader's language. */
export function issuerDisplayName(
  issuer: CatalogIssuer,
  language: 'he' | 'ar' | 'en',
): string {
  if (language === 'ar') return issuer.nameAr ?? issuer.nameEn ?? issuer.nameHe ?? issuer.orgId;
  if (language === 'en') return issuer.nameEn ?? issuer.nameHe ?? issuer.orgId;
  return issuer.nameHe ?? issuer.nameEn ?? issuer.orgId;
}

/** Raw fee, waiver, exception and interest rows, for the fee profile module. Not a public surface. */
export function catalogFeeRows(): readonly Row[] {
  return catalogIndex().feeRows;
}
export function catalogWaiverRows(): readonly Row[] {
  return catalogIndex().waiverRows;
}
export function catalogExceptionRows(): readonly Row[] {
  return catalogIndex().exceptionRows;
}
export function catalogInterestRows(): readonly Row[] {
  return catalogIndex().interestRows;
}
