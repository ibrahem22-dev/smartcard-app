/**
 * THE REGRESSION TEST B4 NAMES — and `P1_DEFERRED.md` §2.2 calls the deferral it closes
 * *"the single most damaging deferral in the register"*:
 *
 *   > *"a pack update silently clobbers a user's own corrections … **nothing in P1 can enforce that
 *   > for P2**."*
 *
 * The campaign plan is explicit about what will and will not do:
 *
 *   > *"It is not optional and **it is not a unit test of the merge function** — it imports a real
 *   > newer pack."*
 *
 * So this writes an override, imports a whole newer pack set carrying a DIFFERENT value for the
 * same key, and asserts the user's value survives and reads back as `USER`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SQLITE DRIVER IS FAKED AND THE MERGE IS NOT
 *
 * `expo-sqlite` is native and there is no device here. The fake below is a real in-memory table
 * with real INSERT/DELETE/SELECT semantics for the four statements the pack store issues — it is
 * the DRIVER that is substituted, not the store, not the adapter, and not the merge. The import
 * path runs its actual transaction, the actual DELETE-then-INSERT that makes an update an update,
 * and the actual read-time resolution.
 *
 * What that leaves unproven is that SQLCipher encrypted the file, which is criterion B2's job on a
 * real device. It does not touch whether the override survives: the override was never in this
 * database to be overwritten.
 */
import {
  closePackStore,
  getPackRow,
  putPackRow,
  replacePackSet,
  VaultKeyInPackStoreError,
} from '../packStore';
import { assertNoVaultKeys, resolveValue, type StoredValue, type VaultReader } from '../storeAdapter';
import { CHIP_PRECEDENCE } from '../../authority/provenanceChip';

// ── the fake driver ─────────────────────────────────────────────────────────────────────────
type Row = { pack_set: string; key: string; value: string; pack_version: string };

const table: Row[] = [];

const fakeDb = {
  execSync: (): void => { /* CREATE TABLE — the fake table always exists */ },
  closeSync: (): void => { table.length = 0; },
  withTransactionSync: (fn: () => void): void => { fn(); },
  runSync: (sql: string, params: unknown[]): void => {
    if (sql.startsWith('INSERT')) {
      const [pack_set, key, value, pack_version] = params as [string, string, string, string];
      const at = table.findIndex((r) => r.pack_set === pack_set && r.key === key);
      const row = { pack_set, key, value, pack_version };
      if (at === -1) table.push(row);
      else table[at] = row;
      return;
    }
    if (sql.startsWith('DELETE')) {
      const [pack_set] = params as [string];
      for (let i = table.length - 1; i >= 0; i -= 1) {
        if (table[i]?.pack_set === pack_set) table.splice(i, 1);
      }
      return;
    }
    throw new Error('the fake driver was asked for an unmodelled statement: ' + sql);
  },
  getFirstSync: <T,>(sql: string, params: unknown[]): T | null => {
    if (!sql.startsWith('SELECT')) throw new Error('unmodelled: ' + sql);
    const [pack_set, key] = params as [string, string];
    return (table.find((r) => r.pack_set === pack_set && r.key === key) as T | undefined) ?? null;
  },
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): unknown => fakeDb,
}));

// ── the vault, as an interface the adapter reads through ────────────────────────────────────
const vaultRows = new Map<string, StoredValue>();
const vault: VaultReader = {
  readOverride: (key) => vaultRows.get(key) ?? null,
};

const FX_KEY = 'card.max.fxCommissionPct';

beforeEach(() => {
  table.length = 0;
  vaultRows.clear();
  closePackStore();
});

describe('B4 — the override is merged at read and always wins', () => {
  it('SURVIVES A PACK UPDATE that carries a different value for the same key', () => {
    // 1. The catalog ships 3.0%.
    replacePackSet('catalog', [
      { packSet: 'catalog', key: FX_KEY, value: '3.0', packVersion: '2026.08.22+1' },
    ], '2026.08.22+1');
    expect(resolveValue(vault, 'catalog', FX_KEY)?.value).toBe('3.0');

    // 2. The user corrects it to 2.25 — their own statement about their own card.
    vaultRows.set(FX_KEY, { value: '2.25', chip: 'USER', stale: false });
    const afterOverride = resolveValue(vault, 'catalog', FX_KEY);
    expect(afterOverride).toEqual({ value: '2.25', chip: 'USER', stale: false, source: 'vault' });

    // 3. A NEWER PACK ARRIVES carrying a different value. This is the whole test: not a call to a
    //    merge function, but the real import path — DELETE the set, INSERT the new rows.
    replacePackSet('catalog', [
      { packSet: 'catalog', key: FX_KEY, value: '3.5', packVersion: '2026.08.24+1' },
    ], '2026.08.24+1');

    // The pack store really did change.
    expect(getPackRow('catalog', FX_KEY)?.value).toBe('3.5');
    expect(getPackRow('catalog', FX_KEY)?.packVersion).toBe('2026.08.24+1');

    // 4. AND THE USER'S VALUE SURVIVED, and reads back as USER.
    const afterUpdate = resolveValue(vault, 'catalog', FX_KEY);
    expect(afterUpdate?.value).toBe('2.25');
    expect(afterUpdate?.chip).toBe('USER');
    expect(afterUpdate?.source).toBe('vault');
  });

  it('survives an update that DROPS the key entirely', () => {
    replacePackSet('catalog', [
      { packSet: 'catalog', key: FX_KEY, value: '3.0', packVersion: '1' },
    ], '1');
    vaultRows.set(FX_KEY, { value: '2.25', chip: 'USER', stale: false });

    // The new pack no longer carries this key at all — a real case, and one an INSERT-only import
    // would hide by leaving the old row behind.
    replacePackSet('catalog', [
      { packSet: 'catalog', key: 'card.max.annualFee', value: '0', packVersion: '2' },
    ], '2');
    expect(getPackRow('catalog', FX_KEY)).toBeNull();

    const resolved = resolveValue(vault, 'catalog', FX_KEY);
    expect(resolved?.value).toBe('2.25');
    expect(resolved?.chip).toBe('USER');
  });

  it('returns the pack value when the user has not overridden it', () => {
    replacePackSet('catalog', [
      { packSet: 'catalog', key: FX_KEY, value: '3.0', packVersion: '1' },
    ], '1');
    const resolved = resolveValue(vault, 'catalog', FX_KEY);
    expect(resolved?.value).toBe('3.0');
    expect(resolved?.source).toBe('pack');
  });

  it('returns null when neither store has the key — never a zero', () => {
    // An absent value and a value of zero are different facts about somebody's money.
    expect(resolveValue(vault, 'catalog', 'card.nobody.knows')).toBeNull();
  });

  it('wins because USER OUTRANKS, not because the vault is checked first', () => {
    // Asserting "the vault wins" would pass even if the reason were wrong. This ties the behaviour
    // to Data Contract §2.2's ordering, which is where the rule actually lives.
    expect(CHIP_PRECEDENCE.USER).toBeLessThan(CHIP_PRECEDENCE.VERIFIED);
    expect(CHIP_PRECEDENCE.USER).toBeLessThan(CHIP_PRECEDENCE.ESTIMATE);
    expect(CHIP_PRECEDENCE.USER).toBeLessThan(CHIP_PRECEDENCE.UNKNOWN);
  });
});

describe('B3 — vault rows are provably not in the pack store', () => {
  it('refuses a vault key at the point of writing', () => {
    expect(() =>
      putPackRow({ packSet: 'catalog', key: 'app:override_card_fee', value: 'x', packVersion: '1' }),
    ).toThrow(VaultKeyInPackStoreError);
  });

  it('refuses a whole pack set that contains one', () => {
    expect(() =>
      replacePackSet('catalog', [
        { packSet: 'catalog', key: 'card.max.fee', value: '0', packVersion: '1' },
        { packSet: 'catalog', key: 'profile_abc:user', value: 'x', packVersion: '1' },
      ], '1'),
    ).toThrow(VaultKeyInPackStoreError);
  });

  it('refuses before starting a transaction, one layer up', () => {
    expect(() => assertNoVaultKeys(['card.max.fee', 'app:consent_analytics'])).toThrow(/vault key/);
    expect(() => assertNoVaultKeys(['card.max.fee'])).not.toThrow();
  });

  it('leaves the table untouched when it refuses a set', () => {
    replacePackSet('catalog', [
      { packSet: 'catalog', key: 'card.max.fee', value: '10', packVersion: '1' },
    ], '1');
    expect(() =>
      replacePackSet('catalog', [
        { packSet: 'catalog', key: 'profile_abc:user', value: 'x', packVersion: '2' },
      ], '2'),
    ).toThrow();
    // The refusal happens BEFORE the DELETE. A check inside the transaction would have emptied the
    // set and then thrown, which is a worse outcome than the write it prevented.
    expect(getPackRow('catalog', 'card.max.fee')?.value).toBe('10');
  });
});
