/**
 * §9 monetary input contract — ₪0.01 through ₪999,999 inclusive.
 *
 * D5 — the values live in config/financial.ts and are re-exported here so the many existing callers
 * keep their import. Re-exporting rather than redeclaring is the point: there is still exactly one
 * definition, and a reader following either path arrives at the same line.
 */
import { MONETARY_MIN_ILS, MONETARY_MAX_ILS } from '../config/financial';

export { MONETARY_MIN_ILS, MONETARY_MAX_ILS };

export function isValidMonetaryAmount(amount: number): boolean {
  return (
    Number.isFinite(amount) &&
    amount >= MONETARY_MIN_ILS &&
    amount <= MONETARY_MAX_ILS
  );
}
