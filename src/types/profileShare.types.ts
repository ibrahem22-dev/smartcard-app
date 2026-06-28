import type { CardInput, CardIssuer, CardRates } from './card.types';
import type { AppProfile, ProfileLanguagePreference } from './profile.types';

export type ProfileShareMode = 'export' | 'import';

export interface TransferCard {
  readonly issuer: CardIssuer;
  readonly club: string;
  readonly last4: string;
  readonly billingDay: number;
  readonly creditLimit: number;
  readonly cardRates?: CardRates;
}

export interface TransferProfile {
  readonly displayName: string;
  readonly bankName: string;
  readonly cards: readonly TransferCard[];
}

export interface ProfileShareSource extends AppProfile {
  readonly pinHash?: string;
  readonly pinSalt?: string;
  readonly kdfVersion?: number;
  readonly balance?: number;
  readonly income?: number;
}

export interface ImportedProfileBundle {
  readonly profile: AppProfile;
  readonly cards: readonly CardInput[];
}

export interface UseProfileShareResult {
  readonly activeProfile: AppProfile | null;
  readonly mode: ProfileShareMode;
  readonly setMode: (mode: ProfileShareMode) => void;
  readonly transferPin: string;
  readonly setTransferPin: (pin: string) => void;
  readonly encodedPayload: string | null;
  readonly scannedPayload: string | null;
  readonly preview: TransferProfile | null;
  readonly error: string | null;
  readonly isBusy: boolean;
  readonly cameraPermissionGranted: boolean;
  readonly generateExport: () => Promise<void>;
  readonly requestCamera: () => Promise<void>;
  readonly acceptScannedPayload: (payload: string) => void;
  readonly decryptImport: () => Promise<void>;
  readonly importProfile: (
    languagePreference: ProfileLanguagePreference,
  ) => Promise<void>;
  readonly clearEphemeralState: () => void;
}
