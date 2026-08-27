// /src/types/user.types.ts

/**
 * The user's financial profile. Collected during Onboarding, persisted to MMKV,
 * and passed into the cashflow/decision engines as a parameter (offline-first).
 */
export type PaydayCapture =
  | { readonly kind: 'day'; readonly day: 1 | 10 | 15 | 28 }
  | { readonly kind: 'last' };

export interface UserProfile {
  readonly id: string;

  /** בנק המשתמש. Optional — the user may not know their club at onboarding. */
  readonly bankName?: string;
  /** Collected locally only; no OTP verification in this phase (Supabase OTP = Phase 4). */
  readonly phoneNumber?: string;

  /** ₪ monthly income — the cashflow engine's anchor. Required on a stored profile. */
  readonly monthlyIncome: number;
  /**
   * Salary day captured at onboarding. `last` is the last calendar day of the
   * month. Absent until captured; never invented.
   */
  readonly payday?: PaydayCapture;
  /** ₪ current bank balance — required for danger-threshold logic when present. */
  readonly currentBalance?: number;
  /** ₪ user-defined warning level. Unknown until the user enters one. */
  readonly dangerThreshold?: number;

  /** Unix epoch ms. */
  readonly createdAt: number;
  readonly updatedAt: number;
}
