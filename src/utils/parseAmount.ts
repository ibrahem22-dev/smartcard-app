import {
  MONETARY_MAX_ILS,
  MONETARY_MIN_ILS,
  isValidMonetaryAmount,
} from './monetary';

export function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(/[,\s₪]/g, '');

  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < MONETARY_MIN_ILS || parsed > MONETARY_MAX_ILS) {
    return null;
  }

  return isValidMonetaryAmount(parsed) ? parsed : null;
}

/**
 * THE SAME PARSE, EXCEPT THAT ZERO IS AN ANSWER.
 *
 * `parseAmount` floors at `MONETARY_MIN_ILS` (₪0.01) and it is right to for the amounts it was
 * written for: a purchase of ₪0, an instalment of ₪0 and a credit limit of ₪0 are all typing
 * mistakes, and accepting them would put a meaningless figure into an engine.
 *
 * A BALANCE IS NOT ONE OF THOSE. "Nothing is owed on this card yet" is the ordinary state of a card
 * the moment somebody adds it, and it was being refused: the guided card-add flow was walked on
 * emulator-5554 against artifact #8 with a current balance of 0, and the form answered "יש למלא שם,
 * מנפיק, 4 ספרות, מסגרת וחיוב תקינים" — an error naming five fields, none of which was wrong.
 * Typing 1 saved immediately. The refusal predates this campaign and reached every artifact.
 *
 * So this is a SECOND function rather than a flag on the first. The floor is a real rule for the
 * three callers that keep it, and a caller that wants zero should have to say so by name.
 */
export function parseAmountAllowingZero(value: string): number | null {
  const normalized = value.trim().replace(/[,\s₪]/g, '');
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  if (parsed === 0) return 0;
  return parseAmount(value);
}
