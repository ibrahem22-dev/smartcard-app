/**
 * THE ADAPTER VOCABULARY SEAM — one door for the data-layer modules outside `adapter/**`.
 *
 * WHY THIS EXISTS. D2 (and the adapter-consumption gate) says nothing outside
 * `src/data/adapter/**` touches the pack boundary: a second direct importer of
 * `@smartcard/data-authority-adapter` is a second reading of it. The BOI feed modules in
 * `src/data/fx/**` need the adapter's TYPES and two small pure helpers, and they had been
 * importing the package directly — correct at runtime, wrong at the boundary, which is what
 * the first CI run over P3's tree caught.
 *
 * WHAT THIS FILE IS. A re-export seam INSIDE the permitted directory: every symbol here keeps
 * its canonical definition in the pipeline-owned package; nothing is restated, wrapped or
 * re-decided. `src/data/fx/**` imports through this door and only through this door. Engine and
 * surface code must not import from here — they have their own structurally-typed shapes.
 */
import {
  conventionalQuoteUnit,
  isBusinessDay,
  type FxRate,
  type RateChain,
  type ResolvedRate,
} from '@smartcard/data-authority-adapter';

export { conventionalQuoteUnit, isBusinessDay };
export type { FxRate, RateChain, ResolvedRate };
