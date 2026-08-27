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
// Metadata wrapper (P4 M6):
//   Cards are persisted as CardEntry objects:
//     { user: UserCard, product: CardProduct, clubSuggestedByApp?: boolean }.
//   The store exposes the composed cards: EngineCard[] view for engines/UI.
//   A legacy `{ card: EngineCard }` row is split on hydrate, never written back mixed.
//
// unknownClub cards: valid entries — never filtered.

import { create } from 'zustand';

import {
  composeEngineCard,
  splitEngineCard,
  type CardProduct,
  type EngineCard,
  type UserCard,
} from '../types/card.types';
import type { Transaction } from '../types/benefits.types';
import { keyVault } from '../security/keyVault';
import type { ImportedInstallment } from '../types/installment.types';
import { cancelDiscountReminders } from '../services/notificationScheduler';
import { isValidMonetaryAmount } from '../utils/monetary';
import { MMKV_KEYS } from './keys';
import {
  HYDRATING,
  NOT_HYDRATED,
  describeHydrationError,
  hydrated,
  hydrationFailed,
  type HydrationState,
} from './hydration';

// ---------------------------------------------------------------------------

/**
 * MMKV-persisted wrapper. User state and product facts are separate records
 * (M6). clubSuggestedByApp is store metadata, not a UserCard field.
 */
export interface CardEntry {
  readonly user: UserCard;
  readonly product: CardProduct;
  /** True when the app's guided club-suggestion flow chose the club for the user. */
  readonly clubSuggestedByApp?: boolean;
}

// ---------------------------------------------------------------------------

interface CardsState {
  /** Whether `cards`/`entries`/`obligations` reflect storage yet. */
  hydration: HydrationState;
  /** Composed engine view — never persisted as this shape. */
  cards: EngineCard[];

  /**
   * Full persisted entries including metadata. Always in sync with `cards`.
   * Use this when you need clubSuggestedByApp alongside the card.
   */
  entries: CardEntry[];
  obligations: ImportedInstallment[];
  /**
   * Recent transactions available to benefits UI. Transaction import is not
   * implemented yet, so this remains an in-memory empty view until that
   * authenticated ingestion path exists.
   */
  transactions: Transaction[];

  /**
   * Populate in-memory state from encrypted MMKV.
   * Must be called once after a successful vault unlock.
   * Safe to call again (re-hydrates, e.g. after re-auth).
   */
  hydrate(): void;
  hydrateProfile(profileId: string): void;
  persistProfile(profileId: string): void;
  importProfileCards(profileId: string, cards: readonly EngineCard[]): void;

  /**
   * Append a new card. Accepts the composed engine view and splits it before
   * persist. If the card's club was suggested by the app's guided flow, pass
   * clubSuggestedByApp: true. unknownClub cards are valid — they are stored as-is.
   */
  addCard(card: EngineCard, clubSuggestedByApp?: boolean): void;

  /**
   * Persist a vault write that is already split (W5). The wizard uses this so it
   * never hands the store a mixed EngineCard or a raw dataset row.
   */
  addVaultEntry(entry: { readonly user: UserCard; readonly product: CardProduct }): void;

  /** Remove a card by its cardId. No-op if the id is not found. */
  removeCard(cardId: string): void;

  /**
   * Merge updates into an existing card. Identified by cardId.
   * No-op if the id is not found. Does not affect clubSuggestedByApp metadata.
   */
  updateCard(cardId: string, updates: Partial<EngineCard>): void;
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

function engineViews(entries: CardEntry[]): EngineCard[] {
  return entries.map((entry) => composeEngineCard(entry.user, entry.product));
}

function toEntry(card: EngineCard, clubSuggestedByApp?: boolean): CardEntry {
  const { user, product } = splitEngineCard(card);
  return clubSuggestedByApp === true
    ? { user, product, clubSuggestedByApp: true }
    : { user, product };
}

function isSplitEntry(value: unknown): value is CardEntry {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  return 'user' in value && 'product' in value;
}

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
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('INVALID_CARD_ENTRIES');
  }
  return parsed.map((row: unknown): CardEntry => {
    if (isSplitEntry(row)) {
      return row;
    }
    if (row !== null && typeof row === 'object' && 'card' in row) {
      const legacy = row as { card: EngineCard; clubSuggestedByApp?: boolean };
      return toEntry(legacy.card, legacy.clubSuggestedByApp);
    }
    throw new Error('INVALID_CARD_ENTRY');
  });
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
  transactions: [],
  hydration: NOT_HYDRATED,

  hydrate() {
    set({ hydration: HYDRATING });
    try {
      const handle = keyVault.getEncryptedStorage();
      const activeProfileId = handle.getString(MMKV_KEYS.activeProfileId);
      if (activeProfileId === undefined) {
        // No active profile is a KNOWN empty result, not a failure.
        set({
          entries: [],
          cards: [],
          obligations: [],
          hydration: hydrated(new Date().toISOString()),
        });
        return;
      }
      const entries = parseEntries(
        handle.getString(MMKV_KEYS.profileCards(activeProfileId)),
      );
      const obligations = parseObligations(
        handle.getString(MMKV_KEYS.profileCardObligations(activeProfileId)),
      );
      set({
        entries,
        cards: engineViews(entries),
        obligations,
        hydration: hydrated(new Date().toISOString()),
      });
    } catch (error: unknown) {
      // The vault can be locked (AUTH-07). Leaving `cards: []` behind without
      // recording the failure is what made a locked vault look like a user
      // with no cards.
      set({
        entries: [],
        cards: [],
        obligations: [],
        hydration: hydrationFailed(describeHydrationError(error)),
      });
    }
  },

  hydrateProfile(profileId: string) {
    const handle = keyVault.getEncryptedStorage();
    const entries = parseEntries(
      handle.getString(MMKV_KEYS.profileCards(profileId)),
    );
    const obligations = parseObligations(
      handle.getString(MMKV_KEYS.profileCardObligations(profileId)),
    );
    set({ entries, cards: engineViews(entries), obligations });
  },

  persistProfile(profileId: string) {
    const state = useCardsStore.getState();
    persist(state.entries, profileId);
    persistObligations(state.obligations, profileId);
  },

  importProfileCards(profileId: string, cards: readonly EngineCard[]) {
    const entries = cards.map((card) => toEntry(card));
    persist(entries, profileId);
    persistObligations([], profileId);
  },

  addCard(card: EngineCard, clubSuggestedByApp?: boolean) {
    set((state) => {
      const entries = [...state.entries, toEntry(card, clubSuggestedByApp)];
      persist(entries, getActiveProfileId());
      return { entries, cards: engineViews(entries) };
    });
  },

  addVaultEntry(entry: { readonly user: UserCard; readonly product: CardProduct }) {
    set((state) => {
      const entries = [...state.entries, { user: entry.user, product: entry.product }];
      persist(entries, getActiveProfileId());
      return { entries, cards: engineViews(entries) };
    });
  },

  removeCard(cardId: string) {
    void cancelDiscountReminders(cardId).catch((): void => {
      // Card removal remains available if the OS notification API is unavailable.
    });
    set((state) => {
      const entries = state.entries.filter((e) => e.user.cardId !== cardId);
      persist(entries, getActiveProfileId());
      return { entries, cards: engineViews(entries) };
    });
  },

  updateCard(cardId: string, updates: Partial<EngineCard>) {
    set((state) => {
      const entries = state.entries.map((e): CardEntry => {
        if (e.user.cardId !== cardId) {
          return e;
        }
        const current = composeEngineCard(e.user, e.product);
        const { user, product } = splitEngineCard({ ...current, ...updates });
        return e.clubSuggestedByApp === true
          ? { user, product, clubSuggestedByApp: true }
          : { user, product };
      });
      persist(entries, getActiveProfileId());
      return { entries, cards: engineViews(entries) };
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
    set({ cards: [], entries: [], obligations: [], transactions: [] });
  },
}));
