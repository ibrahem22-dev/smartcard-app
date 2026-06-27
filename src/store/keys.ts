// /src/store/keys.ts
//
// All MMKV key constants for the SmartCard encrypted store.
// Import from here — never use raw string literals elsewhere.

export const MMKV_KEYS = {
  userProfile: 'user.profile',
  cards: 'cards',
  cardObligations: 'cards:obligations',
  languagePreference: 'app:language_preference',
  activeProfileId: 'app:active_profile_id',
  profilePrefix: 'profile_',
  profileDataSuffix: ':data',
} as const;
