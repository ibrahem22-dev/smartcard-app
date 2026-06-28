import { create } from 'zustand';

import { keyVault } from '../security/keyVault';
import type { Loan } from '../types/loan.types';
import { MMKV_KEYS } from './keys';

interface LoansState {
  loans: Loan[];
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

  hydrate() {
    const handle = keyVault.getEncryptedStorage();
    const activeProfileId = handle.getString(MMKV_KEYS.activeProfileId);
    if (activeProfileId === undefined) {
      set({ loans: [] });
      return;
    }
    const loans = parseLoans(
      handle.getString(MMKV_KEYS.profileLoans(activeProfileId)),
    );
    set({ loans });
  },

  hydrateProfile(profileId: string) {
    const loans = parseLoans(
      keyVault
        .getEncryptedStorage()
        .getString(MMKV_KEYS.profileLoans(profileId)),
    );
    set({ loans });
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
