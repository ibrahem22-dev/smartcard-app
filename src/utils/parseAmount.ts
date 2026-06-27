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
