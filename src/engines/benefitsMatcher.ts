import { CardIssuer, type CardInput } from '../types/card.types';
import type {
  Benefit,
  BenefitMatch,
  BenefitsClub,
  BenefitsDB,
  MissedSavingRow,
  MissedSavings,
  Transaction,
} from '../types/benefits.types';
import type { PurchaseInput } from '../types/purchase.types';

const ISSUER_DATABASE_KEYS: Readonly<Record<CardIssuer, string>> = {
  [CardIssuer.Max]: 'Max',
  [CardIssuer.Isracard]: 'Isracard',
  [CardIssuer.Cal]: 'CAL',
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateSaving(amount: number, benefit: Benefit): number {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isFinite(benefit.value) ||
    benefit.value <= 0
  ) {
    return 0;
  }

  return roundCurrency(amount * (benefit.value / 100));
}

function getCardClub(
  card: CardInput,
  benefitsDB: BenefitsDB,
): BenefitsClub | undefined {
  const issuer = benefitsDB.issuers[ISSUER_DATABASE_KEYS[card.issuer]];
  return issuer?.clubs[card.displayName];
}

function isBenefitEligible(
  benefit: Benefit,
  purchase: PurchaseInput,
): boolean {
  return (
    benefit.category === purchase.category &&
    (!benefit.isInternationalOnly || purchase.isInternational)
  );
}

export function findBestCard(
  cards: readonly CardInput[],
  purchase: PurchaseInput,
  benefitsDB: BenefitsDB,
): BenefitMatch[] {
  if (
    cards.length === 0 ||
    !Number.isFinite(purchase.amount) ||
    purchase.amount <= 0
  ) {
    return [];
  }

  const matches: BenefitMatch[] = [];

  cards.forEach((card: CardInput): void => {
    if (!card.isActive) {
      return;
    }

    const club = getCardClub(card, benefitsDB);
    if (club === undefined) {
      return;
    }

    let bestMatch: BenefitMatch | null = null;

    club.benefits.forEach((benefit: Benefit): void => {
      if (!isBenefitEligible(benefit, purchase)) {
        return;
      }

      const candidate: BenefitMatch = {
        card,
        benefit,
        estimatedSaving: calculateSaving(purchase.amount, benefit),
      };

      if (
        bestMatch === null ||
        candidate.estimatedSaving > bestMatch.estimatedSaving ||
        (candidate.estimatedSaving === bestMatch.estimatedSaving &&
          candidate.benefit.value > bestMatch.benefit.value)
      ) {
        bestMatch = candidate;
      }
    });

    if (bestMatch !== null) {
      matches.push(bestMatch);
    }
  });

  return matches.sort(
    (left: BenefitMatch, right: BenefitMatch): number =>
      right.estimatedSaving - left.estimatedSaving ||
      right.benefit.value - left.benefit.value,
  );
}

export function calculateMissedSavings(
  cards: readonly CardInput[],
  transactions: readonly Transaction[],
  benefitsDB: BenefitsDB,
): MissedSavings {
  const breakdown: MissedSavingRow[] = [];

  transactions.forEach((transaction: Transaction): void => {
    const matches = findBestCard(cards, transaction, benefitsDB);
    const bestAlternative = matches.find(
      (match: BenefitMatch): boolean =>
        match.card.cardId !== transaction.cardId,
    );

    if (bestAlternative === undefined) {
      return;
    }

    const usedCardSaving =
      matches.find(
        (match: BenefitMatch): boolean =>
          match.card.cardId === transaction.cardId,
      )?.estimatedSaving ?? 0;
    const missedAmount = roundCurrency(
      bestAlternative.estimatedSaving - usedCardSaving,
    );

    if (missedAmount <= 0) {
      return;
    }

    breakdown.push({
      transaction,
      bestCard: bestAlternative.card,
      missedAmount,
    });
  });

  return {
    totalMissed: roundCurrency(
      breakdown.reduce(
        (total: number, row: MissedSavingRow): number =>
          total + row.missedAmount,
        0,
      ),
    ),
    breakdown,
  };
}
