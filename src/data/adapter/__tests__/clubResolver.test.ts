/**
 * W3 — three-question club resolver. Identifies a derived catalog club, or ends unknown.
 */
import {
  clubInstitutions,
  currentCatalogClubs,
  remainingClubsAfter,
  resolveClub,
} from '../clubResolver';

describe("W3 — I don't know my club three-question resolver", () => {
  it('the club population is derived from the shipped catalog, not listed by hand', () => {
    const clubs = currentCatalogClubs();
    const orgs = clubInstitutions();
    expect(clubs.length).toBeGreaterThan(0);
    expect(orgs.length).toBeGreaterThan(1);
    expect(new Set(clubs.map(c => c.nodeId)).size).toBe(clubs.length);
    expect(new Set(clubs.map(c => c.orgId))).toEqual(new Set(orgs));
    // eslint-disable-next-line no-console
    console.log(`derived ${clubs.length} CURRENT clubs across ${orgs.length} institutions`);
  });

  it('three answers that uniquely pick a remaining club identify it', () => {
    const club = currentCatalogClubs()[0];
    if (club === undefined) throw new Error('no CURRENT clubs');
    const token = club.displayName.trim().split(/\s+/)[0] ?? club.displayName;
    const remaining = remainingClubsAfter(club.orgId, token);
    expect(remaining.some(c => c.nodeId === club.nodeId)).toBe(true);
    const resolution = resolveClub({
      q1InstitutionOrgId: club.orgId,
      q2NameQuery: token,
      q3ClubNodeId: club.nodeId,
    });
    expect(resolution.outcome).toBe('identified');
    if (resolution.outcome === 'identified') {
      expect(resolution.club.nodeId).toBe(club.nodeId);
    }
  });

  it('unsure, unsure, none ends honestly without a club', () => {
    const resolution = resolveClub({
      q1InstitutionOrgId: 'unsure',
      q2NameQuery: 'unsure',
      q3ClubNodeId: 'none',
    });
    expect(resolution).toEqual({ outcome: 'unknown' });
  });

  it('a club id that is not in the remaining set is refused rather than invented', () => {
    const clubs = currentCatalogClubs();
    const first = clubs[0];
    const second = clubs.find(c => c.orgId !== first?.orgId);
    if (first === undefined || second === undefined) {
      throw new Error('need two clubs on different institutions');
    }
    const resolution = resolveClub({
      q1InstitutionOrgId: first.orgId,
      q2NameQuery: 'unsure',
      q3ClubNodeId: second.nodeId,
    });
    expect(resolution).toEqual({ outcome: 'unknown' });
  });
});
