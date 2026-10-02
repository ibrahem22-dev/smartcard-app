import type { SurfaceEngineResults } from './surfaceEngines';

/**
 * Derive the absolute monthly cap offered by Plan Commitments from the same load result the
 * surface renders. A missing load result means income is unknown, so there is no honest suggestion.
 */
export function suggestedCommitmentCapIls(results: SurfaceEngineResults): number | null {
  const income = results.context.profile?.monthlyIncome;
  if (results.load === null || income === undefined) return null;

  return income * results.load.thresholds.strongWarningRatio.value;
}
