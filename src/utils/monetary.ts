/** §9 monetary input contract — ₪0.01 through ₪999,999 inclusive. */
export const MONETARY_MIN_ILS = 0.01;
export const MONETARY_MAX_ILS = 999_999;

export function isValidMonetaryAmount(amount: number): boolean {
  return (
    Number.isFinite(amount) &&
    amount >= MONETARY_MIN_ILS &&
    amount <= MONETARY_MAX_ILS
  );
}
