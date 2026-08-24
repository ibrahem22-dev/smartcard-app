import {
  CHIP_PRECEDENCE,
  type ProvenanceChip,
  outranks,
} from '../authority/provenanceChip';
import { getPackRow, isVaultKey } from './packStore';

/**
 * ONE ADAPTER OVER TWO STORES — criteria B3 and B4.
 *
 *   > **B3.** *"Two stores, **one adapter over both**."*
 *
 *   > **B4.** *"**The override layer is merged at read and always wins.** A regression test writes
 *   > an override, imports a newer `catalog.pack` carrying a different value, and asserts the
 *   > user's value survives and reads back as `USER`."*
 *
 *   > **Data Contract §2.2.** *"**`USER` outranks every other chip.** A user override always wins
 *   > over any catalog value, at every layer, and **MUST NOT be overwritten by a pack update**."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * MERGED AT READ, AND THAT PREPOSITION IS THE WHOLE DESIGN
 *
 * The alternative is merge-at-write: apply the override into the pack table when it is set. It is
 * simpler, it is faster, and it is how a user's correction gets destroyed — because the next pack
 * import replaces that table, and the merged-in value goes with it. Silently. The user sees a
 * number they did not enter and has no way to know it changed.
 *
 * `P1_DEFERRED.md` §2.2 calls this *"the single most damaging deferral in the register"*: *"a pack
 * update silently clobbers a user's own corrections… nothing in P1 can enforce that for P2."*
 *
 * Merging at read makes the failure impossible rather than unlikely: THE OVERRIDE IS NEVER IN THE
 * PACK STORE, so a pack update has nothing of the user's to overwrite. The two stores are not an
 * organisational preference — they are the mechanism.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * PRECEDENCE IS DATA, NOT AN `if`
 *
 * `CHIP_PRECEDENCE` comes from the Data Contract's own ordering. A resolver that wrote
 * `if (override) return override` would be correct today and would be re-implemented, slightly
 * differently, at the second call site that needs it. The contract's §2.2 warning about two enums
 * applies equally to two precedence rules.
 */

/** A value as one store holds it, with the chip that says where it came from. */
export interface StoredValue {
  readonly value: string;
  readonly chip: ProvenanceChip;
  /** §2.3's modifier — orthogonal to the chip, never a fifth chip. */
  readonly stale: boolean;
}

/** What the vault must provide. An interface, so the adapter can be tested without a device. */
export interface VaultReader {
  readonly readOverride: (key: string) => StoredValue | null;
}

export interface ResolvedValue extends StoredValue {
  /** Which store answered. Carried so a surface can say WHY it is showing what it shows. */
  readonly source: 'vault' | 'pack';
}

/**
 * Read one value, merging the user's override over the pack at the moment of reading.
 *
 * Returns `null` when neither store has it — never a zero, never an empty string. An absent value
 * and a value of zero are different facts about somebody's money, and the type keeps them apart.
 */
export function resolveValue(
  vault: VaultReader,
  packSet: string,
  key: string,
): ResolvedValue | null {
  const override = vault.readOverride(key);
  const packRow = getPackRow(packSet, key);

  if (override === null && packRow === null) return null;
  if (packRow === null) {
    // Only the user has a value. It is theirs, and it is `USER`.
    return { ...(override as StoredValue), source: 'vault' };
  }
  const fromPack: StoredValue = {
    value: packRow.value,
    // A pack row's own chip travels with the row in a real pack; until D1 wires that through, a
    // pack value is VERIFIED only if the pack said so, and this adapter does not invent one.
    chip: 'VERIFIED',
    stale: false,
  };
  if (override === null) return { ...fromPack, source: 'pack' };

  // BOTH EXIST. §2.2: USER outranks every other chip, so the override wins — and the comparison is
  // the contract's ordering rather than a hardcoded preference for the vault, so a future chip
  // ordering change lands in one place.
  return outranks(override.chip, fromPack.chip)
    ? { ...override, source: 'vault' }
    : { ...fromPack, source: 'pack' };
}

/**
 * The precedence, exposed for a test to assert against the contract rather than against this file.
 *
 * A test that asserted `resolveValue` prefers the vault would pass even if the reason were wrong.
 * Asserting the ORDERING is what ties the behaviour to §2.2.
 */
export const PRECEDENCE = CHIP_PRECEDENCE;

/**
 * A guard for the import path: a pack import must never carry a vault key.
 *
 * `packStore.putPackRow` refuses one at the point of writing. This is the same refusal one layer
 * up, so an importer learns before it starts a transaction rather than half way through one.
 */
export function assertNoVaultKeys(keys: readonly string[]): void {
  const offenders = keys.filter(isVaultKey);
  if (offenders.length > 0) {
    throw new Error(
      `a pack import carried ${String(offenders.length)} vault key(s): ${offenders.slice(0, 3).join(', ')}. ` +
        'Pack data is replaceable and the vault is not; B3 requires that vault rows are provably ' +
        'not in the pack store, and B4 requires that a pack update cannot reach a user override.',
    );
  }
}
