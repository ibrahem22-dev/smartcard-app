/**
 * P5's USER STATE, CLASSIFIED — criterion U1.
 *
 *   > **U1.** *"Every user-state field P5 introduces is classified in a declared table checked
 *   > against the code as exactly one of canonical, vault, derived cache, transient UI state,
 *   > permitted analytics or prohibited; an unclassified field fails."*
 *
 * Contract §12: *"A field with no class is a field whose privacy nobody decided."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE TABLE AND THE TYPE LIVE IN THIS ONE FILE, ON PURPOSE
 *
 * `P5_VALIDATION_PLAN.md` §5 requires the check to run in **both directions**: *"a field in the
 * code and not the table fails, and a field in the table and not the code fails too — the second
 * direction catches a table that stopped describing the product."*
 *
 * A table in a document and a type in the code are two homes for one fact, and P1 and P2 between
 * them found eleven instances of that drifting. So the persisted shape P5 adds is declared here,
 * beside its classification, and `tools/p5/gates/state-classification.mjs` compares the two — plus
 * every P5-owned key in `MMKV_KEYS`. Editing one without the other fails.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * ONE ENTRY IS `prohibited`, AND IT IS THE INTERESTING ONE
 *
 * Contract §12 lists *"dismissal flags"* among the user state P5 introduces. Criterion **H6**
 * requires Home's contextual-suggestion slot to **ship empty** — spec §5 marks suggestions V1.x —
 * so there is nothing to dismiss, and a dismissal flag would be the first half of a feature §17
 * sends to a later phase. It is written down as **prohibited** rather than silently omitted,
 * because a table that lists only what exists cannot tell a reader that something was considered
 * and refused. H6 is *"a criterion written to refuse work"*; this is its row.
 */

/** The six classes contract §12 names. A field is in exactly one. */
export type P5StateClass =
  /** Shared reference data from the packs. P5 introduces none: it consumes the adapter. */
  | 'canonical'
  /** Local user data. Encrypted vault, through the store, and it never reaches `track()`. */
  | 'vault'
  /** A copy of an engine result, local-only, invalidated rather than shipped stale (U4, A5). */
  | 'derived-cache'
  /** Lives for the life of a screen. Never persisted, never transmitted. */
  | 'transient'
  /** An event or property the analytics allowlist permits. P5 adds no `track()` call site (U3). */
  | 'permitted-analytics'
  /** Considered and refused. Present so the refusal is on the record rather than an absence. */
  | 'prohibited';

/**
 * WHERE A FIELD LIVES, AS A THING THE GATE CAN CHECK RATHER THAN PROSE IT CANNOT.
 *
 * The table's first version assumed every piece of P5 state would be a field on `UserProfile`,
 * because the first one was. N3's override layer is not: it is a profile-scoped record under its own
 * `MMKV_KEYS` entry, and the gate — which required every non-prohibited row to be a member of
 * `P5UserProfileFields` AND `UserProfile` — could not have described it without failing.
 *
 * The failure that mattered was the other direction. The reverse check asked whether any MMKV key
 * whose NAME CONTAINS "p5" lacked a row. `profileCardOverrides` does not contain "p5", so a whole
 * persisted store of the user's own financial figures could have shipped unclassified and the gate
 * would have said OK. A heuristic over a name is not a population (§2 rule 4).
 */
export type P5StateHome =
  /** A field on `UserProfile`, persisted with the profile record. */
  | 'user-profile'
  /** Its own key in `MMKV_KEYS`, holding a record of its own. */
  | 'mmkv-key'
  /** Nowhere, and deliberately — the home a `prohibited` row has. */
  | 'none';

export interface P5StateField {
  /** The field name as the code spells it. For an `mmkv-key` row, the key's name in `MMKV_KEYS`. */
  readonly field: string;
  readonly class: P5StateClass;
  /** Which home the gate should look in. Prose cannot be checked; this can. */
  readonly home: P5StateHome;
  /** Where it lives, so the gate and a reader can both find it. */
  readonly where: string;
  /** The criterion that introduces it, and the reason the class is that one. */
  readonly why: string;
}

/**
 * THE PERSISTED SHAPE P5 ADDS.
 *
 * P5's first new user-state field is the **editable absolute ₪ cap** — criterion `J1` requires the
 * cap *"shown as an absolute ₪ limit derived from the 35% threshold, editable"*, and `H3` pairs
 * Home's load bar with the same absolute figure. It goes on `UserProfile` rather than into a new
 * store, beside `dangerThreshold`, which is already exactly this shape: *"₪ user-defined warning
 * level. Unknown until the user enters one."* A second store for one number would be a second place
 * a user's financial preference can live.
 *
 * It is OPTIONAL and it stays optional: unknown until the user sets one is a real state, and a
 * default written into the vault would be the app's opinion wearing the user's provenance.
 */
export interface P5UserProfileFields {
  /**
   * ₪ ceiling the user is willing to commit monthly. Absent until they set one; the 35% threshold
   * is what a suggested value would be DERIVED from, by the load engine, never stored as if chosen.
   */
  readonly commitmentCapIls?: number;
}

/** The declared table. The gate compares it against the type above and against `MMKV_KEYS`. */
export const P5_USER_STATE: readonly P5StateField[] = [
  {
    field: 'commitmentCapIls',
    class: 'vault',
    home: 'user-profile',
    where: 'UserProfile, persisted under MMKV_KEYS.profileUser(profileId)',
    why: 'J1 and H3 — the editable absolute ₪ cap. It is the user\'s own financial preference, so it '
      + 'goes to the encrypted vault through the store (U2) and may never reach track() (U3, spec §18-A).',
  },
  {
    field: 'profileCardOverrides',
    class: 'vault',
    home: 'mmkv-key',
    where: 'MMKV_KEYS.profileCardOverrides(profileId) — a profile-scoped record in the encrypted vault',
    why: 'N3 — the section A pencil. Every figure in it is a number the user typed about their own card, '
      + 'which is why the writer stores it with chip USER and never VERIFIED or ESTIMATE (§25: "USER REPORT '
      + '→ Your value"). It is vault, it reaches the vault through the store (U2), and it may never reach '
      + 'track() (U3, spec §18-A). It is NOT a UserProfile field, and this row is the reason the table '
      + 'learned to say so.',
  },
  {
    field: 'homeSuggestionDismissed',
    class: 'prohibited',
    home: 'none',
    where: 'nowhere — and that is the point',
    why: 'Contract §12 lists dismissal flags among P5\'s new state, but H6 requires Home\'s contextual-'
      + 'suggestion slot to SHIP EMPTY (spec §5 marks suggestions V1.x, §19 feature 43). There is nothing '
      + 'to dismiss, and a dismissal flag would be the first half of a feature §17 sends to a later phase.',
  },
];

/** Every field the table declares, for the gate and for the suite. */
export const P5_STATE_FIELDS = P5_USER_STATE.map((f) => f.field);

/** The fields that must exist in the code. `prohibited` ones must NOT. */
export const P5_STATE_EXPECTED_IN_CODE = P5_USER_STATE
  .filter((f) => f.class !== 'prohibited')
  .map((f) => f.field);

/** Rows that must be members of the persisted UserProfile shape. */
export const P5_STATE_PROFILE_FIELDS = P5_USER_STATE
  .filter((f) => f.home === 'user-profile')
  .map((f) => f.field);

/** Rows that must name a real entry in `MMKV_KEYS`. */
export const P5_STATE_MMKV_KEYS = P5_USER_STATE
  .filter((f) => f.home === 'mmkv-key')
  .map((f) => f.field);

export const P5_STATE_FORBIDDEN_IN_CODE = P5_USER_STATE
  .filter((f) => f.class === 'prohibited')
  .map((f) => f.field);
