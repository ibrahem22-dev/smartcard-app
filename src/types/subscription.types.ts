export type SubscriptionTier = 'free' | 'plus' | 'pro';

export interface SubscriptionState {
  readonly currentTier: SubscriptionTier;
  readonly expiresAt: string | null;
  readonly isLifetime: boolean;
  readonly lastVerifiedAt: string | null;
}

export interface SubscriptionStoreState extends SubscriptionState {
  readonly setTier: (tier: SubscriptionTier) => void;
  readonly refreshTier: () => Promise<void>;
  readonly isPlus: () => boolean;
  readonly isPro: () => boolean;
}

export interface UseSubscriptionResult {
  readonly currentTier: SubscriptionTier;
  readonly refreshTier: () => Promise<void>;
  readonly isPlus: boolean;
  readonly isPro: boolean;
}
