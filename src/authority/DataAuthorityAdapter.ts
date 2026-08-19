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
 * The default adapter. Every lookup is BLOCKED with an explicit reason.
 *
 * BLOCKED rather than UNKNOWN is deliberate: the value is not merely
 * unestablished, it is deliberately withheld because no provider is connected.
 * The UI can therefore distinguish "we looked and do not know" from "we have
 * not been permitted to look".
 */
export class DisabledDataAuthorityAdapter implements DataAuthorityAdapter {
  public readonly adapterId = 'DISABLED_DATA_AUTHORITY_ADAPTER';

  public readonly isLive = false;

  public lookupNumber(lookup: AuthorityLookup): AuthorityValue<number> {
    return blocked(`${INTEGRATION_DISABLED_REASON}:${lookup.field}`);
  }

  public lookupText(lookup: AuthorityLookup): AuthorityValue<string> {
    return blocked(`${INTEGRATION_DISABLED_REASON}:${lookup.field}`);
  }
}

let activeAdapter: DataAuthorityAdapter = new DisabledDataAuthorityAdapter();

export function getDataAuthorityAdapter(): DataAuthorityAdapter {
  return activeAdapter;
}

/**
 * Install an adapter. Exposed for tests and for the future live integration.
 *
 * A live adapter is refused here: switching the app onto real authority data is
 * an Owner integration decision (APP-DEC-10), not something a module can do by
 * calling a setter. The contract exists; the switch does not.
 */
export function setDataAuthorityAdapter(adapter: DataAuthorityAdapter): void {
  if (adapter.isLive) {
    throw new Error(
      'live Data Authority adapters require a separate Owner integration decision (APP-DEC-10)',
    );
  }
  activeAdapter = adapter;
}

export function resetDataAuthorityAdapter(): void {
  activeAdapter = new DisabledDataAuthorityAdapter();
}

/**
 * Convenience guard: does the active adapter currently supply this field as
 * official authority? With the disabled adapter installed this is always false,
 * which is the honest answer.
 */
export function hasOfficialAuthorityFor(lookup: AuthorityLookup): boolean {
  return isCurrentAuthority(activeAdapter.lookupNumber(lookup));
}
