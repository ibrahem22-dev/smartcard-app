/**
 * THE MVP ENGINE SURFACE ג€” roadmap ֲ§10's five engines, curated in one place (PD-P3-006).
 *
 * `MVP_ENGINE_MODULES` is the single home for which modules are THE engines of contract ֲ§7
 * (N1 scoring ֲ· N2 verdict ֲ· N3 fx ֲ· N4 load ֲ· N5 risk; currency.ts is their arithmetic core).
 * The P3 gates derive their engine population from this list ג€” existence-checked against disk and
 * consumption-checked per entry ג€” so an engine that lands without a reason trace or provenance
 * fails the day it lands. Add the module here IN THE SAME COMMIT as the module itself.
 *
 * The other modules under src/engines/ are pre-P3 product code: they stay visible in gate output
 * by name as out-of-T-scope pending the P4 rewiring (spec ֲ§20 moves recommendation logic onto
 * these five), but they are not policed by the T-group gates.
 */
export const MVP_ENGINE_MODULES = [
  'currency.ts',
  'fx.ts',         // WP-6.3 — N3
  // 'scoring.ts',   // WP-6.4 lands here
  // 'verdict.ts',   // WP-6.5 lands here
  // 'load.ts',      // WP-6.6 lands here
  // 'risk.ts',      // WP-6.7 lands here
] as const;

export type MvpEngineModule = (typeof MVP_ENGINE_MODULES)[number];
