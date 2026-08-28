import { keyVault } from '../security/keyVault';
import type { CardCostRowId } from '../screens/cardDna/costRows';
import { MMKV_KEYS } from './keys';
import type { StoredValue, VaultReader } from './storeAdapter';

type CardCostOverrides = Readonly<Record<string, StoredValue>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCardCostOverrides(value: unknown): value is CardCostOverrides {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.value === 'string' &&
        entry.chip === 'USER' &&
        typeof entry.stale === 'boolean',
    )
  );
}

function parseOverrides(raw: string | undefined): CardCostOverrides {
  if (raw === undefined) return {};

  // Malformed JSON and an unexpected shape are both unreadable: the user's values are unknown,
  // which is equivalent to having none, and must not prevent the Card DNA screen from rendering.
  try {
    const parsed: unknown = JSON.parse(raw);
    return isCardCostOverrides(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function activeProfileId(): string | undefined {
  return keyVault
    .getEncryptedStorage()
    .getString(MMKV_KEYS.activeProfileId);
}

function readOverrides(profileId: string): CardCostOverrides {
  const raw = keyVault
    .getEncryptedStorage()
    .getString(MMKV_KEYS.profileCardOverrides(profileId));
  return parseOverrides(raw);
}

function persistOverrides(
  profileId: string,
  overrides: CardCostOverrides,
): void {
  keyVault
    .getEncryptedStorage()
    .set(
      MMKV_KEYS.profileCardOverrides(profileId),
      JSON.stringify(overrides),
    );
}

/** The only scheme used to address one card-cost row inside the profile override map. */
export function cardCostOverrideKey(
  cardId: string,
  rowId: CardCostRowId,
): string {
  return `card:${encodeURIComponent(cardId)}:cost:${rowId}`;
}

export function readCardCostOverride(
  cardId: string,
  rowId: CardCostRowId,
): StoredValue | null {
  const profileId = activeProfileId();
  if (profileId === undefined) return null;
  return readOverrides(profileId)[cardCostOverrideKey(cardId, rowId)] ?? null;
}

export function writeCardCostOverride(
  cardId: string,
  rowId: CardCostRowId,
  value: string,
): void {
  const profileId = activeProfileId();
  if (profileId === undefined) throw new Error('ACTIVE_PROFILE_REQUIRED');

  persistOverrides(profileId, {
    ...readOverrides(profileId),
    [cardCostOverrideKey(cardId, rowId)]: {
      value,
      chip: 'USER',
      stale: false,
    },
  });
}

export function clearCardCostOverride(
  cardId: string,
  rowId: CardCostRowId,
): void {
  const profileId = activeProfileId();
  if (profileId === undefined) return;

  const overrides = { ...readOverrides(profileId) };
  delete overrides[cardCostOverrideKey(cardId, rowId)];
  persistOverrides(profileId, overrides);
}

/** The adapter sees only its VaultReader contract, never MMKV or the profile key. */
export const cardCostOverrideVault: VaultReader = {
  readOverride(key): StoredValue | null {
    const profileId = activeProfileId();
    if (profileId === undefined) return null;
    return readOverrides(profileId)[key] ?? null;
  },
};
