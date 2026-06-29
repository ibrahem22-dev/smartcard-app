import {
  CardRole,
  type CardInput,
  type CardRecommendation,
  type ForeignCurrencyType,
} from '../types/card.types';
import { type Currency, PurchaseCategory } from '../types/purchase.types';
import type { UserProfile } from '../types/user.types';

/**
 * Effective foreign-exchange commission (%) for a card on an international
 * purchase, in priority order:
 *   1. מט"ח account whose currency matches the purchase → 0 (no conversion).
 *   2. מט"ח account with a different currency → the bank's FX commission.
 *   3. Otherwise the card's own `cardRates.foreignExchangeCommission`.
 *   4. Legacy fallback: `foreignTransactionFee` (a fraction) as a percentage.
 * Returned as a percentage to match CardRates/bankFxCommission units.
 */
export function getEffectiveFxCommission(
  card: CardInput,
  purchaseCurrency?: Currency,
): number {
  if (card.hasForeignCurrencyAccount === true) {
    if (
      isMatchingForeignCurrency(card.foreignCurrencyType, purchaseCurrency)
    ) {
      return 0;
    }
    if (typeof card.bankFxCommission === 'number') {
      return card.bankFxCommission;
    }
  }

  if (card.cardRates !== undefined) {
    return card.cardRates.foreignExchangeCommission;
  }

  return card.foreignTransactionFee * 100;
}

const UNKNOWN_CLUB_REASON_HE = 'מועדון לא ידוע — ייתכן הטבות נוספות';
const UNKNOWN_CLUB_REASON_AR = 'المועدون غير معروف — قد تتوفر مزايا إضافية';
const DEFAULT_REASON_HE = 'הכרטיס מתאים לרכישה זו';
const DEFAULT_REASON_AR = 'البطاقة مناسبة لهذا الشراء';

const INVALID_CARD_SCORE = -Infinity;

function isMatchingForeignCurrency(
  foreignCurrencyType: ForeignCurrencyType | undefined,
  purchaseCurrency: Currency | undefined,
): boolean {
  return (
    purchaseCurrency !== undefined &&
    foreignCurrencyType === purchaseCurrency
  );
}

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
  purchaseCurrency: Currency | undefined,
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

    const fxPercent = getEffectiveFxCommission(card, purchaseCurrency);
    score -= Math.round(fxPercent);

    const matchedForeignAccount =
      card.hasForeignCurrencyAccount === true &&
      isMatchingForeignCurrency(card.foreignCurrencyType, purchaseCurrency);

    if (matchedForeignAccount) {
      // מט"ח account in the purchase currency → no conversion fee → rank first.
      score += 30;
      reasonsHe.push('חשבון מט"ח תואם — ללא עמלת המרה');
      reasonsAr.push('حساب عملات أجنبية مطابق — بدون رسوم تحويل');
    } else if (fxPercent > 2) {
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
  purchaseCurrency?: Currency,
): CardRecommendation | null {
  const activeCards = cards.filter((card: CardInput): boolean => card.isActive);

  if (activeCards.length === 0) {
    return null;
  }

  const scoredCards = activeCards
    .map((card: CardInput): CardRecommendation =>
      scoreCard(
        card,
        purchaseCategory,
        userProfile,
        isInternational,
        purchaseCurrency,
      ),
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
