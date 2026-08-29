import { create } from 'zustand';

import { keyVault } from '../security/keyVault';
import type { Loan } from '../types/loan.types';
import {
  HYDRATING,
  NOT_HYDRATED,
  describeHydrationError,
  hydrated,
  hydrationFailed,
  type HydrationState,
} from './hydration';
import { MMKV_KEYS } from './keys';

interface LoansState {
  loans: Loan[];
  /**
   * Whether `loans` reflects storage yet.
   *
   * ADDED UNDER OWNER RULING OQ-P5-001, 2026-08-29. `src/store/hydration.ts` was written because
   * *"an unloaded store was indistinguishable from a genuinely empty one"* — and this store had
   * escaped it. `hydrate()` read through `keyVault.getEncryptedStorage()`, which THROWS while the
   * vault is locked (AUTH-07), and left `loans: []` behind with nothing recording that it had
   * failed. A user with a mortgage, on a locked vault, was a user with no obligations.
   *
   * That mattered the moment the Check Verdict started reading loans: an empty commitment list is
   * the most optimistic input the verdict engine takes, so the failure mode of guessing here is
   * "good to go" on a purchase the user cannot afford. The Verdict now branches on
   * `classifyCollection(hydration, loans.length)` and refuses rather than assumes.
   */
  hydration: HydrationState;
  hydrate(): void;
  hydrateProfile(profileId: string): void;
  persistProfile(profileId: string): void;
  addLoan(loan: Loan): void;
  updateLoan(updated: Loan): void;
  deleteLoan(id: string): void;
  clearLoans(): void;
}

function parseLoans(raw: string | undefined): Loan[] {
  if (raw === undefined) {
    return [];
  }
  return JSON.parse(raw) as Loan[];
}

function persist(loans: Loan[], profileId: string): void {
  keyVault
    .getEncryptedStorage()
    .set(MMKV_KEYS.profileLoans(profileId), JSON.stringify(loans));
}

function getActiveProfileId(): string {
  const id = keyVault
    .getEncryptedStorage()
    .getString(MMKV_KEYS.activeProfileId);
  if (id === undefined) {
    throw new Error('ACTIVE_PROFILE_REQUIRED');
  }
  return id;
}

export const useLoansStore = create<LoansState>()((set) => ({
  loans: [],
  hydration: NOT_HYDRATED,

  hydrate() {
    set({ hydration: HYDRATING });
    try {
      const handle = keyVault.getEncryptedStorage();
      const activeProfileId = handle.getString(MMKV_KEYS.activeProfileId);
      if (activeProfileId === undefined) {
        // No active profile is a KNOWN empty result, not a failure.
        set({ loans: [], hydration: hydrated(new Date().toISOString()) });
        return;
      }
      const loans = parseLoans(
        handle.getString(MMKV_KEYS.profileLoans(activeProfileId)),
      );
      set({ loans, hydration: hydrated(new Date().toISOString()) });
    } catch (error: unknown) {
      // The vault can be locked (AUTH-07), and a malformed record makes JSON.parse throw.
      // Leaving `loans: []` behind without recording the failure is what made a locked vault
      // look like a user with no loans.
      set({ loans: [], hydration: hydrationFailed(describeHydrationError(error)) });
    }
  },

  hydrateProfile(profileId: string) {
    set({ hydration: HYDRATING });
    try {
      const loans = parseLoans(
        keyVault
          .getEncryptedStorage()
          .getString(MMKV_KEYS.profileLoans(profileId)),
      );
      set({ loans, hydration: hydrated(new Date().toISOString()) });
    } catch (error: unknown) {
      set({ loans: [], hydration: hydrationFailed(describeHydrationError(error)) });
    }
  },

  persistProfile(profileId: string) {
    persist(useLoansStore.getState().loans, profileId);
  },

  addLoan(loan: Loan) {
    set((state) => {
      const loans = [...state.loans, loan];
      persist(loans, getActiveProfileId());
      return { loans };
    });
  },

  updateLoan(updated: Loan) {
    set((state) => {
      const loans = state.loans.map((loan) =>
        loan.id === updated.id ? updated : loan,
      );
      persist(loans, getActiveProfileId());
      return { loans };
    });
  },

  deleteLoan(id: string) {
    set((state) => {
      const loans = state.loans.filter((loan) => loan.id !== id);
      persist(loans, getActiveProfileId());
      return { loans };
    });
  },

  clearLoans() {
    set({ loans: [] });
  },
}));
