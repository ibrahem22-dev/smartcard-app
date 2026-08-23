/**
 * THE SEAM, WITH NOTHING BEHIND IT YET — criterion D3.
 *
 * `P2_CAMPAIGN_PLAN.md` WP-2.2 removes the legacy data path and is explicit about what to keep:
 *
 *   > delete `useCardRatesDatabase.ts`, `useFxAbroad.ts`, `nonAuthorityDataAccess.ts`, and the
 *   > `DisabledDataAuthorityAdapter` singleton (**keep the seam idea**, drop the singleton)
 *
 * This is the seam. It answers every question the removed bundled datasets used to answer, and it
 * answers all of them the same way: **there is no source wired yet.**
 *
 * WHY A REFUSAL AND NOT A FALLBACK. `card_rates.json`, `fxAbroad.v2.json` and `fxAbroadCardMap.json`
 * were the old world's answers. Leaving any of them reachable keeps a second answer alive next to
 * the one the adapter will give — and the forensic's finding was that the project already had three
 * coexisting FX implementations. A screen that shows "not yet confirmed" is honest; a screen that
 * shows a bundled number from a dataset nobody is maintaining is confidently wrong.
 *
 * WHY IT IS NOT AN ADAPTER STUB EITHER. The real adapter is criterion **D1**, wired in Phase 7
 * against the published package at a pinned version. A stub that returned plausible shapes now
 * would be a second implementation of the interface the handoff forbids re-deriving (§2), and every
 * consumer would be written against the stub's behaviour rather than the adapter's.
 *
 * So: one module, one reason string, and a type system that already had somewhere to put it —
 * `ResolvedFxAbroad` has carried `{ status: 'unknown', reason }` since before P2.
 */
import type { BenefitsDB } from '../types/benefits.types';
import type { ResolvedDatabaseRates } from '../types/cardRatesDatabase.types';
import type { ResolvedFxAbroad } from '../types/fxAbroad.types';

/**
 * The single reason every refusal here carries. It names the criterion that removed the old source
 * and the one that will supply the new one, so a reader who finds it on screen or in a log can tell
 * "this is unfinished" from "this is broken".
 */
export const NO_AUTHORITY_SOURCE = 'no_authority_source_wired' as const;

export const NO_AUTHORITY_SOURCE_DETAIL =
  'The legacy bundled datasets were removed from the runtime by criterion D3. The Data Authority '
  + 'Adapter that replaces them is criterion D1 and is wired in Phase 7. Until then every fact this '
  + 'seam used to answer is UNKNOWN — not zero, not a default, and not a remembered value.';

/** No FX triple is available for any card. */
export const resolveFxAbroad = (_card?: unknown): ResolvedFxAbroad => ({
  status: 'unknown',
  reason: NO_AUTHORITY_SOURCE,
});

/**
 * No per-card rates are available.
 *
 * `null` is the shape the consumers already handled — `useCardDatabaseRates` returned
 * `ResolvedDatabaseRates | null` and every caller branched on it — so the refusal travels through
 * code paths that already existed rather than through new ones nobody has exercised.
 */
export const resolveDatabaseRates = (_card?: unknown): ResolvedDatabaseRates | null => null;

/**
 * An EMPTY benefits database, not a missing one.
 *
 * The distinction is the same one the pipeline makes for `conflicts[]`: an empty array is a
 * statement, and absence is ambiguous. Consumers iterate `issuers`, so an empty record makes them
 * find nothing — which is true — instead of throwing, which would be a different claim.
 */
export const EMPTY_BENEFITS_DB: BenefitsDB = { issuers: {} };
