import type { FxRate, RateChain, ResolvedRate } from '../adapter/vocabulary';

import { openBundledFxSnapshot, type VerifiedFxSnapshot } from '../adapter/fx';
import type { PackReader } from '../adapter/packSet';

import { cachedRateFor, type RateCacheDriver } from './rateCache';

/**
 * THE FX LANE — bundled only until the first successful fetch (handoff P3-1, spec §5).
 *
 * The boundary owns precedence: `FxSnapshotSlice.resolve(currency, asOf, chain)` fills the BUNDLED
 * lane itself and walks USER → LIVE → CACHED → BUNDLED → COMPARISON_INCOMPLETE in one place
 * (`rate-table.ts`). This module's entire job is to assemble the caller-supplied links:
 *
 *   - `live` — what THIS session's fetch produced (the lane above ran `fetchBoiRates`);
 *   - `cached` — what previous sessions' successes left in the rate cache.
 *
 * Because every successful fetch is written to the cache by the same hand that produced the live
 * rates, a device with any successful fetch ever has a CACHED rate, and the chain therefore reaches
 * BUNDLED **only while no success has ever happened**. That is P3-1's sentence, as arithmetic
 * rather than as a rule somebody must remember.
 *
 * PROVENANCE IS THE SOURCE, NOT THE WISH. The resolved answer carries which lane won (`resolution`)
 * and the rate carries its own `source`. A LIVE rate never carries `fallbackOnly: true` — that flag
 * belongs to the artifact — and the boundary refuses a bundled read whose source is anything else
 * (`FxLaneError`, fx.ts). A live rate and a frozen one are therefore never presented identically,
 * which is the whole reason P3-1 exists: *"a consumer that never looked would present a live rate
 * and a frozen one identically."*
 *
 * OFFLINE WITH NO CACHE IS AN ANSWER, AND THE ANSWER IS `COMPARISON_INCOMPLETE`. For a currency the
 * snapshot does not carry, with no live and no cached rate, the boundary returns incompleteness —
 * not zero, not the nearest currency, not last week's number used quietly (OD-23b).
 */

/**
 * The one app-side name for the end of the chain.
 *
 * A surface branching on this predicate is naming the honest answer — "this comparison cannot be
 * completed" — rather than inventing a number to render. OD-23b: a missing rate is a missing
 * answer, and offline with no cache is exactly that, not zero.
 */
export function isIncomplete(r: ResolvedRate): boolean {
  return r.resolution === 'COMPARISON_INCOMPLETE';
}

export interface LaneInputs {
  /** The verified bundled snapshot. Opened through the adapter, signature first (fx.ts). */
  readonly snapshot: VerifiedFxSnapshot;
  /** This session's successful fetch, if one happened. */
  readonly live?: readonly FxRate[];
  /** Previous sessions' successes, if any, straight from the cache port. */
  readonly cached?: readonly FxRate[] | null;
  /** A rate the user typed off a statement outranks everything (OD-23b). */
  readonly user?: FxRate;
}

/**
 * Resolve one currency as of one date across the full chain.
 *
 * `asOf` is an argument and never a clock — the rule the rest of the FX path follows, because a
 * module that knows what today is will eventually label a Friday rate with a Sunday.
 */
export function resolveFxRate(
  inputs: LaneInputs,
  currency: string,
  asOf: string,
): ResolvedRate {
  const liveRate = cachedRateFor(inputs.live ?? [], currency);
  const cachedValue = cachedRateFor(inputs.cached ?? null, currency);
  const userRate = inputs.user && inputs.user.currency === currency ? inputs.user : undefined;
  const chain: Omit<RateChain, 'bundled'> = {
    ...(liveRate ? { live: liveRate } : {}),
    ...(cachedValue ? { cached: cachedValue } : {}),
    ...(userRate ? { user: userRate } : {}),
  };

  return inputs.snapshot.slice.resolve(currency, asOf, chain);
}

/** Convenience for composition roots: open the snapshot and resolve in one call. */
export function openLaneAndResolve(
  reader: PackReader,
  cache: RateCacheDriver | undefined,
  currency: string,
  asOf: string,
  live?: readonly FxRate[],
): Promise<ResolvedRate> {
  const snapshot = openBundledFxSnapshot(reader);
  return cache
    ? cache.read().then((cached) => resolveFxRate({ snapshot, cached, ...(live ? { live } : {}) }, currency, asOf))
    : Promise.resolve(resolveFxRate({ snapshot, ...(live ? { live } : {}) }, currency, asOf));
}
