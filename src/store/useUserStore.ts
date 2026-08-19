// /src/store/useUserStore.ts
//
// Zustand store for the authenticated user's financial profile.
//
// Storage: encrypted MMKV via keyVault.getEncryptedStorage() — never AsyncStorage,
// never a hardcoded key. keyVault.getEncryptedStorage() throws while the vault is
// LOCKED, which is the correct fail-loudly behaviour for all write paths. The one
// exception is clearProfile(), which is called on vault wipe / logout when the
// vault may already be destroyed; it catches and silently skips the MMKV delete
// in that case while still nulling the in-memory state.
//
// Lifecycle:
//   1. App boots → vault locked → store holds profile: null.
//   2. Auth succeeds → caller calls useUserStore.getState().hydrate() once.
//      hydrate() reads from MMKV and populates in-memory state.
//   3. Setters write to MMKV on every call (vault must be unlocked by then).
//   4. Vault wipe / logout → caller calls clearProfile().

import { create } from 'zustand';

import { keyVault } from '../security/keyVault';
import type { UserProfile } from '../types/user.types';
import { MMKV_KEYS } from './keys';
import {
  HYDRATING,
  NOT_HYDRATED,
  describeHydrationError,
  hydrated,
  hydrationFailed,
  type HydrationState,
} from './hydration';
import { parseStoredProfile } from './userProfileParsing';

// DR-012 finding 2: parse validation lives in `userProfileParsing.ts`, which
// imports no native module and is therefore reachable from tests.
export { isUserProfile, parseStoredProfile } from './userProfileParsing';

// ---------------------------------------------------------------------------

interface UserState {
  /** null until hydrate() is called after vault unlock. */
  profile: UserProfile | null;

  /**
   * DR-012 finding 1: whether `profile` reflects storage yet.
   *
   * `profile: null` alone is ambiguous between "not hydrated" and "no profile
   * exists" — the same defect already fixed in useCardsStore and
   * useProfileStore. This store was missed. Consumers must branch on this
   * rather than treating a null profile as a user with no financial state.
   */
  hydration: HydrationState;

  /**
   * Populate in-memory state from encrypted MMKV.
   * Must be called once after a successful vault unlock.
   * Safe to call again (re-hydrates, e.g. after a re-auth).
   */
  hydrate(): void;
  hydrateProfile(profileId: string): void;
  persistProfile(profileId: string): void;

  /** Write a complete profile to memory and MMKV. */
  setProfile(profile: UserProfile): void;

  /** Update monthly income in-place, stamping updatedAt. */
  updateIncome(amount: number): void;

  /** Update current balance in-place, stamping updatedAt. */
  updateBalance(amount: number): void;

  /**
   * Zero in-memory state and delete the MMKV record.
   * Called on vault wipe / logout. Tolerates an already-locked or
   * already-wiped vault — MMKV delete is best-effort in that case.
   */
  clearProfile(): void;
}

// ---------------------------------------------------------------------------

export const useUserStore = create<UserState>()((set) => ({
  profile: null,
  hydration: NOT_HYDRATED,

  hydrate() {
    set({ hydration: HYDRATING });
    try {
      const handle = keyVault.getEncryptedStorage();
      const activeProfileId = handle.getString(MMKV_KEYS.activeProfileId);
      if (activeProfileId === undefined) {
        // No active profile is a KNOWN empty result, not a failure.
        set({ profile: null, hydration: hydrated(new Date().toISOString()) });
        return;
      }
      const profile = parseStoredProfile(
        handle.getString(MMKV_KEYS.profileUser(activeProfileId)),
      );
      set({ profile, hydration: hydrated(new Date().toISOString()) });
    } catch (error: unknown) {
      // getEncryptedStorage() throws while the vault is LOCKED (AUTH-07).
      // Recording the failure keeps a locked vault distinguishable from a
      // user who has entered no financial state.
      set({
        profile: null,
        hydration: hydrationFailed(describeHydrationError(error)),
      });
    }
  },

  hydrateProfile(profileId: string) {
    set({ hydration: HYDRATING });
    try {
      const handle = keyVault.getEncryptedStorage();
      const profile = parseStoredProfile(
        handle.getString(MMKV_KEYS.profileUser(profileId)),
      );
      set({ profile, hydration: hydrated(new Date().toISOString()) });
    } catch (error: unknown) {
      set({
        profile: null,
        hydration: hydrationFailed(describeHydrationError(error)),
      });
    }
  },

  persistProfile(profileId: string) {
    const profile = useUserStore.getState().profile;
    if (profile !== null) {
      keyVault
        .getEncryptedStorage()
        .set(MMKV_KEYS.profileUser(profileId), JSON.stringify(profile));
    }
  },

  setProfile(profile: UserProfile) {
    const handle = keyVault.getEncryptedStorage();
    const activeProfileId = handle.getString(MMKV_KEYS.activeProfileId);
    if (activeProfileId === undefined) {
      throw new Error('ACTIVE_PROFILE_REQUIRED');
    }
    handle.set(MMKV_KEYS.profileUser(activeProfileId), JSON.stringify(profile));
    set({ profile });
  },

  updateIncome(amount: number) {
    set((state) => {
      if (state.profile === null) {
        return {};
      }
      const updated: UserProfile = {
        ...state.profile,
        monthlyIncome: amount,
        updatedAt: Date.now(),
      };
      const storage = keyVault.getEncryptedStorage();
      const activeProfileId = storage.getString(MMKV_KEYS.activeProfileId);
      if (activeProfileId === undefined) {
        throw new Error('ACTIVE_PROFILE_REQUIRED');
      }
      storage.set(
        MMKV_KEYS.profileUser(activeProfileId),
        JSON.stringify(updated),
      );
      return { profile: updated };
    });
  },

  updateBalance(amount: number) {
    set((state) => {
      if (state.profile === null) {
        return {};
      }
      const updated: UserProfile = {
        ...state.profile,
        currentBalance: amount,
        updatedAt: Date.now(),
      };
      const storage = keyVault.getEncryptedStorage();
      const activeProfileId = storage.getString(MMKV_KEYS.activeProfileId);
      if (activeProfileId === undefined) {
        throw new Error('ACTIVE_PROFILE_REQUIRED');
      }
      storage.set(
        MMKV_KEYS.profileUser(activeProfileId),
        JSON.stringify(updated),
      );
      return { profile: updated };
    });
  },

  clearProfile() {
    // Zero memory unconditionally. A deliberate clear is a KNOWN empty state,
    // not an unloaded one.
    //
    // NOTE (DR-012 finding 3, NOT fixed here): the header comment on this file
    // states clearProfile() also deletes the MMKV record. It does not. That
    // touches logout/wipe behaviour, which SECURITY_AUTH_BASELINE.md §5 puts
    // behind a Security Agent review gate, so it is left for that review
    // rather than changed here.
    set({ profile: null, hydration: hydrated(new Date().toISOString()) });
  },
}));
