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

  /**
   * Populate in-memory state from encrypted MMKV.
   * Must be called once after a successful vault unlock.
   * Safe to call again (re-hydrates, e.g. after re-auth).
   */
  hydrate(): void;

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

  /**
   * Zero in-memory state and delete the MMKV record.
   * Called on vault wipe / logout. Tolerates an already-locked or
   * already-wiped vault — MMKV delete is best-effort in that case.
   */
  clearCards(): void;
}

// ---------------------------------------------------------------------------

/** Serialize entries to MMKV. */
function persist(entries: CardEntry[]): void {
  keyVault.getEncryptedStorage().set(MMKV_KEYS.cards, JSON.stringify(entries));
}

/** Deserialize entries from a raw MMKV string (undefined = key absent). */
function parseEntries(raw: string | undefined): CardEntry[] {
  if (raw === undefined) {
    return [];
  }
  return JSON.parse(raw) as CardEntry[];
}

// ---------------------------------------------------------------------------

export const useCardsStore = create<CardsState>()((set) => ({
  cards: [],
  entries: [],

  hydrate() {
    const handle = keyVault.getEncryptedStorage();
    const entries = parseEntries(handle.getString(MMKV_KEYS.cards));
    set({ entries, cards: entries.map((e) => e.card) });
  },

  addCard(card: UserCard, clubSuggestedByApp?: boolean) {
    set((state) => {
      const entry: CardEntry =
        clubSuggestedByApp === true
          ? { card, clubSuggestedByApp: true }
          : { card };
      const entries = [...state.entries, entry];
      persist(entries);
      return { entries, cards: entries.map((e) => e.card) };
    });
  },

  removeCard(cardId: string) {
    set((state) => {
      const entries = state.entries.filter((e) => e.card.cardId !== cardId);
      persist(entries);
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
      persist(entries);
      return { entries, cards: entries.map((e) => e.card) };
    });
  },

  clearCards() {
    // Zero memory unconditionally.
    set({ cards: [], entries: [] });
    // Best-effort MMKV delete — vault may already be locked/wiped on logout.
    try {
      keyVault.getEncryptedStorage().delete(MMKV_KEYS.cards);
    } catch {
      // Vault locked or wiped: nothing to delete, in-memory state already cleared.
    }
  },
}));
