// /src/store/keys.ts
//
// All MMKV key constants for the SmartCard encrypted store.
// Import from here — never use raw string literals elsewhere.

export const APP_SUBSCRIPTION_TIER = 'app:subscription_tier';

export const MMKV_KEYS = {
  languagePreference: 'app:language_preference',
  activeProfileId: 'app:active_profile_id',
  profilePrefix: 'profile_',
  profileDataSuffix: ':data',
  profileUser: (id: string): string => `profile_${id}:user`,
  profileCards: (id: string): string => `profile_${id}:cards`,
  profileCardObligations: (id: string): string =>
    `profile_${id}:card_obligations`,
  profilePinVerifier: (id: string): string => `profile_${id}:pin_verifier`,
  profileLoans: (id: string): string => `profile_${id}:loans`,
  profileCardNotificationIds: (profileId: string, cardId: string): string =>
    `profile_${profileId}:notif_${cardId}`,
  globalDiscountReminderId: 'app:global_discount_reminder_id',
  rtlRestartGuard: 'app:rtl_restart_guard',
  TRANSFER_DECRYPT_ATTEMPTS: 'app:transfer_decrypt_attempts',
  TRANSFER_DECRYPT_LOCKOUT_UNTIL: 'app:transfer_decrypt_lockout_until',
} as const;
