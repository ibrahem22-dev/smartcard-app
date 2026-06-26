import {
  CardRole,
  type CardInput,
  type CardRecommendation,
} from '../types/card.types';
import { PurchaseCategory } from '../types/purchase.types';
import type { UserProfile } from '../types/user.types';

const UNKNOWN_CLUB_REASON_HE = 'מועדון לא ידוע — ייתכן הטבות נוספות';
const UNKNOWN_CLUB_REASON_AR = 'المועدون غير معروف — قد تتوفر مزايا إضافية';
const DEFAULT_REASON_HE = 'הכרטיס מתאים לרכישה זו';
const DEFAULT_REASON_AR = 'البطاقة مناسبة لهذا الشراء';

const INVALID_CARD_SCORE = -Infinity;

function isValidRateFraction(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function hasSingleRoleTag(card: CardInput): CardRole | null {
  if (card.roleTags.length !== 1) {
    return null;
  }

  const [onlyTag] = card.roleTags;
  return onlyTag ?? null;
}

export function assignCardRole(card: CardInput, _userProfile: UserProfile): CardRole {
  if (card.primaryRole !== null) {
    return card.primaryRole;
  }

  const singleTag = hasSingleRoleTag(card);
  if (singleTag !== null) {
    return singleTag;
  }

  if (
    card.rewardCategories.includes(PurchaseCategory.Travel) ||
    card.foreignTransactionFee <= 0.015
  ) {
    return CardRole.Travel;
  }

  if (card.rewardCategories.includes(PurchaseCategory.Subscriptions)) {
    return CardRole.Subscriptions;
  }

  if (card.rewardCategories.includes(PurchaseCategory.Education)) {
    return CardRole.Education;
  }

  if (card.supportsInstallments && card.roleTags.includes(CardRole.Installments)) {
    return CardRole.Installments;
  }

  if (card.cashbackRate >= 0.02) {
    return CardRole.Benefits;
  }

  return CardRole.Daily;
}

function scoreCard(
  card: CardInput,
  purchaseCategory: PurchaseCategory,
  userProfile: UserProfile,
  isInternational: boolean,
): CardRecommendation {
  if (
    !isValidRateFraction(card.cashbackRate) ||
    !isValidRateFraction(card.foreignTransactionFee)
  ) {
    return {
      card,
      score: INVALID_CARD_SCORE,
      scoreReason: DEFAULT_REASON_HE,
      scoreReasonAr: DEFAULT_REASON_AR,
    };
  }

  let score = 50;
  const reasonsHe: string[] = [];
  const reasonsAr: string[] = [];

  if (card.unknownClub === true) {
    score -= 10;
    reasonsHe.push(UNKNOWN_CLUB_REASON_HE);
    reasonsAr.push(UNKNOWN_CLUB_REASON_AR);
  }

  if (card.rewardCategories.includes(purchaseCategory)) {
    score += 20;
    reasonsHe.push('הכרטיס מוגדר להטבות בקטגוריה זו');
    reasonsAr.push('البطاقة مُعرَّفة لمزايا في هذه الفئة');
  }

  const role = assignCardRole(card, userProfile);

  if (isInternational) {
    if (role === CardRole.Travel) {
      score += 15;
      reasonsHe.push('מותאם לרכישות בחו"ל');
      reasonsAr.push('مناسب للمشتريات الدولية');
    }

    const fxPenalty = Math.round(card.foreignTransactionFee * 100);
    score -= fxPenalty;

    if (card.foreignTransactionFee > 0.02) {
      reasonsHe.push('עמלת המרה גבוהה מפחיתה את הציון');
      reasonsAr.push('رسوم تحويل عالية تقلل النتيجة');
    }
  }

  if (
    userProfile.bankName !== undefined &&
    card.bankName !== undefined &&
    card.bankName === userProfile.bankName
  ) {
    score += 5;
    reasonsHe.push('כרטיס משויך לבנק שלך');
    reasonsAr.push('بطاقة مرتبطة ببنكك');
  }

  score += Math.round(card.cashbackRate * 100);

  return {
    card,
    score: clampScore(score),
    scoreReason: reasonsHe.length > 0 ? reasonsHe.join('. ') : DEFAULT_REASON_HE,
    scoreReasonAr: reasonsAr.length > 0 ? reasonsAr.join('. ') : DEFAULT_REASON_AR,
  };
}

export function recommendCard(
  cards: readonly CardInput[],
  purchaseCategory: PurchaseCategory,
  userProfile: UserProfile,
  isInternational: boolean,
): CardRecommendation | null {
  const activeCards = cards.filter((card: CardInput): boolean => card.isActive);

  if (activeCards.length === 0) {
    return null;
  }

  const scoredCards = activeCards
    .map((card: CardInput): CardRecommendation =>
      scoreCard(card, purchaseCategory, userProfile, isInternational),
    )
    .filter((candidate: CardRecommendation): boolean =>
      candidate.score !== INVALID_CARD_SCORE,
    );

  if (scoredCards.length === 0) {
    return null;
  }

  return scoredCards.reduce<CardRecommendation | null>(
    (
      best: CardRecommendation | null,
      candidate: CardRecommendation,
    ): CardRecommendation | null => {
      if (best === null || candidate.score > best.score) {
        return candidate;
      }

      return best;
    },
    null,
  );
}
