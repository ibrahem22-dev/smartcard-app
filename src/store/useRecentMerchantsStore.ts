/**
 * RECENT MERCHANTS — the five shops this profile last checked, and nothing else about them.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS STORED, AND WHY IT IS THIS AND NOT MORE
 *
 * A list of **canonical `merch:*` ids**. No amounts, no dates, no counts, no card, no verdict. A
 * merchant id is a pointer into a pack that ships with the app, so the record says "this profile
 * looked at Shufersal" and cannot be turned into a spending history by anyone who reads it — which
 * a `{merchant, amount, when}` row could, and which is why that shape is refused rather than
 * trimmed later.
 *
 * IT IS VAULT DATA ANYWAY. Where a person shops is theirs, so it goes through the encrypted store
 * on a profile-scoped key like every other vault record, it is wiped with the profile, and it may
 * never reach `track()` (U3, spec §18-A). Classified `vault` in `src/store/p5UserState.ts`, which
 * criterion U1's gate checks against this file in both directions.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A LOCKED VAULT PRODUCES NO RECENTS AND NO ERROR
 *
 * Unlike a commitment list, an empty recents list is not a dangerous input to anything: the worst
 * an unloaded read costs is a row of chips the user has to search past. So this store tolerates a
 * locked or wiped vault by returning an empty list rather than carrying a `HydrationState` that
 * every consumer would then have to branch on for no decision. The distinction the other stores
 * make exists because they feed engines; this one feeds a shortcut.
 */
import { create } from 'zustand';

import { RECENT_MERCHANT_LIMIT } from '../config/lists';
import { keyVault } from '../security/keyVault';
import { MMKV_KEYS } from './keys';

/**
 * The bound, RE-EXPORTED rather than declared. It is a list length and its one home is
 * `config/lists.ts`; the name stays here so a reader of this file sees what bounds the list
 * without following the import.
 */
export { RECENT_MERCHANT_LIMIT };

/** A canonical merchant id, as the taxonomy pack spells them. Nothing else is stored. */
const MERCHANT_ID = /^merch:[a-z0-9][a-z0-9-]{0,80}$/;

function parseRecents(raw: string | undefined): readonly string[] {
  if (raw === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => typeof id === 'string' && MERCHANT_ID.test(id))
      .slice(0, RECENT_MERCHANT_LIMIT);
  } catch {
    return [];
  }
}

interface RecentMerchantsState {
  readonly recent: readonly string[];
  hydrateProfile(profileId: string): void;
  /** Move a merchant to the front, de-duplicated, capped. A non-canonical id is ignored. */
  record(profileId: string, merchantId: string): void;
  clear(profileId: string): void;
  /** In-memory only, for a profile switch that has not resolved yet. Writes nothing. */
  forget(): void;
}

export const useRecentMerchantsStore = create<RecentMerchantsState>()((set, get) => ({
  recent: [],

  hydrateProfile(profileId: string): void {
    try {
      const raw = keyVault
        .getEncryptedStorage()
        .getString(MMKV_KEYS.profileRecentMerchants(profileId));
      set({ recent: parseRecents(raw) });
    } catch {
      /* Locked or wiped vault: no recents, no error. See the header. */
      set({ recent: [] });
    }
  },

  record(profileId: string, merchantId: string): void {
    if (!MERCHANT_ID.test(merchantId)) return;
    const next = [merchantId, ...get().recent.filter((id) => id !== merchantId)]
      .slice(0, RECENT_MERCHANT_LIMIT);
    try {
      keyVault
        .getEncryptedStorage()
        .set(MMKV_KEYS.profileRecentMerchants(profileId), JSON.stringify(next));
      set({ recent: next });
    } catch {
      /* A write that could not reach the vault must not leave the screen claiming it persisted. */
    }
  },

  clear(profileId: string): void {
    try {
      keyVault.getEncryptedStorage().delete(MMKV_KEYS.profileRecentMerchants(profileId));
    } catch {
      /* Already gone with the vault. */
    }
    set({ recent: [] });
  },

  forget(): void {
    set({ recent: [] });
  },
}));
