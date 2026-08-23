/**
 * W1-AS-01 — Data Authority Adapter contract (APP-DEC-05).
 *
 * APP-DEC-05: the adapter contract precedes any live authority integration.
 * This module defines the seam and ships an explicitly DISABLED implementation.
 * No network client, no endpoint, no credential — connecting a live provider is
 * a separate, later decision.
 *
 * The disabled adapter is not a stub that returns fake data. It returns BLOCKED
 * for every lookup, so calling code exercises the real unavailable path from
 * day one instead of being written against placeholder numbers that will
 * disappear when the real provider arrives.
 */

import {
  type AuthorityValue,
  blocked,
  isCurrentAuthority,
} from './authorityValue';

export interface AuthorityLookup {
  /** Dotted field path, e.g. "card.fx.foreignFeePercent". */
  readonly field: string;
  /** Entity the claim is about, e.g. a card slug. */
  readonly entityId: string;
  /** Optional point in time; omitted means "current". */
  readonly asOf?: string;
}

export interface DataAuthorityAdapter {
  readonly adapterId: string;
  /** False for every adapter that is not a live authority provider. */
  readonly isLive: boolean;
  lookupNumber(lookup: AuthorityLookup): AuthorityValue<number>;
  lookupText(lookup: AuthorityLookup): AuthorityValue<string>;
}

export const INTEGRATION_DISABLED_REASON =
  'data_authority_integration_not_connected';

/**
 * D3 / WP-2.2 — THE SINGLETON IS GONE. THE SEAM IS NOT.
 *
 * What used to live below this line: a `DisabledDataAuthorityAdapter` class, a module-level
 * mutable `activeAdapter`, a `setDataAuthorityAdapter` setter, a reset, and a
 * `hasOfficialAuthorityFor` convenience that read the mutable. `P2_CAMPAIGN_PLAN.md` WP-2.2 is
 * precise about which half goes:
 *
 *   > delete … the `DisabledDataAuthorityAdapter` singleton (**keep the seam idea**, drop the
 *   > singleton)
 *
 * THE SEAM IDEA IS THE TYPED BOUNDARY ABOVE — `DataAuthorityAdapter`, `AuthorityLookup`,
 * `AuthorityValue` — and it stays, because criterion D1 implements exactly that interface in
 * Phase 7, against the published adapter package at a pinned version.
 *
 * THE SINGLETON WAS THE PROBLEM. Module-level mutable state any caller could swap meant the
 * answer to "where does this number come from?" depended on import order and on whoever called
 * the setter last — and a test that installed an adapter changed the behaviour of every later
 * test in the same process. D1 wires ONE adapter, explicitly, at a known point.
 *
 * Until then the refusal lives in `src/authority/noSource.ts`, which answers UNKNOWN with a
 * reason naming both criteria, so "not wired yet" is never mistaken for "not known".
 */
