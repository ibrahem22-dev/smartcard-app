/**
 * W3 — "I don't know my club" resolver. Population is derived from the shipped catalog
 * clubs unit (CURRENT + shipToApp). Three answers either identify one club or end as unknown.
 * The resolver never invents a club the user did not pick from the remaining set.
 */
import catalogJson from './packs/catalog/pack.json';

type Row = Readonly<Record<string, unknown>>;

const pack = catalogJson as {
  readonly units: Readonly<Record<string, readonly Row[]>>;
};

export type CatalogClub = {
  readonly nodeId: string;
  readonly orgId: string;
  readonly displayName: string;
};

const asText = (row: Row, key: string): string | undefined => {
  const value = row[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
};

const CURRENT_CLUBS: readonly CatalogClub[] = (pack.units['clubs'] ?? [])
  .filter(row => row['lifecycleStatus'] === 'CURRENT' && row['shipToApp'] === true)
  .map(row => {
    const nodeId = asText(row, 'nodeId');
    const orgId = asText(row, 'orgId');
    const displayName = asText(row, 'displayName');
    if (nodeId === undefined || orgId === undefined || displayName === undefined) return null;
    return { nodeId, orgId, displayName };
  })
  .filter((club): club is CatalogClub => club !== null);

export type ClubAnswers = {
  readonly q1InstitutionOrgId: string | 'unsure';
  readonly q2NameQuery: string | 'unsure';
  readonly q3ClubNodeId: string | 'none';
};

export type ClubResolution =
  | { readonly outcome: 'identified'; readonly club: CatalogClub }
  | { readonly outcome: 'unknown' };

const normalize = (value: string): string =>
  value.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();

export function currentCatalogClubs(): readonly CatalogClub[] {
  return CURRENT_CLUBS;
}

export function clubInstitutions(): readonly string[] {
  return [...new Set(CURRENT_CLUBS.map(club => club.orgId))].sort();
}

export function remainingClubsAfter(
  q1InstitutionOrgId: string | 'unsure',
  q2NameQuery: string | 'unsure',
): readonly CatalogClub[] {
  let remaining = CURRENT_CLUBS;
  if (q1InstitutionOrgId !== 'unsure') {
    remaining = remaining.filter(club => club.orgId === q1InstitutionOrgId);
  }
  if (q2NameQuery !== 'unsure') {
    const needle = normalize(q2NameQuery);
    if (needle !== '') {
      remaining = remaining.filter(club => normalize(club.displayName).includes(needle));
    }
  }
  return remaining;
}

export function resolveClub(answers: ClubAnswers): ClubResolution {
  const remaining = remainingClubsAfter(answers.q1InstitutionOrgId, answers.q2NameQuery);
  if (answers.q3ClubNodeId === 'none') return { outcome: 'unknown' };
  const picked = remaining.find(club => club.nodeId === answers.q3ClubNodeId);
  if (picked === undefined) return { outcome: 'unknown' };
  return { outcome: 'identified', club: picked };
}
