import { create } from 'zustand';

import { keyVault } from '../security/keyVault';
import { fetchSubscriptionTier } from '../services/revenueCat';
import type {
  SubscriptionState,
  SubscriptionStoreState,
  SubscriptionTier,
} from '../types/subscription.types';
import { APP_SUBSCRIPTION_TIER } from './keys';

const DEFAULT_STATE: SubscriptionState = {
  currentTier: 'free',
  expiresAt: null,
  isLifetime: false,
  lastVerifiedAt: null,
};

function persistTier(tier: SubscriptionTier): void {
  try {
    keyVault.getEncryptedStorage().set(APP_SUBSCRIPTION_TIER, tier);
  } catch {
    // The vault can be locked before authentication; memory remains authoritative.
  }
}

function getPersistedTier(): SubscriptionTier {
  try {
    const tier = keyVault
      .getEncryptedStorage()
      .getString(APP_SUBSCRIPTION_TIER);

    if (tier === 'plus' || tier === 'pro') {
      return tier;
    }
  } catch {
    // The vault is normally locked while modules initialize.
  }

  return 'free';
}

export const useSubscriptionStore = create<SubscriptionStoreState>()(
  (set, get) => ({
    ...DEFAULT_STATE,
    currentTier: getPersistedTier(),
    setTier: (tier: SubscriptionTier): void => {
      persistTier(tier);
      set({
        currentTier: tier,
        lastVerifiedAt: new Date().toISOString(),
      });
    },
    refreshTier: async (): Promise<void> => {
      const tier = await fetchSubscriptionTier();
      get().setTier(tier);
    },
    isPlus: (): boolean => {
      const { currentTier } = get();
      return currentTier === 'plus' || currentTier === 'pro';
    },
    isPro: (): boolean => get().currentTier === 'pro',
  }),
);
