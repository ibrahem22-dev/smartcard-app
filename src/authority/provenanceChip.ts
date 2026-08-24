/**
 * THE PROVENANCE VOCABULARY — one, and it is the Data Contract's.
 *
 *   > **Data Contract §2.1.** *"Layer B — the product-facing provenance chip: **exactly four
 *   > states**… This four-state vocabulary is a published product promise. It MUST be exactly these
 *   > four states, not ad hoc variations. **Adding or renaming one is a spec amendment**, not a
 *   > contract detail."*
 *
 *   > **§2.2.** *"`USER` is a first-class member of the chip enum and has **no Layer-A source**: it
 *   > originates in the user's vault… **`USER` outranks every other chip.** A user override always
 *   > wins over any catalog value, at every layer, and **MUST NOT be overwritten by a pack
 *   > update**."*
 *
 * Criterion **B5**: *"`USER` is the same enum member the Data Contract defines. **No second
 * provenance vocabulary exists anywhere in the app.**"*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS REPLACED, AND WHY IT IS WORTH SAYING OUT LOUD
 *
 * The app had grown exactly the enum §2.2 predicts, word for word:
 *
 *     PROVENANCES = ['OFFICIAL_AUTHORITY', 'BUNDLED_DATASET', 'USER_INPUT', 'DERIVED_CALCULATION']
 *
 * Four members, none of them the contract's, with `USER_INPUT` standing in for `USER`. And this
 * campaign made it worse before it made it better: Phase 4 built the provenance chip component with
 * a THIRD spelling — lowercase `verified | user | estimate | unknown` — and its header confidently
 * declared "THIS IS A MAPPING, NOT A SECOND VOCABULARY", because the author had checked the app's
 * enum and not the contract's.
 *
 * Nobody chose three vocabularies for one concept. The contract predicted this failure IN WRITING
 * and it happened anyway, because nothing compared the app against the contract. Now something does:
 * `tools/p2/provenance-chip.json` is generated from §2 and parity-checked in the pipeline preflight,
 * and the `provenance-single-enum` gate fails if a second vocabulary appears anywhere.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHERE THE OLD MEMBERS WENT
 *
 *   OFFICIAL_AUTHORITY  → VERIFIED    the estate verified it
 *   BUNDLED_DATASET     → ESTIMATE    a shipped snapshot is not a current authoritative reading
 *   DERIVED_CALCULATION → ESTIMATE    §2.1 maps DERIVED and DERIVED_FROM_OFFICIAL to ESTIMATE
 *   USER_INPUT          → USER        the member whose absence caused all of this
 *
 * The two that collapse into ESTIMATE are a LAYER-A distinction, and §2.1 is explicit that the
 * Layer-A vocabulary "MUST NOT be reproduced in the application". Telling a user that a number came
 * from a bundled dataset rather than from a derivation is a distinction about our plumbing, not
 * about their money.
 */

/**
 * The four states, spelled exactly as the Data Contract spells them.
 * `tools/p2/provenance-chip.json` carries the same list, generated from §2.
 */
export const PROVENANCE_CHIPS = ['USER', 'VERIFIED', 'ESTIMATE', 'UNKNOWN'] as const;

export type ProvenanceChip = (typeof PROVENANCE_CHIPS)[number];

/**
 * `calculationSafe` per §2.1's table. `UNKNOWN` is the only one that is not: there is no number.
 *
 * `USER` is safe because, in the contract's words, *"it is the user's own statement of fact about
 * their own card"* — a person is allowed to be authoritative about their own agreement.
 */
export const CALCULATION_SAFE: Readonly<Record<ProvenanceChip, boolean>> = {
  USER: true,
  VERIFIED: true,
  ESTIMATE: true,
  UNKNOWN: false,
};

/**
 * Which chip may wear a "verified" affordance. Only one, and `USER` explicitly may not — §2.1's
 * table says it renders as **"Your value"**, which is a different claim and a truer one.
 */
export const MAY_RENDER_AS_VERIFIED: Readonly<Record<ProvenanceChip, boolean>> = {
  USER: false,
  VERIFIED: true,
  ESTIMATE: false,
  UNKNOWN: false,
};

/**
 * The chips that may wear a verified affordance, DERIVED from the table above rather than restated.
 *
 * It lives here and not in `authorityValue.ts` for a reason worth recording: computing it there,
 * from an import of this module, produced `ReferenceError: Cannot access 'provenanceChip' before
 * initialization` in six test suites at once. `authorityValue` re-exports from this module AND
 * evaluates a value from it at module scope, and the two orders cannot both be satisfied.
 *
 * Deriving a fact next to the fact it derives from avoids the cycle entirely, and is where it
 * belonged anyway.
 */
export const AUTHORITY_GRADE_CHIPS: readonly ProvenanceChip[] = PROVENANCE_CHIPS
  .filter((chip) => MAY_RENDER_AS_VERIFIED[chip]);

/**
 * §2.2: **`USER` outranks every other chip.** Lower number wins.
 *
 * Exported as data rather than left to an `if` at each merge site, because "the override always
 * wins" is criterion B4 and `P1_DEFERRED.md` §2.2 calls the missing enforcement *"the single most
 * damaging deferral in the register"* — a pack update silently clobbering a user's own correction.
 * A precedence somebody re-implements per call site is a precedence that will differ at one of them.
 */
export const CHIP_PRECEDENCE: Readonly<Record<ProvenanceChip, number>> = {
  USER: 0,
  VERIFIED: 1,
  ESTIMATE: 2,
  UNKNOWN: 3,
};

/** True when `a` outranks `b` and must survive a merge. */
export function outranks(a: ProvenanceChip, b: ProvenanceChip): boolean {
  return CHIP_PRECEDENCE[a] < CHIP_PRECEDENCE[b];
}

/**
 * §2.3: `stale` is a MODIFIER and orthogonal to the chip.
 *
 *   > *"Layer-A `HISTORICAL` sets `stale: true` and **retains the chip its verification grade
 *   > earned**. `{ chip: VERIFIED, stale: true }` is a valid and common state."*
 *
 * So a provenance record is a chip AND a flag, never a fifth chip. A `STALE` member would lose the
 * grade the value earned and tell a user "we do not know" about something that was verified
 * yesterday.
 */
export interface ProvenanceRecord {
  readonly chip: ProvenanceChip;
  readonly stale: boolean;
  /** ISO date the value was true as of, when the source carries one. */
  readonly asOfDate?: string | undefined;
}
