export type ProfileLanguagePreference = 'he' | 'ar' | 'en';

export interface AppProfile {
  readonly id: string;
  readonly displayName: string;
  readonly bankName: string;
  readonly languagePreference: ProfileLanguagePreference;
  readonly cardIds: readonly string[];
}
