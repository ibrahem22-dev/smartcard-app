export type ProfileLanguagePreference = 'he' | 'ar' | 'en';

export interface AppProfile {
  readonly id: string;
  readonly displayName: string;
  readonly pinHash: string;
  readonly bankName: string;
  readonly monthlyIncome: number;
  readonly languagePreference: ProfileLanguagePreference;
  readonly cardIds: readonly string[];
}
