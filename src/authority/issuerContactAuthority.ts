/**
 * ISSUER CONTACT AUTHORITY — the one door outside `src/data/adapter/**` to issuer contact facts.
 *
 * The Negotiation Hub reads this and nothing else. Every digit behind it came off an issuer's own
 * page with the URL, the date, the verbatim quote and the verification status attached; no number
 * is typed into a screen anywhere in this app.
 */
export {
  allIssuerContacts,
  issuerContactByOrgId,
  negotiationContactFor,
  ISSUER_ORG_IDS,
  type IssuerChannel,
  type IssuerContactRow,
  type IssuerNegotiationContact,
} from '../data/adapter/issuerContacts';
