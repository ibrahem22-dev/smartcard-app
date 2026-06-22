// /src/types/user.types.ts

/**
 * The user's financial profile. Collected during Onboarding, persisted to MMKV,
 * and passed into the cashflow/decision engines as a parameter (offline-first).
 */
export interface UserProfile {
  readonly id: string;

  /** בנק המשתמש. Optional — the user may not know their club at onboarding. */
  readonly bankName?: string;
  /** Collected locally only; no OTP verification in this phase (Supabase OTP = Phase 4). */
  readonly phoneNumber?: string;

  /** ₪ monthly income — required by the cashflow engine. */
  readonly monthlyIncome: number;
  /** ₪ current bank balance — required for danger-threshold logic. */
  readonly currentBalance: number;
  /** ₪ user-defined warning level; מינוס/risk surfaces once balance nears this. */
  readonly dangerThreshold: number;

  /** Unix epoch ms. */
  readonly createdAt: number;
  readonly updatedAt: number;
}