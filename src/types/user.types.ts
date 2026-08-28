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
  /**
   * ₪ ceiling the user is willing to commit monthly — P5 criteria `J1` and `H3`.
   *
   * Spec §15 requires the cap *"shown as an absolute ₪ limit derived from the 35% threshold,
   * editable"*, and §25 gives the reason: *"absolute + percent together is more tangible than
   * either alone."* It sits here beside `dangerThreshold`, which is already exactly this shape,
   * rather than in a new store — a second store for one number is a second place a user's
   * financial preference can live.
   *
   * OPTIONAL, and it stays optional. Unknown-until-set is a real state; a default written into the
   * vault would be the app's opinion wearing the user's provenance. The 35% threshold is what a
   * SUGGESTED value is derived from, by the load engine, at the moment it is offered.
   *
   * Classified `vault` in `src/store/p5UserState.ts`, which criterion `U1`'s gate checks against
   * this declaration in both directions.
   */
  readonly commitmentCapIls?: number;

  /** Unix epoch ms. */
  readonly createdAt: number;
  readonly updatedAt: number;
}
