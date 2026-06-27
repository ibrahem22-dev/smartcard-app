// /src/store/useCardsStore.ts
//
// Zustand store for the user's registered credit cards.
//
// Storage: encrypted MMKV via keyVault.getEncryptedStorage() — never AsyncStorage,
// never a hardcoded key. keyVault.getEncryptedStorage() throws while the vault is
// LOCKED, which is the correct fail-loudly behaviour for all write paths. The one
// exception is clearCards(), which is called on vault wipe / logout when the vault
// may already be destroyed; it catches and silently skips the MMKV delete while
// still zeroing in-memory state.
//
// Lifecycle:
//   1. App boots → vault locked → store holds cards: [], entries: [].
//   2. Auth succeeds → caller calls useCardsStore.getState().hydrate() once.
//      hydrate() reads from MMKV and populates in-memory state.
//   3. Setters write to MMKV on every call (vault must be unlocked by then).
//   4. Vault wipe / logout → caller calls clearCards().
//
// Metadata wrapper:
//   Cards are persisted as CardEntry objects: { card: UserCard, clubSuggestedByApp?: boolean }.
//   The store exposes the plain cards: UserCard[] view for engines/UI, and keeps
//   entries: CardEntry[] as the parallel source of truth for metadata. Both are
//   always updated together — they never diverge.
//
// unknownClub cards: valid entries — never filtered.

import { create } from 'zustand';

// UserCard is CardInput — this alias is used project-wide (see decision.types.ts).
import type { CardInput as UserCard } from '../types/card.types';
import { keyVault } from '../security/keyVault';
import type { ImportedInstallment } from '../types/installment.types';
import { isValidMonetaryAmount } from '../utils/monetary';
import { MMKV_KEYS } from './keys';

// ---------------------------------------------------------------------------

/**
 * MMKV-persisted wrapper. Stores the card alongside app-tracked metadata that
 * must NOT be added to the shared UserCard / CardInput type.
 */
export interface CardEntry {
  readonly card: UserCard;
  /** True when the app's guided club-suggestion flow chose the club for the user. */
  readonly clubSuggestedByApp?: boolean;
}

// ---------------------------------------------------------------------------

interface CardsState {
  /** Plain card array — the view engines and UI components consume. */
  cards: UserCard[];

  /**
   * Full persisted entries including metadata. Always in sync with `cards`.
   * Use this when you need clubSuggestedByApp alongside the card.
   */
  entries: CardEntry[];
  obligations: ImportedInstallment[];

  /**
   * Populate in-memory state from encrypted MMKV.
   * Must be called once after a successful vault unlock.
   * Safe to call again (re-hydrates, e.g. after re-auth).
   */
  hydrate(): void;
  hydrateProfile(profileId: string): void;
  persistProfile(profileId: string): void;

  /**
   * Append a new card. If the card's club was suggested by the app's guided
   * flow, pass clubSuggestedByApp: true.
   * unknownClub cards are valid — they are stored as-is.
   */
  addCard(card: UserCard, clubSuggestedByApp?: boolean): void;

  /** Remove a card by its cardId. No-op if the id is not found. */
  removeCard(cardId: string): void;

  /**
   * Merge updates into an existing card. Identified by cardId.
   * No-op if the id is not found. Does not affect clubSuggestedByApp metadata.
   */
  updateCard(cardId: string, updates: Partial<UserCard>): void;
  addObligation(obligation: ImportedInstallment): void;
  updateObligation(
    installmentId: string,
    obligation: ImportedInstallment,
  ): void;
  deleteObligation(installmentId: string): void;

  /**
   * Zero in-memory state and delete the MMKV record.
   * Called on vault wipe / logout. Tolerates an already-locked or
   * already-wiped vault — MMKV delete is best-effort in that case.
   */
  clearCards(): void;
}

// ---------------------------------------------------------------------------

/** Serialize entries to MMKV. */
function persist(entries: CardEntry[], profileId: string): void {
  keyVault
    .getEncryptedStorage()
    .set(MMKV_KEYS.profileCards(profileId), JSON.stringify(entries));
}

/** Deserialize entries from a raw MMKV string (undefined = key absent). */
function parseEntries(raw: string | undefined): CardEntry[] {
  if (raw === undefined) {
    return [];
  }
  return JSON.parse(raw) as CardEntry[];
}

function persistObligations(
  obligations: readonly ImportedInstallment[],
  profileId: string,
): void {
  keyVault
    .getEncryptedStorage()
    .set(
      MMKV_KEYS.profileCardObligations(profileId),
      JSON.stringify(obligations),
    );
}

function parseObligations(raw: string | undefined): ImportedInstallment[] {
  if (raw === undefined) {
    return [];
  }
  return JSON.parse(raw) as ImportedInstallment[];
}

function assertValidObligation(obligation: ImportedInstallment): void {
  if (
    obligation.merchantName.trim() === '' ||
    !isValidMonetaryAmount(obligation.totalAmount) ||
    !isValidMonetaryAmount(obligation.monthlyPayment) ||
    !Number.isInteger(obligation.monthsRemaining) ||
    obligation.monthsRemaining < 1 ||
    obligation.monthsRemaining > 360 ||
    obligation.billingCardId.trim() === '' ||
    obligation.source !== 'imported'
  ) {
    throw new Error('INVALID_IMPORTED_INSTALLMENT');
  }
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

// ---------------------------------------------------------------------------

export const useCardsStore = create<CardsState>()((set) => ({
  cards: [],
  entries: [],
  obligations: [],

  hydrate() {
    const handle = keyVault.getEncryptedStorage();
    const activeProfileId = handle.getString(MMKV_KEYS.activeProfileId);
    if (activeProfileId === undefined) {
      set({ entries: [], cards: [], obligations: [] });
      return;
    }
    const entries = parseEntries(
      handle.getString(MMKV_KEYS.profileCards(activeProfileId)),
    );
    const obligations = parseObligations(
      handle.getString(MMKV_KEYS.profileCardObligations(activeProfileId)),
    );
    set({ entries, cards: entries.map((e) => e.card), obligations });
  },

  hydrateProfile(profileId: string) {
    const handle = keyVault.getEncryptedStorage();
    const entries = parseEntries(
      handle.getString(MMKV_KEYS.profileCards(profileId)),
    );
    const obligations = parseObligations(
      handle.getString(MMKV_KEYS.profileCardObligations(profileId)),
    );
    set({ entries, cards: entries.map(entry => entry.card), obligations });
  },

  persistProfile(profileId: string) {
    const state = useCardsStore.getState();
    persist(state.entries, profileId);
    persistObligations(state.obligations, profileId);
  },

  addCard(card: UserCard, clubSuggestedByApp?: boolean) {
    set((state) => {
      const entry: CardEntry =
        clubSuggestedByApp === true
          ? { card, clubSuggestedByApp: true }
          : { card };
      const entries = [...state.entries, entry];
      persist(entries, getActiveProfileId());
      return { entries, cards: entries.map((e) => e.card) };
    });
  },

  removeCard(cardId: string) {
    set((state) => {
      const entries = state.entries.filter((e) => e.card.cardId !== cardId);
      persist(entries, getActiveProfileId());
      return { entries, cards: entries.map((e) => e.card) };
    });
  },

  updateCard(cardId: string, updates: Partial<UserCard>) {
    set((state) => {
      const entries = state.entries.map((e): CardEntry => {
        if (e.card.cardId !== cardId) {
          return e;
        }
        // Spread updates onto the existing card. clubSuggestedByApp metadata
        // is preserved — updateCard only touches card fields.
        const updatedCard: UserCard = { ...e.card, ...updates };
        return { ...e, card: updatedCard };
      });
      persist(entries, getActiveProfileId());
      return { entries, cards: entries.map((e) => e.card) };
    });
  },

  addObligation(obligation: ImportedInstallment) {
    assertValidObligation(obligation);
    set(state => {
      if (
        state.obligations.some(
          existing => existing.installmentId === obligation.installmentId,
        )
      ) {
        throw new Error('IMPORTED_INSTALLMENT_ALREADY_EXISTS');
      }
      const obligations = [...state.obligations, obligation];
      persistObligations(obligations, getActiveProfileId());
      return { obligations };
    });
  },

  updateObligation(
    installmentId: string,
    obligation: ImportedInstallment,
  ) {
    assertValidObligation(obligation);
    if (installmentId !== obligation.installmentId) {
      throw new Error('IMPORTED_INSTALLMENT_ID_MISMATCH');
    }
    set(state => {
      const obligations = state.obligations.map(existing =>
        existing.installmentId === installmentId ? obligation : existing,
      );
      persistObligations(obligations, getActiveProfileId());
      return { obligations };
    });
  },

  deleteObligation(installmentId: string) {
    set(state => {
      const obligations = state.obligations.filter(
        obligation => obligation.installmentId !== installmentId,
      );
      persistObligations(obligations, getActiveProfileId());
      return { obligations };
    });
  },

  clearCards() {
    set({ cards: [], entries: [], obligations: [] });
  },
}));
