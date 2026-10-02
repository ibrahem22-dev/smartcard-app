import { create } from 'zustand';

import { keyVault } from '../security/keyVault';
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
    /**
     * B9 — THERE IS NO TIER SOURCE, AND THIS SAYS SO RATHER THAN GUESSING.
     *
     * This called RevenueCat. The paywall is unmounted and react-native-purchases is archived out
     * of the dependency manifest, so there is nothing to refresh FROM. It deliberately does not
     * invent a tier, does not reset to free, and does not throw: the persisted value the vault
     * already holds stays authoritative, and a refresh is a no-op that states why.
     *
     * Billing is not P2 scope. Contract §9 sends purchase logging to P4.
     */
    refreshTier: async (): Promise<void> => {
      // No vendor SDK is reachable from this store by design (B9). Nothing to fetch.
      return Promise.resolve();
    },
    isPlus: (): boolean => {
      const { currentTier } = get();
      return currentTier === 'plus' || currentTier === 'pro';
    },
    isPro: (): boolean => get().currentTier === 'pro',
  }),
);
