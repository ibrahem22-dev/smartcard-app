/**
 * Encrypted activity vault — purchases and verdict history (L1, L3, L4).
 *
 * Same lifecycle as cards: hydrate after unlock, persist on every write,
 * clear on vault lock. Nothing here is an engine.
 */
import { create } from 'zustand';

import { keyVault } from '../security/keyVault';
import type { LoggedPurchase, VerdictHistoryRecord } from '../types/activity.types';
import { parseStoredActivity } from './activityParsing';
import {
  HYDRATING,
  NOT_HYDRATED,
  describeHydrationError,
  hydrated,
  hydrationFailed,
  type HydrationState,
} from './hydration';
import { MMKV_KEYS } from './keys';

interface ActivityState {
  hydration: HydrationState;
  purchases: LoggedPurchase[];
  verdicts: VerdictHistoryRecord[];
  hydrate(): void;
  hydrateProfile(profileId: string): void;
  persistProfile(profileId: string): void;
  logPurchase(purchase: LoggedPurchase): void;
  recordVerdict(record: VerdictHistoryRecord): void;
  queryVerdicts(filter?: { readonly cardId?: string }): readonly VerdictHistoryRecord[];
  clearActivity(): void;
}

function persist(
  purchases: readonly LoggedPurchase[],
  verdicts: readonly VerdictHistoryRecord[],
  profileId: string,
): void {
  keyVault
    .getEncryptedStorage()
    .set(
      MMKV_KEYS.profileActivity(profileId),
      JSON.stringify({ purchases, verdicts }),
    );
}

function getActiveProfileId(): string {
  const activeProfileId = keyVault
    .getEncryptedStorage()
    .getString(MMKV_KEYS.activeProfileId);
  if (activeProfileId === undefined) {
    throw new Error('ACTIVE_PROFILE_REQUIRED');
  }
  return activeProfileId;
}

export const useActivityStore = create<ActivityState>()((set, get) => ({
  hydration: NOT_HYDRATED,
  purchases: [],
  verdicts: [],

  hydrate() {
    set({ hydration: HYDRATING });
    try {
      const handle = keyVault.getEncryptedStorage();
      const activeProfileId = handle.getString(MMKV_KEYS.activeProfileId);
      if (activeProfileId === undefined) {
        set({
          purchases: [],
          verdicts: [],
          hydration: hydrated(new Date().toISOString()),
        });
        return;
      }
      const vault = parseStoredActivity(
        handle.getString(MMKV_KEYS.profileActivity(activeProfileId)),
      );
      set({
        purchases: [...vault.purchases],
        verdicts: [...vault.verdicts],
        hydration: hydrated(new Date().toISOString()),
      });
    } catch (error: unknown) {
      set({
        purchases: [],
        verdicts: [],
        hydration: hydrationFailed(describeHydrationError(error)),
      });
    }
  },

  hydrateProfile(profileId: string) {
    const vault = parseStoredActivity(
      keyVault.getEncryptedStorage().getString(MMKV_KEYS.profileActivity(profileId)),
    );
    set({ purchases: [...vault.purchases], verdicts: [...vault.verdicts] });
  },

  persistProfile(profileId: string) {
    const state = get();
    persist(state.purchases, state.verdicts, profileId);
  },

  logPurchase(purchase: LoggedPurchase) {
    set((state) => {
      const purchases = [...state.purchases, purchase];
      persist(purchases, state.verdicts, getActiveProfileId());
      return { purchases };
    });
  },

  recordVerdict(record: VerdictHistoryRecord) {
    set((state) => {
      const verdicts = [...state.verdicts, record];
      persist(state.purchases, verdicts, getActiveProfileId());
      return { verdicts };
    });
  },

  queryVerdicts(filter) {
    const records = get().verdicts;
    const filtered = filter?.cardId === undefined
      ? records
      : records.filter((record) => record.cardId === filter.cardId);
    return [...filtered].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  },

  clearActivity() {
    set({
      purchases: [],
      verdicts: [],
      hydration: hydrated(new Date().toISOString()),
    });
  },
}));
