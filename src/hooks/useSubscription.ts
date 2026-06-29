import { useSubscriptionStore } from '../store/useSubscriptionStore';
import type { UseSubscriptionResult } from '../types/subscription.types';

export function useSubscription(): UseSubscriptionResult {
  const currentTier = useSubscriptionStore(state => state.currentTier);
  const refreshTier = useSubscriptionStore(state => state.refreshTier);
  const isPlus = useSubscriptionStore(state => state.isPlus());
  const isPro = useSubscriptionStore(state => state.isPro());

  return {
    currentTier,
    refreshTier,
    isPlus,
    isPro,
  };
}
