/**
 * Local activity records — criteria L1–L4.
 *
 * Purchases and verdict history live in the encrypted vault. They are queryable
 * substrate (L3), never a write-only log, and they must not reach `track()` (L4).
 *
 * `activityId` is the carrier the analytics boundary recognises. Do not send
 * these records through `track()`.
 */

import type { PurchaseVerdict } from '../engines/verdict';

export interface LoggedPurchase {
  readonly activityId: string;
  readonly amountIls: number;
  readonly loggedAt: string;
  /** Omitted when the check did not name a card. */
  readonly cardId?: string;
}

export interface VerdictHistoryRecord {
  readonly activityId: string;
  readonly at: string;
  readonly verdict: PurchaseVerdict;
  readonly purchaseAmountIls: number;
  readonly cardId?: string;
}

export interface ActivityVault {
  readonly purchases: readonly LoggedPurchase[];
  readonly verdicts: readonly VerdictHistoryRecord[];
}
