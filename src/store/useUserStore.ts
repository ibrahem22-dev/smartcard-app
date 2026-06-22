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
    const stored = handle.getUserProfile();
    set({ profile: stored ?? null });
  },

  setProfile(profile: UserProfile) {
    const handle = keyVault.getEncryptedStorage();
    handle.setUserProfile(profile);
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
      keyVault.getEncryptedStorage().setUserProfile(updated);
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
      keyVault.getEncryptedStorage().setUserProfile(updated);
      return { profile: updated };
    });
  },

  clearProfile() {
    // Zero memory unconditionally.
    set({ profile: null });
    // Best-effort MMKV delete — vault may already be locked/wiped on logout.
    try {
      keyVault.getEncryptedStorage().delete(MMKV_KEYS.userProfile);
    } catch {
      // Vault locked or wiped: nothing to delete, in-memory state already cleared.
    }
  },
}));
