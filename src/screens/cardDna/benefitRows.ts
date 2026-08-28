import { CardIssuer, type EngineCard } from '../../types/card.types';
import type { BenefitsDB } from '../../types/benefits.types';

export type BenefitSource = 'card' | 'club';

export interface BenefitRow {
  readonly id: string;
  readonly source: BenefitSource;
  readonly category: string;
  readonly kind: 'cashback' | 'discount';
  readonly valuePercent: number;
  readonly description: string;
  readonly internationalOnly: boolean;
}

const ISSUER_DATABASE_KEYS: Readonly<Record<CardIssuer, string>> = {
  [CardIssuer.Max]: 'Max',
  [CardIssuer.Isracard]: 'Isracard',
  [CardIssuer.Cal]: 'CAL',
};

function rowId(cardId: string, index: number): string {
  const safeCardId = cardId.replace(/[^a-zA-Z0-9_-]+/g, '-');
  return `${safeCardId}-${index}`;
}

export function benefitRowsFor(
  card: EngineCard | undefined,
  db: BenefitsDB,
): readonly BenefitRow[] {
  if (card === undefined) return [];

  const issuer = db.issuers[ISSUER_DATABASE_KEYS[card.issuer]];
  const club = issuer?.clubs[card.displayName];
  if (club === undefined) return [];

  // BenefitsDB exposes benefits only beneath clubs. It has no card-product benefit path, so every
  // benefit this derivation can actually reach is truthfully tagged as a club benefit.
  return club.benefits.map((benefit, index) => ({
    id: rowId(card.cardId, index),
    source: 'club',
    category: benefit.category,
    kind: benefit.type,
    valuePercent: benefit.value,
    description: benefit.description,
    internationalOnly: benefit.isInternationalOnly,
  }));
}
