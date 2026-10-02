/**
 * A DISABLED ADAPTER, CONSTRUCTED WHERE IT IS USED.
 *
 * `DisabledDataAuthorityAdapter` used to be a class plus a module-level mutable singleton, and D3
 * removed both. The tests that asserted *"an adapter supplying nothing yields no authority"* still
 * have a claim worth making — the claim was never about the singleton, it was about the boundary.
 *
 * So the adapter is built here, in test scope, and passed explicitly. That is the difference the
 * removal was for: the answer to *"which adapter is answering?"* is now visible at the call site
 * instead of depending on import order and on whoever called the setter last.
 *
 * This is test scaffolding and lives in `tools/p2/jest/`, not in `src/`. It is deliberately NOT
 * exported from the app: criterion D1 wires the real adapter in Phase 7, and a convenient disabled
 * one sitting in `src/authority/` is how a stand-in becomes a dependency.
 */
import type { DataAuthorityAdapter, AuthorityLookup } from '../../../src/authority/DataAuthorityAdapter';
import { blocked, type AuthorityValue } from '../../../src/authority/authorityValue';

export const DISABLED_REASON = 'INTEGRATION_DISABLED';

export const makeDisabledAdapter = (): DataAuthorityAdapter => ({
  adapterId: 'TEST_DISABLED_ADAPTER',
  isLive: false,
  lookupNumber: (lookup: AuthorityLookup): AuthorityValue<number> =>
    blocked(`${DISABLED_REASON}:${lookup.field}`),
  lookupText: (lookup: AuthorityLookup): AuthorityValue<string> =>
    blocked(`${DISABLED_REASON}:${lookup.field}`),
});
