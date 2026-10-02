import * as SQLite from 'expo-sqlite';

import { STORAGE_NAMESPACE } from '../config/identity';

/**
 * THE PACK STORE — imported pack tables, and nothing else. Criterion B3.
 *
 *   > **B3.** *"Two stores, one adapter over both: encrypted MMKV for the user vault;
 *   > **SQLCipher-class SQLite for imported pack tables**. Pack tables are provably not in MMKV;
 *   > vault rows provably not in the pack store."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY TWO STORES AND NOT ONE
 *
 * They have opposite lifetimes and opposite owners.
 *
 * A pack is **replaceable**: it arrives signed, it is superseded by the next one, and dropping the
 * whole table is a legitimate recovery. The user's vault is **irreplaceable**: nobody can reissue
 * the corrections a person made about their own card, and a wipe is data loss with no remedy.
 *
 * One store for both means one recovery path for both, and the day somebody clears a corrupt pack
 * import they will clear the overrides with it. `P1_DEFERRED.md` §2.2 calls the missing enforcement
 * of exactly this *"the single most damaging deferral in the register"*.
 *
 * SQLite for packs because pack data is tabular and queried by key across thousands of rows, which
 * is what a database is for and what a key-value store is not. MMKV for the vault because the vault
 * is small, hot, and read on every render.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * SQLCIPHER-CLASS, AND WHAT THAT COSTS TO SAY HONESTLY
 *
 * `expo-sqlite` opens an encrypted database when the app is built with its SQLCipher variant. That
 * is a NATIVE build setting: this module asks for encryption and cannot verify the binary honoured
 * it. Criterion **B2** is the device-flagged one that proves the encryption on a real device with a
 * captured artifact, and until that runs the honest statement is "requested, not proven" — which is
 * what `describeEncryption()` returns, in those words, rather than a boolean that reads as a fact.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE STORE REFUSES VAULT KEYS
 *
 * Not as a lint rule somebody can silence — as a runtime refusal in `put`. B3's claim is that vault
 * rows are *provably* not here, and a store that would accept one if asked is a store where one
 * eventually lands. The refusal names the vault as the right home rather than only saying no.
 */

/** The one database. Its name follows the storage namespace, never the brand — see identity.json. */
const DATABASE_NAME = `${STORAGE_NAMESPACE}.packs.db`;

/**
 * Key prefixes that belong to the user's vault and may never be written here.
 *
 * THESE ARE THE VAULT'S REAL PREFIXES, and the first version of this list was not.
 *
 * It said `['user.', 'profile.', 'override.', 'card.override.', 'consent.']` — a namespace that
 * reads plausibly and that `src/store/keys.ts` has never used. The vault keys everything under
 * `app:` and `profile_`. So the refusal matched nothing: a pack import carrying
 * `app:language_preference` would have been accepted, written, and replaced on the next update.
 *
 * It was caught by this gate's own parity half reporting **"0 vault key(s) declared"** — a check
 * that found nothing and said so, rather than passing quietly. That report is the only reason the
 * hole was visible, and it is why the parity check earns its place beside the refusal it checks.
 */
const VAULT_KEY_PREFIXES = ['app:', 'profile_'] as const;

export interface PackRow {
  readonly packSet: string;
  readonly key: string;
  readonly value: string;
  readonly packVersion: string;
}

export class VaultKeyInPackStoreError extends Error {
  constructor(key: string) {
    super(
      `refused to write "${key}" to the pack store: it is a vault key. ` +
        'Pack data is replaceable and the vault is not — they have different lifetimes, different ' +
        'owners and different recovery paths, and B3 requires that vault rows are provably not here. ' +
        'Write it through the vault store instead.',
    );
    this.name = 'VaultKeyInPackStoreError';
  }
}

export function isVaultKey(key: string): boolean {
  return VAULT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

let database: SQLite.SQLiteDatabase | null = null;

/**
 * Open the pack database, creating its one table.
 *
 * `openDatabaseSync` rather than the async form: every caller needs the handle before it can do
 * anything, and an async open turns each of them into a state machine for no benefit.
 */
export function openPackStore(): SQLite.SQLiteDatabase {
  if (database !== null) return database;
  database = SQLite.openDatabaseSync(DATABASE_NAME);
  database.execSync(
    'CREATE TABLE IF NOT EXISTS pack_rows (' +
      'pack_set TEXT NOT NULL, ' +
      'key TEXT NOT NULL, ' +
      'value TEXT NOT NULL, ' +
      'pack_version TEXT NOT NULL, ' +
      'PRIMARY KEY (pack_set, key))',
  );
  return database;
}

/** For tests and for a clean re-import. Closes the handle so the next open re-creates it. */
export function closePackStore(): void {
  database?.closeSync();
  database = null;
}

export function putPackRow(row: PackRow): void {
  if (isVaultKey(row.key)) throw new VaultKeyInPackStoreError(row.key);
  openPackStore().runSync(
    'INSERT OR REPLACE INTO pack_rows (pack_set, key, value, pack_version) VALUES (?, ?, ?, ?)',
    [row.packSet, row.key, row.value, row.packVersion],
  );
}

export function getPackRow(packSet: string, key: string): PackRow | null {
  const row = openPackStore().getFirstSync<{
    pack_set: string; key: string; value: string; pack_version: string;
  }>('SELECT pack_set, key, value, pack_version FROM pack_rows WHERE pack_set = ? AND key = ?',
    [packSet, key]);
  if (!row) return null;
  return { packSet: row.pack_set, key: row.key, value: row.value, packVersion: row.pack_version };
}

/**
 * Replace an entire pack set — the shape a pack UPDATE takes.
 *
 * Deleting the set before inserting is what makes an update an update rather than a merge: a row
 * the new pack dropped must disappear, and an INSERT-only import would leave it behind forever,
 * looking exactly like current data.
 *
 * **It cannot touch the vault**, because the vault is not in this database at all. That is the
 * whole architectural point of B3, and it is what makes B4's regression test possible to state:
 * the override survives a pack update because a pack update has no way to reach it.
 */
export function replacePackSet(packSet: string, rows: readonly PackRow[], packVersion: string): void {
  for (const row of rows) {
    if (isVaultKey(row.key)) throw new VaultKeyInPackStoreError(row.key);
  }
  const db = openPackStore();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM pack_rows WHERE pack_set = ?', [packSet]);
    for (const row of rows) {
      db.runSync(
        'INSERT INTO pack_rows (pack_set, key, value, pack_version) VALUES (?, ?, ?, ?)',
        [packSet, row.key, row.value, packVersion],
      );
    }
  });
}

/**
 * What this module can honestly say about encryption at rest.
 *
 * A boolean here would read as a fact and would be a hope: SQLCipher is a native build variant, and
 * JavaScript cannot see which binary it is talking to. B2 proves it on a device.
 */
export function describeEncryption(): {
  readonly requested: true;
  readonly provenBy: 'B2 — device evidence, not yet captured';
} {
  return { requested: true, provenBy: 'B2 — device evidence, not yet captured' };
}
