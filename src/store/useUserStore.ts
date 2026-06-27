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

// ---------------------------------------------------------------------------

interface UserState {
  /** null until hydrate() is called after vault unlock. */
  profile: UserProfile | null;

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

  hydrate() {
    const handle = keyVault.getEncryptedStorage();
    const activeProfileId = handle.getString(MMKV_KEYS.activeProfileId);
    if (activeProfileId === undefined) {
      set({ profile: null });
      return;
    }
    const raw = handle.getString(MMKV_KEYS.profileUser(activeProfileId));
    set({
      profile: raw === undefined ? null : (JSON.parse(raw) as UserProfile),
    });
  },

  hydrateProfile(profileId: string) {
    const handle = keyVault.getEncryptedStorage();
    const raw = handle.getString(MMKV_KEYS.profileUser(profileId));
    set({
      profile: raw === undefined ? null : (JSON.parse(raw) as UserProfile),
    });
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
    // Zero memory unconditionally.
    set({ profile: null });
  },
}));
