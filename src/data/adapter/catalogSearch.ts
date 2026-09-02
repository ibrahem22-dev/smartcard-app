/**
 * W2 catalog search population — derived from the shipped catalog pack.
 *
 * This file sits inside `data/adapter/**` because D2 forbids any other directory from importing a
 * pack file. The wizard asks this module; it never opens pack.json itself.
 *
 * CURRENT is `lifecycleStatus === 'CURRENT'`, which is the adapter's published
 * `countsAsCurrentProduct` rule (CardsAdapter.read-cards). The unit suite cross-checks the derived
 * length against `CardsAdapter.countCurrentProducts()` so this module does not have to import the
 * adapter package — a screen that imported that package could not mount in the render harness.
 */
import catalogJson from './packs/catalog/pack.json';
import type { PackConflict } from './conflictRender';

type Row = Readonly<Record<string, unknown>>;

const pack = catalogJson as {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly conflicts: readonly PackConflict[];
  readonly units: Readonly<Record<string, readonly Row[]>>;
};

export type CatalogProductHit = {
  readonly cardId: string;
  readonly issuerOrgId: string;
  readonly operatingCardCompanyId?: string;
  readonly nameHe?: string;
  readonly nameEn?: string;
  readonly nameAr?: string;
};

export type CatalogInstitution = {
  readonly orgId: string;
  readonly nameHe?: string;
  readonly nameEn?: string;
  readonly nameAr?: string;
};

const asText = (row: Row, key: string): string | undefined => {
  const value = row[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
};

const isCurrentRow = (row: Row): boolean => row['lifecycleStatus'] === 'CURRENT';

const hitFromRow = (row: Row): CatalogProductHit | null => {
  if (!isCurrentRow(row)) return null;
  const cardId = asText(row, 'cardId');
  const issuerOrgId = asText(row, 'issuerOrgId');
  if (cardId === undefined || issuerOrgId === undefined) return null;
  const operatingCardCompanyId = asText(row, 'operatingCardCompanyId');
  const nameHe = asText(row, 'nameHe');
  const nameEn = asText(row, 'nameEn');
  const nameAr = asText(row, 'nameAr');
  return {
    cardId,
    issuerOrgId,
    ...(operatingCardCompanyId === undefined ? {} : { operatingCardCompanyId }),
    ...(nameHe === undefined ? {} : { nameHe }),
    ...(nameEn === undefined ? {} : { nameEn }),
    ...(nameAr === undefined ? {} : { nameAr }),
  };
};

const CURRENT: readonly CatalogProductHit[] = (pack.units['cards'] ?? [])
  .map(hitFromRow)
  .filter((hit): hit is CatalogProductHit => hit !== null);

const issuerRows = pack.units['issuers'] ?? [];

const institutionOf = (orgId: string): CatalogInstitution => {
  const row = issuerRows.find(r => asText(r, 'orgId') === orgId);
  if (row === undefined) return { orgId };
  const nameHe = asText(row, 'nameHe');
  const nameEn = asText(row, 'nameEn');
  const nameAr = asText(row, 'nameAr');
  return {
    orgId,
    ...(nameHe === undefined ? {} : { nameHe }),
    ...(nameEn === undefined ? {} : { nameEn }),
    ...(nameAr === undefined ? {} : { nameAr }),
  };
};

const INSTITUTIONS: readonly CatalogInstitution[] = [
  ...new Set(CURRENT.map(product => product.issuerOrgId)),
]
  .sort()
  .map(institutionOf);

const normalize = (value: string): string =>
  value.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();

export function catalogPackIdentity(): {
  readonly datasetId: string;
  readonly datasetVersion: string;
} {
  return { datasetId: pack.datasetId, datasetVersion: pack.datasetVersion };
}

export function catalogCardRows(): readonly Row[] {
  return pack.units['cards'] ?? [];
}

/** Shipped conflicts stay behind the catalog adapter instead of exposing the raw pack JSON. */
export function shippedCatalogConflicts(): readonly PackConflict[] {
  return pack.conflicts;
}

export function currentCatalogProducts(): readonly CatalogProductHit[] {
  return CURRENT;
}

export function currentCatalogInstitutions(): readonly CatalogInstitution[] {
  return INSTITUTIONS;
}

export function searchCatalog(
  query: string,
  scope?: { readonly issuerOrgId?: string },
): readonly CatalogProductHit[] {
  const needle = normalize(query);
  const pool =
    scope?.issuerOrgId === undefined
      ? CURRENT
      : CURRENT.filter(product => product.issuerOrgId === scope.issuerOrgId);
  if (needle === '') return [];
  return pool.filter(product => {
    const haystack = [product.cardId, product.nameHe, product.nameEn, product.nameAr]
      .filter((part): part is string => typeof part === 'string')
      .map(normalize)
      .join('\n');
    return haystack.includes(needle);
  });
}

export function catalogDisplayName(hit: CatalogProductHit): string {
  return hit.nameHe ?? hit.nameEn ?? hit.nameAr ?? hit.cardId;
}

export function isCurrentCatalogProduct(cardId: string): boolean {
  return CURRENT.some(product => product.cardId === cardId);
}

export const GENERIC_CATALOG_PATH = 'generic:manual';
