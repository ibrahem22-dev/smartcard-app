/**
 * CROSS-PACK-SET REFERENCES — criterion C4, obligation OB-2.
 *
 *   > **OB-2.** *"A device may hold `catalog` from Tuesday and `benefits` from Friday.
 *   > `minAppVersion` and `packFormatVersion` protect against **shape** mismatch; they say nothing
 *   > about **content** skew. **The rule:** a reference is valid against the pack set that owns the
 *   > referent, **at the version the device holds**. A `benefits` row naming a card the device's
 *   > older `catalog` does not carry must render as **absent, never as an error**."*
 *
 *   > **C4.** *"…proven at genuinely mixed pack versions."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A MISS IS AN EXPECTED STATE, AND THE TYPE SAYS SO
 *
 * `resolveReference` returns a value in every case. It cannot throw and it never returns
 * `undefined`, because both of those force a caller to invent a policy at the call site — and the
 * policy invented under pressure is a `try/catch` that renders "something went wrong".
 *
 * This is the price of `benefits.pack` being republishable without `catalog.pack`, which is the
 * argument OD-17 accepted when it made G06b a parallel post-launch lane. Skew is not a fault to be
 * reported; it is Tuesday's catalog meeting Friday's benefits, working as designed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THREE STATES, AND THE THIRD IS NOT THE SECOND
 *
 *   · `PRESENT` — the referent is in the pack set that owns it, at the version held.
 *   · `ABSENT_IN_THIS_VERSION` — it is not, and that is legal. Render nothing, or render the row
 *     without the part that needed it. Never an error, never a spinner, never a retry.
 *   · `UNRESOLVABLE_REFERENCE` — the reference is malformed: empty, or not an id at all. That is a
 *     defect in a pack that verified, which is a different and much rarer thing, and collapsing it
 *     into `ABSENT` would hide a corrupt artifact behind a legal state.
 */

export type ReferenceState = 'PRESENT' | 'ABSENT_IN_THIS_VERSION' | 'UNRESOLVABLE_REFERENCE';

export interface ReferenceResolution<T> {
  readonly state: ReferenceState;
  readonly id: string;
  /** Only ever set when the state is `PRESENT`. */
  readonly value?: T;
  /** The pack set that OWNS the referent, and the version of it the device holds. */
  readonly ownedBy: string;
  readonly heldVersion: string;
}

/** What the device holds of one pack set: its id, its version, and how to look a referent up. */
export interface OwningPackSet<T> {
  readonly packId: string;
  readonly packVersion: string;
  lookup(id: string): T | undefined;
}

/**
 * Resolve a reference into another pack set, at the version this device holds.
 *
 * Never throws. A caller that wants to render the referent checks `state === 'PRESENT'`; a caller
 * that wants to render the row regardless simply omits the part it could not resolve.
 */
export function resolveReference<T>(id: string, owner: OwningPackSet<T>): ReferenceResolution<T> {
  const base = { id, ownedBy: owner.packId, heldVersion: owner.packVersion };

  if (typeof id !== 'string' || id.trim().length === 0) {
    // Not a miss. A pack that verified and carries an empty reference is a defect in the pack, and
    // reporting it as ordinary skew would hide a corrupt artifact behind a legal state.
    return { ...base, state: 'UNRESOLVABLE_REFERENCE' };
  }

  const value = owner.lookup(id);
  return value === undefined
    ? { ...base, state: 'ABSENT_IN_THIS_VERSION' }
    : { ...base, state: 'PRESENT', value };
}

/**
 * Resolve many at once, and report the skew as a MEASUREMENT rather than as a failure.
 *
 * The counts exist so a diagnostic surface can say "412 of 474 benefit rows name a card this
 * catalog carries" — which is a sentence about two pack versions, not an error. A device with
 * skew is a device working correctly.
 */
export function resolveAll<T>(
  ids: readonly string[],
  owner: OwningPackSet<T>,
): {
  readonly resolutions: readonly ReferenceResolution<T>[];
  readonly present: number;
  readonly absent: number;
  readonly unresolvable: number;
} {
  const resolutions = ids.map((id) => resolveReference(id, owner));
  return {
    resolutions,
    present: resolutions.filter((r) => r.state === 'PRESENT').length,
    absent: resolutions.filter((r) => r.state === 'ABSENT_IN_THIS_VERSION').length,
    unresolvable: resolutions.filter((r) => r.state === 'UNRESOLVABLE_REFERENCE').length,
  };
}

/**
 * Are two pack sets at different versions?
 *
 * Exported so a surface can say so plainly rather than implying that skew means something is
 * broken. `catalog` at Tuesday's version beside `benefits` at Friday's is the state OB-2 describes,
 * and a device in it is not in trouble.
 */
export function versionsDiffer(a: { packVersion: string }, b: { packVersion: string }): boolean {
  return a.packVersion !== b.packVersion;
}
