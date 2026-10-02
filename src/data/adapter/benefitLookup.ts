/**
 * This lookup lives in data because engines may import from src/data while B1 forbids a surface
 * from value-importing src/engines, making data the only place both callers can read from. Clubs
 * are keyed by card.displayName; that is the existing convention, not a new one. Sharing it here
 * prevents an issuer-key rename from desynchronising the engine and Card DNA.
 */
import { CardIssuer } from '../../types/card.types';
import type { BenefitsClub, BenefitsDB } from '../../types/benefits.types';

export const ISSUER_DATABASE_KEYS: Readonly<Record<CardIssuer, string>> = {
  [CardIssuer.Max]: 'Max',
  [CardIssuer.Isracard]: 'Isracard',
  [CardIssuer.Cal]: 'CAL',
};

type BenefitLookupCard = Readonly<{
  issuer: CardIssuer;
  displayName: string;
}>;

export function clubForCard(
  card: BenefitLookupCard,
  db: BenefitsDB,
): BenefitsClub | undefined {
  const issuer = db.issuers[ISSUER_DATABASE_KEYS[card.issuer]];
  return issuer?.clubs[card.displayName];
}
