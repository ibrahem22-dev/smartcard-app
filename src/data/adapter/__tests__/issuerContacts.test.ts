/**
 * THE NEGOTIATION HUB'S CONTACT FACTS, MEASURED AGAINST THE SHIPPED CONTENT PACK.
 *
 * Two things are asserted here that a looser suite would leave out.
 *
 * FIRST, the numbers themselves, by value. A contact surface is one of the few places in this app
 * where being wrong costs the user a phone call to a stranger, so the digits are pinned to what
 * the estate captured from each issuer's own page on 2026-08-19.
 *
 * SECOND, the three Owner-supplied CANDIDATES are asserted ABSENT. `*6969`, `*4554` and `*6464`
 * were supplied as candidate facts and the campaign directive required verification before any of
 * them shipped. They are not in the corpus and they are not in the app; this case is what keeps
 * them out, and what will fail loudly if one is ever pasted in without a source.
 */
import { CardIssuer } from '../../../types/card.types';
import {
  allIssuerContacts,
  issuerContactByOrgId,
  negotiationContactFor,
  ISSUER_ORG_IDS,
} from '../issuerContacts';

describe('issuer contacts', () => {
  it('reads the eighteen contact rows the shipped content pack holds', () => {
    expect(allIssuerContacts().length).toBe(18);
  });

  it('maps every card issuer this app models to a canonical organisation row', () => {
    for (const issuer of Object.values(CardIssuer)) {
      const orgId = ISSUER_ORG_IDS[issuer];
      expect(orgId.startsWith('org:')).toBe(true);
      expect(issuerContactByOrgId(orgId)).toBeDefined();
    }
  });

  it('derives max’s verified phone and WhatsApp channels from the pack sentence', () => {
    const contact = negotiationContactFor('org:max');
    expect(contact?.phone?.display).toBe('03-6178888');
    expect(contact?.phone?.uri).toBe('tel:03-6178888');
    expect(contact?.whatsapp?.display).toBe('054-5408881');
    expect(contact?.whatsapp?.uri).toBe('https://wa.me/972545408881');
    expect(contact?.verificationStatus).toBe('VERIFIED_OFFICIAL');
    expect(contact?.sourceUrl).toBe('https://www.max.co.il/contactus');
    expect(contact?.absence).toBeUndefined();
  });

  it('derives CAL’s verified phone and WhatsApp channels', () => {
    const contact = negotiationContactFor('org:cal');
    expect(contact?.phone?.display).toBe('03-5726444');
    expect(contact?.whatsapp?.display).toBe('03-5725111');
    expect(contact?.verificationStatus).toBe('VERIFIED_OFFICIAL');
  });

  it('derives Isracard’s verified star-code phone and offers no WhatsApp for it', () => {
    const contact = negotiationContactFor('org:isracard');
    expect(contact?.phone?.display).toBe('*6272');
    /* RFC 3966 keeps the star: dialling 6272 would not reach the issuer. */
    expect(contact?.phone?.uri).toBe('tel:*6272');
    /* A star code has no international form, so it yields no WhatsApp rather than a fabricated one. */
    expect(contact?.whatsapp).toBeUndefined();
  });

  it('does NOT carry the three unverified candidate numbers the directive supplied', () => {
    const everything = JSON.stringify(allIssuerContacts());
    for (const candidate of ['*6969', '*4554', '*6464']) {
      expect(everything).not.toContain(candidate);
    }
    for (const orgId of ['org:max', 'org:cal', 'org:isracard']) {
      const contact = negotiationContactFor(orgId);
      expect(['*6969', '*4554', '*6464']).not.toContain(contact?.phone?.display);
    }
  });

  it('carries the evidence beside every number it exposes', () => {
    for (const orgId of Object.values(ISSUER_ORG_IDS)) {
      const contact = negotiationContactFor(orgId);
      if (contact?.phone === undefined) continue;
      expect(contact.verificationStatus).toBeDefined();
      expect(contact.accessedAt).toBeDefined();
      expect(contact.sourceUrl).toBeDefined();
      /* The channel names the sentence it was read out of, not just the digits. */
      expect(contact.phone.raw).toContain(contact.phone.display);
    }
  });

  it('reports an organisation with no published service number as an absence with a reason', () => {
    /* org:union is HISTORICAL: the estate records that the channel is gone, and an absence must
       never read as "nobody looked". */
    const contact = negotiationContactFor('org:union');
    expect(contact).toBeDefined();
    expect(contact?.phone).toBeUndefined();
    expect(contact?.absence).toBe('NO_PUBLISHED_VALUE');
  });

  it('reads an organisation the corpus does not hold as undefined', () => {
    expect(negotiationContactFor('org:not-a-real-issuer')).toBeUndefined();
  });

  it('builds only tel: and https://wa.me/ URIs, and never a bare number', () => {
    for (const row of allIssuerContacts()) {
      const contact = negotiationContactFor(row.orgId);
      if (contact?.phone !== undefined) expect(contact.phone.uri.startsWith('tel:')).toBe(true);
      if (contact?.whatsapp !== undefined) {
        expect(contact.whatsapp.uri.startsWith('https://wa.me/')).toBe(true);
        expect(/^https:\/\/wa\.me\/\d{9,15}$/.test(contact.whatsapp.uri)).toBe(true);
      }
    }
  });
});
